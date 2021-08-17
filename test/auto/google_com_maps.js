const MapDriver = require('../mapdriver.js').MapDriver;

const TEST_TIMEOUT = 10 * 60 * 1000;


describe('google.com/maps test suite', function() {
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

    it('google.com/maps (while loading)', async () => {
        // While loading, Google Maps shows a version that's not fully 3D, which
        // sometimes causes subtle bugs in ScrollMaps.
        await driver.get('https://www.google.com/maps/@37,-122,14z?force=webgl');
        const elem = await mapDriver.waitForScrollMapsLoaded();
        // Execute scroll action
        await mapDriver.scroll(elem, 300, 500);
        await mapDriver.assertUrlParams({
            lat: [36.9, 36.97],
            lng: [-121.98, -121.9],
            zoom: [14, 14]
        });

        // Execute zoom action
        await mapDriver.pinchGesture(elem, 120);
        await mapDriver.assertUrlParams({
            lat: [36.9, 36.97],
            lng: [-121.98, -121.9],
            zoom: [8, 11]
        });

        await mapDriver.pinchGesture(elem, -120);
        await mapDriver.assertUrlParams({
            lat: [36.9, 36.97],
            lng: [-121.98, -121.9],
            zoom: [13, 15]
        });
    });

    it('google.com/maps', async () => {
        await driver.get('https://www.google.com/maps/@37,-122,14z?force=webgl');
        const elem = await mapDriver.waitForCanvasMapsLoaded('webgl');
        // Execute scroll action
        await mapDriver.scroll(elem, 300, 500);
        await mapDriver.assertUrlParams({
            lat: [36.9, 36.97],
            lng: [-121.98, -121.9],
            zoom: [14, 14]
        });
        // Execute zoom action
        await mapDriver.pinchGesture(elem, 120);
        await mapDriver.assertUrlParams({
            lat: [36.9, 36.97],
            lng: [-121.98, -121.9],
            zoom: [8, 11]
        });

        await mapDriver.pinchGesture(elem, -120);
        await mapDriver.assertUrlParams({
            lat: [36.9, 36.97],
            lng: [-121.98, -121.9],
            zoom: [13, 15]
        });
    });

    it('google.com/maps (canvas)', async () => {
        await driver.get('https://www.google.com/maps/@37,-122,14z?force=canvas');
        const elem = await mapDriver.waitForCanvasMapsLoaded('2d');
        // Execute scroll action
        await mapDriver.scroll(elem, 300, 500);
        await mapDriver.assertUrlParams({
            lat: [36.9, 36.97],
            lng: [-121.98, -121.9],
            zoom: [14, 14]
        });
        // Execute zoom action
        await mapDriver.pinchGesture(elem, 120);
        await mapDriver.assertUrlParams({
            lat: [36.9, 36.97],
            lng: [-121.98, -121.9],
            zoom: [8, 11]
        });

        await mapDriver.pinchGesture(elem, -120);
        await mapDriver.assertUrlParams({
            lat: [36.9, 36.97],
            lng: [-121.98, -121.9],
            zoom: [13, 15]
        });
    });
});
