const assert = require('assert');
const webdriver = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const firefox = require('selenium-webdriver/firefox');
const process = require('process');
require('chromedriver');
require('geckodriver');

const By = webdriver.By;

const TEST_TIMEOUT = 10 * 60 * 1000;


describe('google.com/maps test suite', function() {
    this.slow(TEST_TIMEOUT);
    this.timeout(TEST_TIMEOUT);
    let driver;

    beforeEach(async () => {
        if (process.env.BROWSER === 'chrome') {
            driver = new webdriver.Builder()
                .forBrowser('chrome')
                .setChromeOptions(
                    new chrome.Options()
                        .addArguments(`load-extension=${process.cwd()}/gen/plugin-10000`)
                )
                .build();
        } else if (process.env.BROWSER === 'firefox') {
            driver = new webdriver.Builder()
                .forBrowser('firefox')
                .setFirefoxOptions(new firefox.Options())
                .build();
            await driver.installAddon(`${process.cwd()}/gen/scrollmaps-10000.zip`, true)
        } else {
            throw 'Environment variable $BROWSER not defined';
        }
    });
    afterEach(async () => {
        await driver.quit();
    })

    it('google.com/maps (while loading)', async () => {
        // While loading, Google Maps shows a version that's not fully 3D, which
        // sometimes causes subtle bugs in ScrollMaps.
        await driver.get('https://www.google.com/maps/@37,-122,14z?force=webgl');
        const elem = await waitForScrollMapsLoaded();
        // Execute scroll action
        await scroll(elem, 300, 500);
        await driver.wait(async () => {
            const [lat, lng, zoom] = await getLatLngZoom();
            console.log('lat, lng, zoom =', lat, lng, zoom);
            return lat.between(36.9, 36.97) && lng.between(-121.98, -121.9) && zoom === 14;
        }, 10000);

        // Execute zoom action
        await pinchGesture(elem, 120);
        await driver.wait(async () => {
            const [lat, lng, zoom] = await getLatLngZoom();
            console.log('lat, lng, zoom =', lat, lng, zoom);
            return lat.between(36.9, 36.97) && lng.between(-121.98, -121.9) && zoom.between(8, 11);
        }, 10000);

        await pinchGesture(elem, -120);
        await driver.wait(async () => {
            const [lat, lng, zoom] = await getLatLngZoom();
            console.log('lat, lng, zoom =', lat, lng, zoom);
            return lat.between(36.9, 36.97) && lng.between(-121.98, -121.9) && zoom.between(13, 15);
        }, 10000);
    });

    it('google.com/maps', async () => {
        await driver.get('https://www.google.com/maps/@37,-122,14z?force=webgl');
        const elem = await waitForCanvasMapsLoaded('webgl');
        // Execute scroll action
        await scroll(elem, 300, 500);
        await driver.wait(async () => {
            const [lat, lng, zoom] = await getLatLngZoom();
            console.log('lat, lng, zoom =', lat, lng, zoom);
            return lat.between(36.9, 36.97) && lng.between(-121.98, -121.9) && zoom === 14;
        }, 10000);
        // Execute zoom action
        await pinchGesture(elem, 120);
        await driver.wait(async () => {
            const [lat, lng, zoom] = await getLatLngZoom();
            console.log('lat, lng, zoom =', lat, lng, zoom);
            return lat.between(36.9, 36.97) && lng.between(-121.98, -121.9) && zoom.between(8, 11);
        }, 10000);

        await pinchGesture(elem, -120);
        await driver.wait(async () => {
            const [lat, lng, zoom] = await getLatLngZoom();
            console.log('lat, lng, zoom =', lat, lng, zoom);
            return lat.between(36.9, 36.97) && lng.between(-121.98, -121.9) && zoom.between(13, 15);
        }, 10000);
    });

    it('google.com/maps (canvas)', async () => {
        await driver.get('https://www.google.com/maps/@37,-122,14z?force=canvas');
        const elem = await waitForCanvasMapsLoaded('2d');
        // Execute scroll action
        await scroll(elem, 300, 500);
        await driver.wait(async () => {
            const [lat, lng, zoom] = await getLatLngZoom();
            console.log('lat, lng, zoom =', lat, lng, zoom);
            return lat.between(36.9, 36.97) && lng.between(-121.98, -121.9) && zoom === 14;
        }, 10000);
        // Execute zoom action
        await pinchGesture(elem, 120);
        await driver.wait(async () => {
            const [lat, lng, zoom] = await getLatLngZoom();
            console.log('lat, lng, zoom =', lat, lng, zoom);
            return lat.between(36.9, 36.97) && lng.between(-121.98, -121.9) && zoom.between(8, 11);
        }, 10000);

        await pinchGesture(elem, -120);
        await driver.wait(async () => {
            const [lat, lng, zoom] = await getLatLngZoom();
            console.log('lat, lng, zoom =', lat, lng, zoom);
            return lat.between(36.9, 36.97) && lng.between(-121.98, -121.9) && zoom.between(13, 15);
        }, 10000);
    });

    async function waitForScrollMapsLoaded() {
        // Wait for the URL to be in the expected format
        await driver.wait(async () => (await getLatLngZoom())[0], 10000);
        // ScrollMaps should be activated automatically
        const elem = await driver.findElement(By.css('[data-scrollmaps]'));
        await driver.wait(async () => await elem.getAttribute('data-scrollmaps') === 'enabled', 10000);
        return elem;
    }

    async function waitForCanvasMapsLoaded(contextType) {
        // The webGL mode of maps takes a while to load
        const elem = await waitForScrollMapsLoaded();
        const r = await elem.getRect();
        await driver.wait(async () => {
            return await driver.executeScript((r, contextType) => {
                const clientX = r.x + r.width / 2;
                const clientY = r.y + r.height / 2;
                const pointElem = document.elementFromPoint(clientX, clientY);
                console.log('pointElem', pointElem);
                return pointElem instanceof HTMLCanvasElement && !!pointElem.getContext(contextType);
            }, r, contextType);
        }, 10000);
        return elem;
    }

    async function getLatLngZoom() {
        const url = await driver.getCurrentUrl();
            const pattern = new RegExp('https://.*/@(-?[\\d\\.]+),(-?[\\d\\.]+),([\\d\\.]+)z');
            const match = pattern.exec(url);
            if (!match) return [undefined, undefined, undefined];
            const lat = Number(match[1]);
            const lng = Number(match[2]);
            const zoom = Number(match[3]);
            return [lat, lng, zoom];
    }

    async function pinchGesture(elem, deltaY, opts = {}) {
        return await scroll(elem, 0, deltaY, {ctrlKey: true, ...opts})
    }

    async function scroll(elem, dx, dy, opts = {}) {
        const r = await elem.getRect();
        console.log('scrolling dy', dy);
        await driver.executeAsyncScript(async (r, dx, dy, opts, done) => {
            try {
                console.log('dy', dy);
                const clientX = r.x + r.width / 2;
                const clientY = r.y + r.height / 2;
                const pointElem = document.elementFromPoint(clientX, clientY);
                const sleep = (t) => new Promise((resolve, reject) => setTimeout(resolve, t));
                const wheel = (dx, dy) => {
                    console.log('Dispatching wheel event', dx, dy);
                    pointElem.dispatchEvent(new WheelEvent('wheel', {
                        view: window,
                        bubbles: true,
                        cancelable: true,
                        clientX: clientX,
                        clientY: clientY,
                        deltaX: dx,
                        deltaY: dy,
                        ...opts
                    }));
                };
                for (let i = 0; i < 10; i++) {
                    wheel(dx / 10, dy / 10);
                    await sleep(50);
                }
            } finally {
                done();
            }
        }, r, dx, dy, opts);
    }

    Number.prototype.between = function (min, max) {
        return this >= min && this <= max;
    };
});
