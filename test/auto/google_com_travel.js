const assert = require('assert');
const webdriver = require('selenium-webdriver');
const By = webdriver.By;
const MapDriver = require('../mapdriver.js').MapDriver;
const sleep = MapDriver.sleep;

const TEST_TIMEOUT = 10 * 60 * 1000;


describe('google.com/travel test suite', function() {
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
    })

    it('google.com/travel/explore', async () => {
        // While loading, Google Maps shows a version that's not fully 3D, which
        // sometimes causes subtle bugs in ScrollMaps.
        await driver.get('https://www.google.com/travel/explore');
        await mapDriver.activateForGoogleDomain();
        const elem = await mapDriver.waitForScrollMapsLoaded();
        // Execute scroll action
        await waitForCities(['Chicago']);
        await sleep(2000);
        await mapDriver.scroll(elem, 300, -40);
        await waitForCities(['London']);
        assert.deepStrictEqual(
            await findCities(['Chicago', 'London', 'Paris', 'Beijing']),
            ['London', 'Paris']);

        // Execute zoom action
        await mapDriver.pinchGesture(elem, 32);
        await waitForCities(['Chicago', 'London', 'Moscow']);

        await mapDriver.pinchGesture(elem, -32);
        await sleep(2000);
        assert.deepStrictEqual(
            await findCities(['Chicago', 'London', 'Paris', 'Beijing']),
            ['London', 'Paris']);
    });

    async function findCities(cities) {
        const xpath = cities.map(city => `//*[text()='${city}']`).join('|');
        const elems = await driver.findElements(By.xpath(xpath));
        const result = await Promise.all(elems.map(async elem => {
            try {
                return await elem.getText();
            } catch (e) {
                return `ERROR: ${e}`;
            }
        }));
        return [...new Set(result.filter(x => x))].sort();
    }

    async function waitForCities(cities) {
        process.stdout.write('Waiting for cities ');
        return await driver.wait(async () => {
            const elems = await findCities(cities);
            if (elems.length) {
                console.log(elems);
                return elems;
            } else {
                process.stdout.write('.');
                return null;
            }
        }, 10000, `Cannot find cities ${cities}`);
    }
});
