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
                        .addArguments(`load-extension=${process.cwd()}/gen/plugin-10000-chrome`)
                )
                .build();
        } else if (process.env.BROWSER === 'firefox') {
            driver = new webdriver.Builder()
                .forBrowser('firefox')
                .setFirefoxOptions(new firefox.Options())
                .build();
            await driver.installAddon(`${process.cwd()}/gen/scrollmaps-10000-firefox.zip`, true)
        } else {
            throw 'Environment variable $BROWSER not defined';
        }
        driver.manage().setTimeouts({'script': TEST_TIMEOUT});
    });
    after(async () => {
        await driver.quit();
    })

    const TEST_SITES = [
        // Google maps
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
        'https://www.heywhatsthat.com/?view=P5XIGCII',
        // ArcGis
        // More demos at https://www.arcgis.com/apps/instant/filtergallery/index.html?appid=2833a9ccc8e648bc9bb8383c00694acf
        'https://www.arcgis.com/home/webmap/viewer.html',
        'https://sccplanning.maps.arcgis.com/apps/webappviewer/index.html?id=7d5a189b138e4aa3bea6dc0514f0b85b',
        'https://geoxc-apps2.bd.esri.com/LivingAtlas/GlobalLandCoverChangePrediction/index.html',
        'https://geoxc-apps2.bd.esri.com/Analysis/DistanceToInfrastructure/index.html',
        // Mapbox
        'https://docs.mapbox.com/mapbox-gl-js/example/simple-map/',
        'http://en.parkopedia.com/parking/san_francisco_ca_united_states/?ac=1&country=US&lat=37.7749295&lng=-122.41941550000001',
        'https://labs.mapbox.com/standard-style/#16.2/48.859605/2.293506/-20/62',
        'https://www.wunderground.com/wundermap',
        'https://www.napavalley.com/businesses/42931/napa-s-riverfront',
        // Apple MapKit
        'https://duckduckgo.com/?q=maps&iaxm=maps&source=maps',
        'https://maps.apple.com/imagecollection/map?path=london',
        'https://developer.apple.com/maps/web/',
        // MapLibre
        // More at https://github.com/maplibre/awesome-maplibre?tab=readme-ov-file#users
        'https://maplibre.org/maplibre-gl-js/docs/',
        'https://travelermap.net/parks/usa#map=10.2/37.6926/-121.9915',
        'https://samples.azuremaps.com/animations/morph-shape-animation',
        // OpenLayer
        'https://openlayers.org/en/latest/examples/mapbox-vector-tiles-advanced.html',
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
