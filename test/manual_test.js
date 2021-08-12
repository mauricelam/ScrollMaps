const assert = require('assert');
const webdriver = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const firefox = require('selenium-webdriver/firefox');
const process = require('process');
require('chromedriver')
require('geckodriver')


describe('Suite', function() {
    this.slow(600000);
    this.timeout(600000);
    let driver;
    let defaultWindow;

    before(async () => {
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
                .setFirefoxOptions(
                    new firefox.Options()
                        .addExtensions(`${process.cwd()}/gen/scrollmaps-10000.zip`)
                )
                .build();
        } else {
            throw 'Environment variable $BROWSER not defined';
        }
        defaultWindow = (await driver.getAllWindowHandles())[0];
        console.log('defaultWindow', defaultWindow);
    });
    after(async () => {
        await driver.quit();
    })

    const TEST_SITES = [
        'https://www.google.com/maps',
        'https://developers.google.com/maps/documentation/javascript/styling',
        'https://developers.google.com/maps/documentation/embed/guide',
        'https://developers.google.com/maps/documentation/javascript/examples/polygon-draggable',
        'https://developers.google.com/maps/documentation/javascript/examples/layer-data-quakes',
        'https://developers.google.com/maps/documentation/javascript/examples/layer-georss',
        'https://developers.google.com/maps/documentation/javascript/examples/streetview-embed',
        'https://developers.google.com/maps/documentation/javascript/examples/drawing-tools',
        'https://www.google.com/maps?force=canvas',
        'https://www.google.com/maps/d/u/0/viewer?msa=0&mid=1ntHquqDTqNB6fcmjKDSJT3VusG0&ll=37.34262853432693%2C-121.3232905&z=7',
        'http://la.smorgasburg.com/info/',
        'https://www.yelp.com/search?find_desc=Restaurants&find_loc=Chicago%2C%20IL',
        'https://www.google.com/travel/explore',
        'https://www.heywhatsthat.com/?view=P5XIGCII'
    ]

    for (const site of TEST_SITES) {
        it(`Site: ${site}`, async () => {
            await driver.switchTo().newWindow('tab');
            await driver.get(site);
            await waitForNewTab(driver);
            await driver.switchTo().window(defaultWindow);
        });
    }
});


function sleep(timeout) {
    return new Promise((resolve, reject) => setTimeout(resolve, timeout));
}

async function waitForNewTab(driver) {
    return await driver.wait(async () => {
        const wh = await driver.getAllWindowHandles();
        return wh.length == 1;
    }, 60000);
}
