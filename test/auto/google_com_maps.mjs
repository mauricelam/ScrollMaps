import { MapDriver, sleep } from '../mapdriver.js';

const TEST_TIMEOUT = 10 * 60 * 1000;


describe('google.com/maps test suite', function () {
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

    it('google.com/maps (while loading)', async () => {
        // While loading, Google Maps shows a version that's not fully 3D, which
        // sometimes causes subtle bugs in ScrollMaps.
        await driver.get('https://www.google.com/maps/@37,-122,14z?force=webgl');
        await mapDriver.activateForGoogleDomain();
        const elem = await mapDriver.waitForScrollMapsLoaded();
        // Execute scroll action
        await mapDriver.scroll(elem, 300, 500);
        await assertUrlParams({
            lat: [36.9, 36.97],
            lng: [-121.98, -121.9],
            zoom: [14, 14],
            logTag: "while loading",
        });

        // Execute zoom action
        await mapDriver.pinchGesture(elem, 64);
        await assertUrlParams({
            lat: [36.9, 36.97],
            lng: [-121.98, -121.9],
            zoom: [5, 11]
        });

        await mapDriver.pinchGesture(elem, -64);
        await assertUrlParams({
            lat: [36.9, 36.97],
            lng: [-121.98, -121.9],
            zoom: [13, 15],
            logTag: "after pinch"
        });
    });

    it('google.com/maps', async () => {
        await driver.get('https://www.google.com/maps/@37,-122,14z?force=webgl');
        await mapDriver.activateForGoogleDomain();
        const elem = await mapDriver.waitForCanvasMapsLoaded('webgl');
        // Execute scroll action
        await mapDriver.scroll(elem, 300, 500);
        await assertUrlParams({
            lat: [36.9, 36.97],
            lng: [-121.98, -121.9],
            zoom: [14, 14],
            logTag: "After scrolling",
        });
        // Execute zoom action
        await mapDriver.pinchGesture(elem, 64);
        await assertUrlParams({
            lat: [36.9, 36.97],
            lng: [-121.98, -121.9],
            zoom: [5, 11],
            logTag: "After pinch zoom in",
        });

        await mapDriver.pinchGesture(elem, -64);
        await assertUrlParams({
            lat: [36.9, 36.97],
            lng: [-121.98, -121.9],
            zoom: [13, 15],
            logTag: "After pinch zoom out",
        });
    });

    it('google.com/maps (canvas)', async () => {
        await driver.get('https://www.google.com/maps/@37,-122,14z?force=canvas');
        await mapDriver.activateForGoogleDomain();
        const elem = await mapDriver.waitForCanvasMapsLoaded('2d');
        // Execute scroll action
        await mapDriver.scroll(elem, 300, 500);
        await assertUrlParams({
            lat: [36.9, 36.97],
            lng: [-121.98, -121.9],
            zoom: [14, 14],
            logTag: "canvas: after scroll",
        });
        // Execute zoom action
        await mapDriver.pinchUntil(elem, 64, async () => await isUrlCoordsWithin({
            lat: [36.9, 36.97],
            lng: [-121.98, -121.9],
            zoom: [5, 7],
        }));

        await mapDriver.pinchUntil(elem, -64, async () => await isUrlCoordsWithin({
            lat: [36.9, 36.97],
            lng: [-121.98, -121.9],
            zoom: [16, 20],
        }));
    });

    async function getUrlLatLngZoom() {
        const url = await driver.getCurrentUrl();
        const pattern = new RegExp('https://.*/@(-?[\\d\\.]+),(-?[\\d\\.]+),([\\d\\.]+)z.*');
        const match = pattern.exec(url);
        if (!match) return [undefined, undefined, undefined];
        const [_, lat, lng, zoom] = match.map(Number);
        return { lat: lat, lng: lng, zoom: zoom };
    }

    async function isUrlCoordsWithin({ lat, lng, zoom }) {
        const rangeContains = ([min, max], val) => min <= val && val <= max;
        const urlParams = await getUrlLatLngZoom();
        console.log('URL params=', urlParams);
        return rangeContains(lat, urlParams.lat) &&
            rangeContains(lng, urlParams.lng) &&
            rangeContains(zoom, urlParams.zoom);
    }

    async function assertUrlParams({ lat, lng, zoom, logTag }) {
        for (let i = 0; i < 10; i++) {
            if (await isUrlCoordsWithin({ lat, lng, zoom, logTag })) {
                return;
            }
            await sleep(1000);
        }
        throw new Error(`[${logTag}] Failed to wait for URL params to be within range ${lat} ${lng} ${zoom}`);
    }
});
