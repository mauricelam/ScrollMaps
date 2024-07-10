import assert from 'assert';
import { By } from 'selenium-webdriver';
import { MapDriver, assertIn, sleep } from '../mapdriver.js';

const TEST_TIMEOUT = 10 * 60 * 1000;


describe('travelermap test suite', function() {
    this.retries(0);
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
    });

    it('https://travelermap.net/parks/usa', async () => {
        await driver.get('https://travelermap.net/parks/usa#map=10.2/37.6926/-121.9915');
        await sleep(1000);

        let mapButton = await mapDriver.driver.findElement(By.id("js__traveler-mobile-map-toggle"));
        await mapButton.click();

        let elem = await mapDriver.activateAndWaitForScrollMapsLoaded();
        await assertZoomLatLng([10.2, 0], [37.6926, 0.01], [-121.9915, 0.01]);

        // // This scroll is a no-op, since we haven't clicked the map yet
        // // It wouldn't scroll the page because the event is not trusted
        await mapDriver.scroll(elem, 0, -300);
        await sleep(2500);
        await assertZoomLatLng([10.2, 0], [38.3708, 0.05], [-121.9915, 0.05]);

        await mapDriver.scroll(elem, 300, 300);
        await sleep(2500);
        await assertZoomLatLng([10.2, 0], [37.585, 0.05], [-120.9879, 0.05]);

        // // Execute zoom action
        await mapDriver.pinchGesture(elem, 64);
        await sleep(1000);
        await assertZoomLatLng([9.51, 0], [37.585, 0.05], [-120.9879, 0.05]);
    });

    async function getUrlLatLngZoom() {
        const url = await driver.getCurrentUrl();
        const pattern = new RegExp('https://.*#map=(-?[\\d\\.]+)/(-?[\\d\\.]+)/(-?[\\d\\.]+).*');
        const match = pattern.exec(url);
        if (!match) return {};
        const [_, zoom, lat, lng] = match.map(Number);
        return { lat, lng, zoom };
    }

    async function assertZoomLatLng(expectedZoom, expectedLat, expectedLng) {
        const { lat, lng, zoom } = await getUrlLatLngZoom();
        assertIn(zoom, expectedZoom);
        assertIn(lat, expectedLat);
        assertIn(lng, expectedLng);
    }
});
