const webdriver = require('selenium-webdriver');
const process = require('process');
const child_process = require('child_process');

const By = webdriver.By;


class MapDriver {
    static async create() {
        let driver;
        let resolvePid;
        let pid = new Promise((resolve, reject) => { resolvePid = resolve; });
        if (process.env.BROWSER === 'chrome') {
            const _spawn = child_process.spawn;
            child_process.spawn = (...args) => {
                const proc = _spawn(...args);
                resolvePid(proc.pid);
                return proc;
            };
            const chrome = require('selenium-webdriver/chrome');
            require('chromedriver');
            driver = new webdriver.Builder()
                .forBrowser('chrome')
                .setChromeOptions(
                    new chrome.Options()
                        .addArguments(`load-extension=${process.cwd()}/gen/plugin-10000-chrome`, 'window-size=800,600')
                )
                .build();
        } else if (process.env.BROWSER === 'edge') {
            const edge = require('selenium-webdriver/edge');
            const edgePaths = await require('ms-chromium-edge-driver').installDriver();
            driver = new webdriver.Builder()
                .forBrowser('MicrosoftEdge')
                .setEdgeOptions(
                    new edge.Options()
                        .addArguments(`load-extension=${process.cwd()}/gen/plugin-10000-edge`, 'window-size=800,600')
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
            await driver.installAddon(`${process.cwd()}/gen/scrollmaps-10000-firefox.zip`, true)
        } else {
            throw new Error('Environment variable $BROWSER not defined');
        }
        return new MapDriver(driver, await pid);
    }

    constructor(driver, pid) {
        this.driver = driver;
        this.pid = pid;
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

    async scrollIntoView(elem) {
        await this.driver.executeScript((elem) => elem.scrollIntoView(), elem);
    }

    async scroll(elem, dx, dy, opts = {}) {
        const r = await elem.getRect();
        console.log('scrolling', dx, dy);
        await this.driver.executeAsyncScript(async (elem, r, dx, dy, opts, done) => {
            try {
                console.log('dy', dy);
                const clientX = r.x + r.width / 2 - document.documentElement.scrollLeft;
                const clientY = r.y + r.height / 2 - document.documentElement.scrollTop;
                const pointElem = document.elementFromPoint(clientX, clientY);
                if (pointElem === null) {
                    done(new Error('pointElem is null'));
                }
                console.log('pointElem', elem, pointElem);
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
        }, elem, r, dx, dy, opts);
    }

    clickBrowserAction() {
        return new Promise((resolve, reject) => {
            console.log(`Clicking browser action on process ${this.pid}`);
            child_process.exec(
                'test/chrome_browser_action.js',
                {env: {'TEST_PROCESS': this.pid}},
                (err, stdout, stderr) => {
                    if (stdout) console.log(`browseraction: ${stdout.trim()}`);
                    if (stderr) console.warn(`browseraction: ${stderr.trim()}`);
                    err ? reject(err) : resolve(stdout);
                });
        });
    }
}

exports.MapDriver = MapDriver;
