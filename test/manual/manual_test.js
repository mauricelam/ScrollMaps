const assert = require('assert');
const webdriver = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const firefox = require('selenium-webdriver/firefox');
const process = require('process');
require('chromedriver');
require('geckodriver');

const TEST_TIMEOUT = 10 * 60 * 1000;


describe('Manual test suite', function() {
    console.log(`
    This is a manual test case. Go through each tab and make sure ScrollMap
    works correctly on each of them. Press Ctrl-Esc once you are done testing
    with that page.`)
    this.slow(TEST_TIMEOUT);
    this.timeout(TEST_TIMEOUT);
    let driver;

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
                .setFirefoxOptions(new firefox.Options())
                .build();
            await driver.installAddon(`${process.cwd()}/gen/scrollmaps-10000.zip`, true)
        } else {
            throw 'Environment variable $BROWSER not defined';
        }
        driver.manage().setTimeouts({'script': TEST_TIMEOUT});
    });
    after(async () => {
        await driver.quit();
    })

    const TEST_SITES = [
        'https://www.google.com/maps?force=webgl',
        'https://developers.google.com/maps/documentation/javascript/styling',
        'https://developers.google.com/maps/documentation/embed/guide',
        'https://developers.google.com/maps/documentation/javascript/examples/polygon-draggable',
        'https://developers.google.com/maps/documentation/javascript/examples/layer-data-quakes',
        'https://developers.google.com/maps/documentation/javascript/examples/layer-georss',
        'https://developers.google.com/maps/documentation/javascript/examples/streetview-embed',
        'https://developers.google.com/maps/documentation/javascript/examples/drawing-tools',
        'https://www.google.com/maps?force=canvas',
        'https://www.google.com/maps/d/u/0/viewer?msa=0&mid=1ntHquqDTqNB6fcmjKDSJT3VusG0&ll=37.34262853432693%2C-121.3232905&z=7',
        'https://www.google.com/maps/@37.4219933,-122.0839072,3a,75y,8.52h,91.87t/data=!3m7!1e1!3m5!1sAF1QipMTIbIwyp8-XiyAGV95fPGmHuKi-lZkyUsliSVH!2e10!3e11!7i10000!8i5000',
        'http://la.smorgasburg.com/info/',
        'https://www.yelp.com/search?find_desc=Restaurants&find_loc=Chicago%2C%20IL',
        'https://www.google.com/travel/explore',
        'https://www.heywhatsthat.com/?view=P5XIGCII'
    ]

    for (const site of TEST_SITES) {
        it(`Site: ${site}`, async () => {
            await driver.get(site);
            await waitForEnd(driver);
        });
    }
});


function sleep(timeout) {
    return new Promise((resolve, reject) => setTimeout(resolve, timeout));
}

async function waitForEnd(driver) {
    return await driver.executeAsyncScript((done) => {
        document.addEventListener('keyup', (e) => {
            if (e.key === 'Escape' && e.ctrlKey) {
                done();
            }
        }, true);
    });
}
