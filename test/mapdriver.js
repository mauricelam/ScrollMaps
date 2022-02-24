const webdriver = require('selenium-webdriver');
const process = require('process');
const child_process = require('child_process');
const util = require('util');
const exec = util.promisify(child_process.exec);
const portprober = require('selenium-webdriver/net/portprober');
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
        let port = await portprober.findFreePort();
        if (process.env.BROWSER === 'chrome') {
            driver = new webdriver.Builder()
                .forBrowser('chrome')
                .setChromeService(new chrome.ServiceBuilder().setPort(port))
                .setChromeOptions(
                    new chrome.Options()
                        .addArguments(`load-extension=${process.cwd()}/gen/plugin-10000-chrome`, 'window-size=800,600')
                )
                .build();
        } else if (process.env.BROWSER === 'edge') {
            const edgePaths = await edge.driverModule.installDriver();
            driver = new webdriver.Builder()
                .forBrowser('MicrosoftEdge')
                .setEdgeOptions(
                    new edge.Options()
                        .addArguments(`load-extension=${process.cwd()}/gen/plugin-10000-edge`, 'window-size=800,600')
                )
                .setEdgeService(
                    new edge.ServiceBuilder(edgePaths.driverPath)
                        .setPort(port)
                )
                .build();
        } else if (process.env.BROWSER === 'firefox') {
            driver = new webdriver.Builder()
                .forBrowser('firefox')
                .setFirefoxService(new firefox.ServiceBuilder().setPort(port))
                .setFirefoxOptions(
                    new firefox.Options()
                        .windowSize({width: 800, height: 600})
                )
                .build();
            await driver.installAddon(`${process.cwd()}/gen/scrollmaps-10000-firefox.zip`, true)
        } else {
            throw new Error('Environment variable $BROWSER not defined');
        }
        const mapDriver = new MapDriver(driver, port);
        try {
            let currentSize = [800, 600];
            // Make sure the browser height is normalized
            await driver.wait(async () => {
                const innerSize = await driver.executeScript(() => [window.innerWidth, window.innerHeight]);
                const sizeDiff = [innerSize[0] - 800, innerSize[1] - 600];
                if (sizeDiff[0] === 0 && sizeDiff[1] === 0) {
                    return true;
                }
                currentSize = [currentSize[0] - sizeDiff[0], currentSize[1] - sizeDiff[1]];
                console.log('Tweaking window size to be 800x600. Current=', currentSize);
                await driver.manage().window().setRect({width: currentSize[0], height: currentSize[1]});
                return false;
            });
        } catch (e) {
            await mapDriver.quit();
            throw e;
        }
        return mapDriver;
    }

    constructor(driver, port) {
        this.driver = driver;
        this.port = port;
    }

    async quit() {
        await this.driver.quit();
    }

    async waitForScrollMapsLoaded(timeout = 10000) {
        // ScrollMaps should be activated automatically
        const elem = await this.driver.wait(async () => {
            return (await this.driver.findElements(By.css('[data-scrollmaps]')))[0];
        }, timeout);
        // console.log('elem', elem)
        await this.driver.wait(async () => await elem.getAttribute('data-scrollmaps') === 'enabled', timeout);
        return elem;
    }

    async activateAndWaitForScrollMapsLoaded() {
        try {
            return await this.waitForScrollMapsLoaded(1000);
        } catch (e) {
            await this.clickBrowserAction();
            return await this.waitForScrollMapsLoaded();
        }
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
            logTag: 'Zooming',
            // browserScale: browserScale,
            ...opts
        })
    }

    async scrollIntoView(elem) {
        await this.driver.executeScript((elem) => elem.scrollIntoView(), elem);
    }

    async scroll(elem, dx, dy, {logTag = 'Scrolling', ...opts} = {}) {
        const r = await elem.getRect();
        console.log(`${logTag} map by (${dx}, ${dy})`);
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

    async click({x = 100, y = 100} = {}) {
        const elem = await this.waitForScrollMapsLoaded();
        console.log(`Click map at (${x}, ${y})`);
        await this.driver.actions({ bridge: true })
            .move({ origin: elem, x: x, y: y, duration: 0 })
            .click()
            .perform();
    }

    /**
     * Check against the ruler at the bottom to see if the zoom level is roughly as expected.
     */
    async assertRuler(expectedKm) {
        const elem = await this.waitForScrollMapsLoaded();
        const km = await this.driver.wait(async () =>
            elem.findElement(By.xpath('//*[@class="gm-style-cc"]//*[contains(text(), "km")]')), 10000);
        const kmText = await km.getText();
        assert.equal(kmText.trim(), expectedKm);
    }

    async printAllElements(root) {
        root = root || this.driver;
        for (const elem of await root.findElements(By.xpath("//*"))) {
            const id = await elem.getAttribute("id");
            if (id) console.log("Element ID=", id);
        }
    }

    async clickBrowserAction() {
        if (process.env.BROWSER === 'firefox') {
            this.driver.setContext(firefox.Context.CHROME);
            const extensionsButton = await this.driver.wait(async () => {
                return await this.driver.findElement(By.id("unified-extensions-button"));
            }, 10000);
            await extensionsButton.click();
            const browserAction = await this.driver.wait(async () => {
                // await this.printAllElements();
                const firefoxAddonId = 'c0dd22ca-492e-4bcf-ab68-53c6633892fe';
                return (await this.driver.findElement(By.id(`_${firefoxAddonId}_-BAP`)));
            }, 10000);
            await browserAction.click();
            this.driver.setContext(firefox.Context.CONTENT);
        } else {
            // Run the applescript for Chromium based browsers
            // First, find out who is using the driver port (which should be this node process, and the driver)
            const psresult = await exec(`lsof -t -i tcp:${this.port}`);
            const driverPid = psresult.stdout.trim().split('\n')
                    .map(Number).filter(pid => pid && pid != process.pid);
            // console.log('Driver PID:', driverPid);
            const pgrepResult = await exec(`pgrep -P "${driverPid}"`);
            const childPid = parseInt(pgrepResult.stdout.trim());
            console.log(`Clicking browser action on process ${childPid}`);
            await exec(`test/chrome_browser_action.js`,
                {
                    env: {'TEST_PROCESS': childPid, 'BROWSER': process.env.BROWSER},
                    stdio: [process.stdin, process.stdout, process.stderr],
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
