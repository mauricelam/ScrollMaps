const assert = require('assert');
const webdriver = require('selenium-webdriver');
const By = webdriver.By;
const MapDriver = require('../mapdriver.js').MapDriver;
const sleep = MapDriver.sleep;
const process = require('process');

const TEST_TIMEOUT = 10 * 60 * 1000;


describe('heywhatsthat test suite', function() {
    // this.retries(5);
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
    afterEach(async function () {
        if (this.currentTest.state === 'failed' && process.env.DEBUG === '1') {
            await sleep(10000000);
        }
    });

    it('https://www.heywhatsthat.com/?view=P5XIGCII', async () => {
        await driver.get('https://www.heywhatsthat.com/?view=P5XIGCII');

        await sleep(2000);
        await mapDriver.clickBrowserAction();
        let elem = await mapDriver.waitForScrollMapsLoaded();
        // Execute scroll action
        await mapDriver.scrollIntoView(elem);
        await assertRuler(elem, '5 km');

        // This scroll is a no-op, since we haven't clicked the map yet
        // It wouldn't scroll the page because the event is not trusted
        await mapDriver.scroll(elem, 0, -300);
        await clickMap(elem);
        await assertLatLng({ lat: 24.325, lng: 120.700 });
        await clickMap(elem);
        await sleep(1000);
        await assertLatLng({ lat: 24.2627, lng: 120.7684 });

        await mapDriver.scroll(elem, 0, -300);
        await clickMap(elem);
        await sleep(2000);
        await assertLatLng({ lat: 24.6203, lng: 120.7684 });
        await assertRuler(elem, '5 km');

        // Execute zoom action
        await mapDriver.pinchGesture(elem, 32);
        await sleep(2000);
        elem = await mapDriver.waitForScrollMapsLoaded();
        await clickMap(elem, { x: 150, y: 150 });
        await sleep(1000);
        await assertLatLng({ lat: 24.3078, lng: 121.1124, tolerance: 0.02 });
        await assertRuler(elem, '20 km');
    });

    async function clickMap(elem, { x = 100, y = 100 } = {}) {
        console.log('clicky', x, y);
        await driver.actions({ bridge: true })
            .move({ origin: elem, x: x, y: y, duration: 0 })
            .click()
            .perform();
    }

    const TOLERANCE = 0.001;  // Tolerate 0.001' error

    async function assertLatLng({lat: expectedLat, lng: expectedLng, tolerance = TOLERANCE}) {
        const latlng = await driver.wait(async () => driver.findElement(By.id('map_latlon_div')), 10000);
        const text = await latlng.getText();
        const pattern = /([\d.]+) N ([\d.]+) E/;
        const match = pattern.exec(text);
        if (!match) throw new Error(`Text "${text}" does not match lat lng pattern`);
        console.log('text', text)
        const [_, lat, lng] = match.map(Number);
        const minLat = expectedLat - tolerance;
        const maxLat = expectedLat + tolerance;
        const minLng = expectedLng - tolerance;
        const maxLng = expectedLng + tolerance;
        const errorMsg = `[${lat}, ${lng}] should be within [[${minLat}, ${maxLat}], [${minLng}, ${maxLng}]]`;
        assert(minLat <= lat && lat <= maxLat, errorMsg)
        assert(minLng <= lng && lng <= maxLng, errorMsg)
    }

    /**
     * Check against the ruler at the bottom to see if the zoom level is roughly as expected.
     */
    async function assertRuler(elem, expectedKm) {
        const km = await driver.wait(async () =>
            elem.findElement(By.xpath('//*[@class="gm-style-cc"]//*[contains(text(), "km")]')), 10000);
        const kmText = await km.getText();
        assert.equal(kmText.trim(), expectedKm);
    }
});
