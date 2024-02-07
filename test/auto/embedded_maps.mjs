import assert from 'assert';
import { MapDriver, assertIn, sleep } from '../mapdriver.js';
import { By, until } from 'selenium-webdriver';

const TEST_TIMEOUT = 10 * 60 * 1000;


describe('IFrame embed test suite', function () {
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

    it('https://developers.google.com/maps/documentation/embed', async () => {
        await driver.get('https://developers.google.com/maps/documentation/embed/get-started');
        await mapDriver.clickBrowserAction();

        const frameElem = await driver.wait(async () => {
            for (const elem of await driver.findElements(By.css('iframe'))) {
                if ((await elem.getAttribute('src')).indexOf('google.com/maps/embed') !== -1) {
                    return elem;
                }
            }
        }, 10000, "Unable to find embedded maps");
        await driver.executeScript((frameElem) =>
            frameElem.scrollIntoView({ behavior: 'instant', block: 'center' }), frameElem);

        if (process.env.BROWSER === 'firefox') {
            try {
                const elem = await driver.wait(async () => (await driver.findElements(By.css("[data-scrollmaps-perm-button]")))[0], 5000);
                const requestPermissionButton = await (await elem.getShadowRoot()).findElements(By.className("sm-perm-btn"));
                const originalWindow = await driver.getWindowHandle();
                await requestPermissionButton[0].click();
                const windows = await driver.getAllWindowHandles();
                const newWindow = windows.find(handle => handle !== originalWindow);
                await driver.switchTo().window(newWindow);
                const framePermBtn = await driver.wait(async () => (await driver.findElements(By.id("frame-perm-btn")))[0], 5000);
                await sleep(2000);
                await framePermBtn.click();
                await mapDriver.firefoxAllowPermission();
                await driver.switchTo().window(originalWindow);
            } catch (e) {
                console.warn("Error requesting permission", e);
            }
        }

        const assertLatLng = async (expectedLat, expectedLng) => {
            let [lat, lng] = await getIframeCoords();
            console.log('iframe latlng', lat, lng)
            assertIn(lat, expectedLat);
            assertIn(lng, expectedLng);
        }

        await driver.switchTo().frame(frameElem);
        const elem = await mapDriver.waitForScrollMapsLoaded();
        await assertLatLng([47.62, 0.1], [-122.3492, 0.1]);
        await mapDriver.scroll(elem, 300, 500); // Scroll should do nothing – map is not activated
        await sleep(1000);
        await assertLatLng([47.62, 0.1], [-122.3492, 0.1]);
        await elem.click();
        await sleep(1000);

        await mapDriver.scroll(elem, 300, 500);
        await sleep(2000);
        await assertLatLng([47.606408, 0.1], [-122.336721, 0.1]);
    });

    async function getIframeCoords() {
        const largerMapLink = await driver.wait(until.elementLocated(By.css(".google-maps-link a, a.google-maps-link")));
        const href = await largerMapLink.getAttribute("href");
        const linkUrl = new URL(href);
        return linkUrl.searchParams.get('ll').split(',', 2).map(Number);
    }

    async function getIframeZoom() {
        const largerMapLink = await driver.wait(until.elementLocated(By.css(".google-maps-link a, a.google-maps-link")));
        const href = await largerMapLink.getAttribute("href");
        const linkUrl = new URL(href);
        return Number(linkUrl.searchParams.get('z'));
    }
});
