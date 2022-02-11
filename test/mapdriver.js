const webdriver = require('selenium-webdriver');
const process = require('process');

const By = webdriver.By;


class MapDriver {
    static async create() {
        let driver;
        if (process.env.BROWSER === 'chrome') {
            const chrome = require('selenium-webdriver/chrome');
            require('chromedriver');
            driver = new webdriver.Builder()
                .forBrowser('chrome')
                .setChromeOptions(
                    new chrome.Options()
                        .addArguments(`load-extension=${process.cwd()}/gen/plugin-10000`, 'window-size=800,600')
                )
                .build();
        } else if (process.env.BROWSER === 'edge') {
            const edge = require('selenium-webdriver/edge');
            const edgePaths = await require('ms-chromium-edge-driver').installDriver();
            driver = new webdriver.Builder()
                .forBrowser('MicrosoftEdge')
                .setEdgeOptions(
                    new edge.Options()
                        .addArguments(`load-extension=${process.cwd()}/gen/plugin-10000`, 'window-size=800,600')
                )
                .setEdgeService(new edge.ServiceBuilder(edgePaths.driverPath))
                .build();
        } else if (process.env.BROWSER === 'firefox') {
            const firefox = require('selenium-webdriver/firefox');
            require('geckodriver');
            driver = new webdriver.Builder()
                .forBrowser('firefox')
                .setFirefoxOptions(new firefox.Options().windowSize({width: 800, height: 600}))
                .build();
            await driver.installAddon(`${process.cwd()}/gen/scrollmaps-10000.zip`, true)
        } else {
            throw new Error('Environment variable $BROWSER not defined');
        }
        return new MapDriver(driver);
    }

    constructor(driver) {
        this.driver = driver;
    }

    async quit() {
        await this.driver.quit();
    }

    async assertUrlParams(rangeConfig) {
        const rangeContains = (range, val) => val >= range[0] && val <= range[1];
        await this.driver.wait(async () => {
            const [lat, lng, zoom] = await this.getUrlLatLngZoom();
            console.log('lat, lng, zoom =', lat, lng, zoom);
            return rangeContains(rangeConfig.lat, lat) &&
                rangeContains(rangeConfig.lng, lng) &&
                rangeContains(rangeConfig.zoom, zoom);
        }, 10000);
    }

    async waitForScrollMapsLoaded() {
        // ScrollMaps should be activated automatically
        const elem = await this.driver.wait(async () => {
            return (await this.driver.findElements(By.css('[data-scrollmaps]')))[0];
        }, 10000);
        console.log('elem', elem)
        await this.driver.wait(async () => await elem.getAttribute('data-scrollmaps') === 'enabled', 10000);
        return elem;
    }

    async waitForCanvasMapsLoaded(contextType) {
        // The webGL mode of maps takes a while to load
        const elem = await this.waitForScrollMapsLoaded();
        const r = await elem.getRect();
        await this.driver.wait(async () => {
            return await this.driver.executeScript((r, contextType) => {
                const clientX = r.x + r.width / 2;
                const clientY = r.y + r.height / 2;
                const pointElem = document.elementFromPoint(clientX, clientY);
                console.log('pointElem', pointElem);
                return pointElem instanceof HTMLCanvasElement && !!pointElem.getContext(contextType);
            }, r, contextType);
        }, 10000);
        return elem;
    }

    async getUrlLatLngZoom() {
        const url = await this.driver.getCurrentUrl();
            const pattern = new RegExp('https://.*/@(-?[\\d\\.]+),(-?[\\d\\.]+),([\\d\\.]+)z');
            const match = pattern.exec(url);
            if (!match) return [undefined, undefined, undefined];
            const lat = Number(match[1]);
            const lng = Number(match[2]);
            const zoom = Number(match[3]);
            return [lat, lng, zoom];
    }

    async pinchGesture(elem, deltaY, opts = {}) {
        return await this.scroll(elem, 0, deltaY, {ctrlKey: true, ...opts})
    }

    async scroll(elem, dx, dy, opts = {}) {
        const r = await elem.getRect();
        console.log('scrolling dy', dy);
        await this.driver.executeAsyncScript(async (r, dx, dy, opts, done) => {
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
                for (let i = 0; i < 30; i++) {
                    wheel(dx / 30, dy / 30);
                    await sleep(50);
                }
            } finally {
                done();
            }
        }, r, dx, dy, opts);
    }
}

exports.MapDriver = MapDriver;
