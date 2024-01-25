import assert from 'assert';
import { MapDriver, sleep } from '../mapdriver.js';
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
        }, 10000);
        await driver.executeScript((frameElem) =>
            frameElem.scrollIntoView({ behavior: 'instant', block: 'center' }), frameElem);
        await driver.switchTo().frame(frameElem);
        const elem = await mapDriver.waitForScrollMapsLoaded();
        await assertLatLng({ lat: 47.62, lng: -122.3492 });
        await mapDriver.scroll(elem, 300, 500); // Scroll should do nothing – map is not activated
        await sleep(1000);
        await assertLatLng({ lat: 47.62, lng: -122.3492 });
        await elem.click();
        await sleep(1000);

        await mapDriver.scroll(elem, 300, 500);
        await sleep(2000);
        await assertLatLng({ lat: 47.6064, lng: -122.3367 });
    });

    async function getIframeCoords() {
        const largerMapLink = await driver.wait(until.elementLocated(By.css(".google-maps-link a")));
        const href = await largerMapLink.getAttribute("href");
        const linkUrl = new URL(href);
        return linkUrl.searchParams.get('ll').split(',', 2).map(Number);
    }

    async function getIframeZoom() {
        const largerMapLink = await driver.wait(until.elementLocated(By.css(".google-maps-link a")));
        const href = await largerMapLink.getAttribute("href");
        const linkUrl = new URL(href);
        return Number(linkUrl.searchParams.get('z'));
    }

    const TOLERANCE = 0.001;  // Tolerate 0.001' error

    async function assertLatLng({ lat: expectedLat, lng: expectedLng, tolerance = TOLERANCE }) {
        const [lat, lng] = await getIframeCoords();
        console.log('iframe latlng', lat, lng)
        const minLat = expectedLat - tolerance;
        const maxLat = expectedLat + tolerance;
        const minLng = expectedLng - tolerance;
        const maxLng = expectedLng + tolerance;
        const latErrorMsg = `Latitude of [${lat}, ${lng}] should be within [${minLat}, ${maxLat}]`;
        const lngErrorMsg = `Longitude of [${lat}, ${lng}] should be within [${minLng}, ${maxLng}]`;
        assert(minLat <= lat && lat <= maxLat, latErrorMsg);
        assert(minLng <= lng && lng <= maxLng, lngErrorMsg);
    }
});
