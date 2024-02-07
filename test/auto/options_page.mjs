import assert from 'assert';
import { By, until } from 'selenium-webdriver';
import { MapDriver, assertIn, sleep } from '../mapdriver.js';

const TEST_TIMEOUT = 10 * 60 * 1000;


describe('Extension options page', function () {
    this.retries(2);
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
        await assertLatLng([37.3861, 0.01], [-122.0839, 0.01]);
        await mapDriver.scroll(elem, 300, -40);
        await sleep(1000);
        await assertLatLng([37.406011, 0.01], [-121.894043, 0.01]);
    });

    it('increase scroll speed', async () => {
        await openOptionsPage();

        const scrollSpeedSlider = await driver.findElement(By.id('PMslider_scrollSpeed'));
        await setSlider(scrollSpeedSlider, 400);
        await sleep(500);

        await driver.switchTo().frame(driver.findElement(By.id("mapsdemo")));
        const elem = await mapDriver.waitForScrollMapsLoaded();
        await assertLatLng([37.3861, 0.01], [-122.0839, 0.01]);
        await mapDriver.scroll(elem, 300, -40);
        await sleep(1000);
        await assertLatLng([37.426915, 0.01], [-121.696581, 0.05]);
    });

    it('invert scroll', async () => {
        await openOptionsPage();

        let invertScrollCheckbox = await driver.findElement(By.id('PMcheckbox_invertScroll'));
        if (!await invertScrollCheckbox.getAttribute('checked')) {
            await invertScrollCheckbox.click();
        }

        await driver.switchTo().frame(driver.findElement(By.id("mapsdemo")));
        const elem = await mapDriver.waitForScrollMapsLoaded();
        await assertLatLng([37.3861, 0.01], [-122.0839, 0.01]);
        await mapDriver.scroll(elem, 300, -40);
        await sleep(1000);
        await assertLatLng([37.346231, 0.01], [-122.459391, 0.01]);
    });

    it('zoom', async () => {
        await openOptionsPage();

        await driver.switchTo().frame(driver.findElement(By.id("mapsdemo")));
        const elem = await mapDriver.waitForScrollMapsLoaded();
        await assertLatLng([37.3861, 0.01], [-122.0839, 0.01]);
        assert.equal(await getIframeZoom(), 12);
        await mapDriver.scroll(elem, 0, 100, { metaKey: true, logTag: 'Zooming' });
        await sleep(1000);
        assert.equal(await getIframeZoom(), 10);
    });

    it('invert zoom', async () => {
        await openOptionsPage();

        let invertZoomCheckbox = await driver.findElement(By.id('PMcheckbox_invertZoom'));
        if (!await invertZoomCheckbox.getAttribute('checked')) {
            await invertZoomCheckbox.click();
        }

        await driver.switchTo().frame(driver.findElement(By.id("mapsdemo")));
        const elem = await mapDriver.waitForScrollMapsLoaded();
        await assertLatLng([37.3861, 0.01], [-122.0839, 0.01]);
        assert.equal(await getIframeZoom(), 12);
        await mapDriver.scroll(elem, 0, 100, { metaKey: true, logTag: 'Zooming' });
        await sleep(1000);
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

                // Allow frame permission
                await driver.findElement(By.id('frame-perm-btn')).click();
                await mapDriver.firefoxAllowPermission();
            }
        } else {
            throw Error("Unsupported browser");
        }
    }

    async function getIframeCoords() {
        const largerMapLink = await driver.wait(until.elementLocated(By.className("google-maps-link")));
        async function impl() {
            const href = await largerMapLink.getAttribute("href");
            const linkUrl = new URL(href);
            const ll = linkUrl.searchParams.get('ll');
            return ll && ll.split(',', 2).map(Number);
        }
        return await driver.wait(async () => await impl(), 2000);
    }

    async function getIframeZoom() {
        const largerMapLink = await driver.wait(until.elementLocated(By.className("google-maps-link")));
        const href = await largerMapLink.getAttribute("href");
        console.log('href', href);
        const linkUrl = new URL(href);
        return Number(linkUrl.searchParams.get('z'));
    }

    async function assertLatLng(expectedLat, expectedLng) {
        const [lat, lng] = await getIframeCoords();
        assertIn(lat, expectedLat);
        assertIn(lng, expectedLng);
    }

    async function setSlider(slider, value) {
        await driver.executeScript((slider, value) => {
            slider.value = value;
            slider.dispatchEvent(new Event('change'))
        }, slider, value);
    }
});
