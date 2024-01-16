const assert = require('assert');
const webdriver = require('selenium-webdriver');
const { By, until } = webdriver;
const MapDriver = require('../mapdriver.js').MapDriver;
const sleep = MapDriver.sleep;

const TEST_TIMEOUT = 10 * 60 * 1000;


describe('Extension options page', function () {
    // this.retries(3);
    this.slow(TEST_TIMEOUT);
    this.timeout(TEST_TIMEOUT);
    let driver;
    let mapDriver;

    before(async () => {
        mapDriver = await MapDriver.create();
        driver = mapDriver.driver;
    });
    after(async () => {
        await mapDriver.quit();
    })

    it('options page', async () => {
        await openOptionsPage();
        await driver.switchTo().frame(driver.findElement(By.id("mapsdemo")));
        const elem = await mapDriver.waitForScrollMapsLoaded();
        await assertLatLng({ lat: 37.3861, lng: -122.0839 });
        await mapDriver.scroll(elem, 300, -40);
        await sleep(500);
        await assertLatLng({ lat: 37.406829, lng: -121.887519 });
    });

    it('increase scroll speed', async () => {
        await openOptionsPage();

        const scrollSpeedSlider = await driver.findElement(By.id('PMslider_scrollSpeed'));
        await setSlider(scrollSpeedSlider, 400);

        await driver.switchTo().frame(driver.findElement(By.id("mapsdemo")));
        const elem = await mapDriver.waitForScrollMapsLoaded();
        await assertLatLng({ lat: 37.3861, lng: -122.0839 });
        await mapDriver.scroll(elem, 300, -40);
        await sleep(500);
        await assertLatLng({ lat: 37.427989, lng: -121.690672, tolerance: 0.003 });
    });

    it('invert scroll', async () => {
        await openOptionsPage();

        let invertScrollCheckbox = await driver.findElement(By.id('PMcheckbox_invertScroll'));
        await invertScrollCheckbox.click();

        await driver.switchTo().frame(driver.findElement(By.id("mapsdemo")));
        const elem = await mapDriver.waitForScrollMapsLoaded();
        await assertLatLng({ lat: 37.3861, lng: -122.0839 });
        await mapDriver.scroll(elem, 300, -40);
        await sleep(500);
        await assertLatLng({ lat: 37.344392, lng: -122.476801, tolerance: 0.003 });
    });

    it('zoom', async () => {
        await openOptionsPage();

        await driver.switchTo().frame(driver.findElement(By.id("mapsdemo")));
        const elem = await mapDriver.waitForScrollMapsLoaded();
        await assertLatLng({ lat: 37.3861, lng: -122.0839 });
        assert.equal(await getIframeZoom(), 12);
        await mapDriver.scroll(elem, 0, 64, { metaKey: true, logTag: 'Zooming' });
        await sleep(500);
        assert.equal(await getIframeZoom(), 10);
    });

    it('invert zoom', async () => {
        await openOptionsPage();

        let invertZoomCheckbox = await driver.findElement(By.id('PMcheckbox_invertZoom'));
        await invertZoomCheckbox.click();

        await driver.switchTo().frame(driver.findElement(By.id("mapsdemo")));
        const elem = await mapDriver.waitForScrollMapsLoaded();
        await assertLatLng({ lat: 37.3861, lng: -122.0839 });
        assert.equal(await getIframeZoom(), 12);
        await mapDriver.scroll(elem, 0, 64, { metaKey: true, logTag: 'Zooming' });
        await sleep(500);
        assert.equal(await getIframeZoom(), 14);
    });

    let firefoxExtensionUrl;

    async function openOptionsPage() {
        if (process.env.BROWSER === 'chrome') {
            await driver.get('chrome-extension://fhmmcoabkeceafmokkpgddnmmkhjlenl/src/options/options.html');
        } else if (process.env.BROWSER === 'edge') {
            await driver.get('chrome-extension://ipkkinfjghncepalhlppcjfedcdojfha/src/options/options.html');
        } else if (process.env.BROWSER === 'firefox') {
            if (firefoxExtensionUrl) {
                await driver.get(firefoxExtensionUrl);
            } else {
                await driver.get('about:addons');
                await driver.findElement(By.name('extension')).click();
                const originalWindow = await driver.getWindowHandle();
                const scrollMapsItem = await driver.findElement(By.css(`[addon-id="${mapDriver.extras.extensionId}"]`));
                await scrollMapsItem.findElement(By.className('more-options-button')).click();
                try {
                    await scrollMapsItem.findElement(By.css('[action="preferences"]')).click();
                } catch (e) {
                    // console.log(e);
                }
                const windows = await driver.getAllWindowHandles();
                const newWindow = windows.find(handle => handle !== originalWindow);
                await driver.switchTo().window(newWindow);
                console.log(windows);
                await sleep(1000);
                firefoxExtensionUrl = driver.getCurrentUrl();
            }
        } else {
            throw Error("Unsupported browser");
        }
    }

    async function getIframeCoords() {
        const largerMapLink = await driver.wait(until.elementLocated(By.className("google-maps-link")));
        const href = await largerMapLink.getAttribute("href");
        const linkUrl = new URL(href);
        return linkUrl.searchParams.get('ll').split(',', 2).map(Number);
    }

    async function getIframeZoom() {
        const largerMapLink = await driver.wait(until.elementLocated(By.className("google-maps-link")));
        const href = await largerMapLink.getAttribute("href");
        console.log('href', href);
        const linkUrl = new URL(href);
        return Number(linkUrl.searchParams.get('z'));
    }

    const TOLERANCE = 0.001;  // Tolerate 0.001' error

    async function assertLatLng({ lat: expectedLat, lng: expectedLng, tolerance = TOLERANCE }) {
        const [lat, lng] = await getIframeCoords();
        const minLat = expectedLat - tolerance;
        const maxLat = expectedLat + tolerance;
        const minLng = expectedLng - tolerance;
        const maxLng = expectedLng + tolerance;
        const errorMsg = `[${lat}, ${lng}] should be within [[${minLat}, ${maxLat}], [${minLng}, ${maxLng}]]`;
        assert(minLat <= lat && lat <= maxLat, errorMsg)
        assert(minLng <= lng && lng <= maxLng, errorMsg)
    }

    async function setSlider(slider, value) {
        await driver.executeScript((slider, value) => {
            slider.value = value;
            slider.dispatchEvent(new Event('change'))
        }, slider, value);
    }
});
