const assert = require('assert');
const webdriver = require('selenium-webdriver');
const By = webdriver.By;
const MapDriver = require('../mapdriver.js').MapDriver;
const sleep = MapDriver.sleep;

const TEST_TIMEOUT = 10 * 60 * 1000;


describe('heywhatsthat test suite', function() {
    this.retries(3);
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
        await assertLatLng({ lat: 24.325, lng: 120.700 });
        await mapDriver.click();
        await sleep(1000);
        await assertLatLng({ lat: 24.2627, lng: 120.7684 });

        await mapDriver.scroll(elem, 0, -300);
        await mapDriver.click();
        await sleep(2000);
        await assertLatLng({ lat: 24.6203, lng: 120.7684 });
        await mapDriver.assertRuler('5 km');

        // Execute zoom action
        await mapDriver.pinchGesture(elem, 32);
        await sleep(2000);
        await mapDriver.click({ x: 150, y: 80 });
        await sleep(1000);
        await assertLatLng({ lat: 24.482945, lng: 121.112457, tolerance: 0.05 });
        await mapDriver.assertRuler('20 km');
    });

    const TOLERANCE = 0.001;  // Tolerate 0.001' error

    async function assertLatLng({lat: expectedLat, lng: expectedLng, tolerance = TOLERANCE}) {
        const latlng = await driver.wait(async () => driver.findElement(By.id('map_latlon_div')), 10000);
        const text = await latlng.getText();
        const pattern = /([\d.]+) N ([\d.]+) E/;
        const match = pattern.exec(text);
        if (!match) throw new Error(`Text "${text}" does not match lat lng pattern`);
        console.log('Got latitude, longitude =', text)
        const [_, lat, lng] = match.map(Number);
        const minLat = expectedLat - tolerance;
        const maxLat = expectedLat + tolerance;
        const minLng = expectedLng - tolerance;
        const maxLng = expectedLng + tolerance;
        const errorMsg = `[${lat}, ${lng}] should be within [[${minLat}, ${maxLat}], [${minLng}, ${maxLng}]]`;
        assert(minLat <= lat && lat <= maxLat, errorMsg)
        assert(minLng <= lng && lng <= maxLng, errorMsg)
    }
});
