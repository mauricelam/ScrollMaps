const assert = require('assert');
const webdriver = require('selenium-webdriver');
const By = webdriver.By;
const MapDriver = require('../mapdriver.js').MapDriver;

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
    })

    it('https://www.heywhatsthat.com/?view=P5XIGCII', async () => {
        // While loading, Google Maps shows a version that's not fully 3D, which
        // sometimes causes subtle bugs in ScrollMaps.
        await driver.get('https://www.heywhatsthat.com/?view=P5XIGCII');
        await sleep(1000);
        await mapDriver.clickBrowserAction();
        const latlng = driver.findElement(By.id('map_latlon_div'));
        const elem = await mapDriver.waitForScrollMapsLoaded();
        // Execute scroll action
        await mapDriver.scrollIntoView(elem);
        // This scroll is a no-op, since we haven't clicked the map yet
        await mapDriver.scroll(elem, 0, -300);
        await elem.click();
        assert.equal(await latlng.getText(), '24.32537 N 120.70047 E');
        await elem.click();
        assert.equal(await latlng.getText(), '24.36916 N 120.70047 E');
        await sleep(2000);

        await mapDriver.scroll(elem, 0, -300);
        await elem.click();
        await sleep(2000);
        assert.equal(await latlng.getText(), '24.725174 N 120.70047 E');

        // Execute zoom action
        await mapDriver.pinchGesture(elem, 32);
        await sleep(1000);
        await elem.click();
        assert.equal(await latlng.getText(), '24.856081 N 120.70047 E');
    });

    function sleep(timeout) {
        return new Promise((resolve, reject) => setTimeout(resolve, timeout));
    }
});
