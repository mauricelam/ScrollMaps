import assert from 'assert';
import { By } from 'selenium-webdriver';
import { MapDriver, assertIn, sleep } from '../mapdriver.js';

const TEST_TIMEOUT = 10 * 60 * 1000;


describe('heywhatsthat test suite', function() {
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
    });

    it('https://www.heywhatsthat.com/?view=P5XIGCII', async () => {
        await driver.get('https://www.heywhatsthat.com/?view=P5XIGCII');

        await sleep(2000);
        let elem = await mapDriver.activateAndWaitForScrollMapsLoaded();
        // Execute scroll action
        await mapDriver.scrollIntoView(elem);
        await mapDriver.assertRuler('5 km');

        // This scroll is a no-op, since we haven't clicked the map yet
        // It wouldn't scroll the page because the event is not trusted
        await mapDriver.scroll(elem, 0, -300);
        await mapDriver.click();
        await assertLatLng([24.325, 0.01], [120.700, 0.01]);
        await mapDriver.click();
        await sleep(1000);
        await assertLatLng([24.2627, 0.01], [120.7684, 0.01]);

        await mapDriver.scroll(elem, 0, -300);
        await mapDriver.click();
        await sleep(2000);
        await assertLatLng([24.608488, 0.01], [120.769135, 0.01]);
        await mapDriver.assertRuler('5 km');

        // Execute zoom action
        await mapDriver.pinchGesture(elem, 64);
        await sleep(2000);
        await mapDriver.click({ x: 150, y: 80 });
        await sleep(1000);
        await mapDriver.assertRuler('20 km');
        await assertLatLng([24.470446, 0.1], [121.11218, 0.01]);
    });

    async function getLatLng() {
        const latlng = await driver.wait(async () => driver.findElement(By.id('map_latlon_div')), 10000);
        const text = await latlng.getText();
        const pattern = /([\d.]+) N ([\d.]+) E/;
        const match = pattern.exec(text);
        if (!match) throw new Error(`Text "${text}" does not match lat lng pattern`);
        console.log('Got latitude, longitude =', text)
        const [_, lat, lng] = match.map(Number);
        return [lat, lng];
    }

    async function assertLatLng(expectedLat, expectedLng) {
        const [lat, lng] = await getLatLng();
        assertIn(lat, expectedLat);
        assertIn(lng, expectedLng);
    }
});
