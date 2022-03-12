const webdriver = require('selenium-webdriver');
const process = require('process');
const child_process = require('child_process');
const assert = require('assert');

let chrome, firefox, edge;
if (process.env.BROWSER === 'chrome') {
    chrome = require('selenium-webdriver/chrome');
    require('chromedriver');
} else if (process.env.BROWSER === 'firefox') {
    firefox = require('selenium-webdriver/firefox');
    require('geckodriver');
} else if (process.env.BROWSER === 'edge') {
    edge = require('selenium-webdriver/edge');
    edge.driverModule = require('ms-chromium-edge-driver');
}

const By = webdriver.By;


class MapDriver {
    static async create() {
        let driver;
        let resolvePid;
        let pidPromise = new Promise((resolve, reject) => { resolvePid = resolve; });
        if (process.env.BROWSER === 'chrome') {
            const _spawn = child_process.spawn;
            child_process.spawn = (...args) => {
                const proc = _spawn(...args);
                resolvePid(proc.pid);
                return proc;
            };
            driver = new webdriver.Builder()
                .forBrowser('chrome')
                .setChromeOptions(
                    new chrome.Options()
                        .addArguments(`load-extension=${process.cwd()}/gen/plugin-10000-chrome`, 'window-size=800,724')
                )
                .build();
        } else if (process.env.BROWSER === 'edge') {
            const edgePaths = await edge.driverModule.installDriver();
            driver = new webdriver.Builder()
                .forBrowser('MicrosoftEdge')
                .setEdgeOptions(
                    new edge.Options()
                        .addArguments(`load-extension=${process.cwd()}/gen/plugin-10000-edge`, 'window-size=800,720')
                )
                .setEdgeService(new edge.ServiceBuilder(edgePaths.driverPath))
                .build();
        } else if (process.env.BROWSER === 'firefox') {
            driver = new webdriver.Builder()
                .forBrowser('firefox')
                .setFirefoxOptions(
                    new firefox.Options()
                        .windowSize({width: 800, height: 657})
                )
                .build();
            await driver.installAddon(`${process.cwd()}/gen/scrollmaps-10000-firefox.zip`, true)
        } else {
            throw new Error('Environment variable $BROWSER not defined');
        }
        const mapDriver = new MapDriver(driver, pidPromise);
        try {
            // Make sure the browser height is normalized
            await driver.wait(async () => {
                const innerSize = await driver.executeScript(() => [window.innerWidth, window.innerHeight]);
                console.log('inner size=', innerSize);
                return innerSize[0] === 800 && innerSize[1] === 600;
            });
        } catch (e) {
            await mapDriver.quit();
            throw e;
        }
        return mapDriver;
    }

    constructor(driver, pidPromise) {
        this.driver = driver;
        this.pidPromise = pidPromise;
    }

    async quit() {
        await this.driver.quit();
    }

    async waitForScrollMapsLoaded() {
        // ScrollMaps should be activated automatically
        const elem = await this.driver.wait(async () => {
            return (await this.driver.findElements(By.css('[data-scrollmaps]')))[0];
        }, 10000);
        // console.log('elem', elem)
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

    async pinchGesture(elem, deltaY, opts = {}) {
        // Firefox tends to have lower deltaY than Chromium browsers for pinch gestures
        // const browserScale = firefox ? 0.5 : 1;
        return await this.scroll(elem, 0, deltaY, {
            ctrlKey: true,
            logTag: 'zooming',
            // browserScale: browserScale,
            ...opts
        })
    }

    async scrollIntoView(elem) {
        await this.driver.executeScript((elem) => elem.scrollIntoView(), elem);
    }

    async scroll(elem, dx, dy, {logTag = 'scrolling', ...opts} = {}) {
        const r = await elem.getRect();
        console.log(logTag, dx, dy);
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
                    console.log('Dispatching wheel event', dx, dy, opts.ctrlKey);
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
                const chunks = Math.round(Math.max(Math.abs(dx) / 9, Math.abs(dy) / 9));
                const browserScale = opts.browserScale || 1;
                for (let i = 0; i < chunks; i++) {
                    wheel(dx / chunks * browserScale, dy / chunks * browserScale);
                    await sleep(50);
                }
            } finally {
                done();
            }
        }, elem, r, dx, dy, opts);
    }

    async clickBrowserAction() {
        if (process.env.BROWSER === 'firefox') {
            this.driver.setContext(firefox.Context.CHROME);
            const elem = await this.driver.wait(async () => {
                const firefoxAddonId = 'c0dd22ca-492e-4bcf-ab68-53c6633892fe';
                return (await this.driver.findElements(By.id(`_${firefoxAddonId}_-browser-action`)))[0];
            }, 10000);
            await elem.click();
            this.driver.setContext(firefox.Context.CONTENT);
        } else {
            // Run the applescript for Chromium based browsers
            const pid = await this.pidPromise;
            await new Promise((resolve, reject) => {
                console.log(`Clicking browser action on process ${pid}`);
                child_process.exec(
                    'test/chrome_browser_action.js',
                    {env: {'TEST_PROCESS': pid}},
                    (err, stdout, stderr) => {
                        if (stdout) console.log(`browseraction: ${stdout.trim()}`);
                        if (stderr) console.warn(`browseraction: ${stderr.trim()}`);
                        err ? reject(err) : resolve(stdout);
                    });
            });
        }
    }
}

function sleep(timeout) {
    return new Promise((resolve, reject) => setTimeout(resolve, timeout));
}
MapDriver.sleep = sleep;

exports.MapDriver = MapDriver;
exports.sleep = sleep;
