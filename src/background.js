const DEBUG = chrome.runtime.getManifest().version === '10000';

const BADGE_ACTIVE = '\u2713';
const BADGE_LOADING = '\u21bb';
const BADGE_DISABLED = '\u2715';

const BADGE_COLORS = {
    [BADGE_ACTIVE]: '#4CAF50',
    [BADGE_LOADING]: '#CDDC39',
    [BADGE_DISABLED]: '#BDBDBD'
}

function checkErrors(name, expectedErrors) {
    let lastError = chrome.runtime.lastError;
    let errorMessage = lastError ? lastError.message : undefined;
    if (DEBUG && errorMessage) {
        for (let expectedError of expectedErrors) {
            if (errorMessage.indexOf(expectedError) !== -1) {
                console.log(name, errorMessage);
                return;
            }
        }
        console.warn(name, errorMessage);
    }
}

const INJECT_EXPECTED_ERRORS = [
    'Cannot access',
    'The extensions gallery cannot be scripted'
];

function injectScript(tabId, frameId) {
    return Promise.allSettled([
        new Promise((resolve, reject) => {
            chrome.tabs.executeScript(tabId, {
                'file': 'mapapi_inject.min.js',
                'runAt': 'document_start',
                'frameId': frameId === 'all' ? null : frameId,
                'allFrames': frameId === 'all'
            }, () => {
                checkErrors('inject mapapi', INJECT_EXPECTED_ERRORS);
                resolve();
            });
        }),
        new Promise((resolve, reject) => {
            chrome.tabs.executeScript(tabId, {
                'file': 'scrollability_inject.min.js',
                'runAt': 'document_idle',
                'allFrames': true
            }, () => {
                checkErrors('inject scrollability', INJECT_EXPECTED_ERRORS);
                resolve();
            });
        })
    ]);
}


function getBadgeText(tabId) {
    return new Promise((resolve, reject) => {
        chrome.browserAction.getBadgeText({'tabId': tabId}, resolve);
    });
}


async function handleBrowserActionClicked(tab) {
    if (!Permission.canInjectIntoPage(tab.url)) {
        // This extension can't inject into chrome:// pages. Just show the popup
        // directly
        setBrowserActionBadge(tab.id, BADGE_DISABLED)
        return;
    }
    if (Permission.isOwnExtensionPage(tab.url) || Permission.isRequiredPermission(tab.url)) {
        // If the permission is required (e.g. if it is on the domain
        // google.com), we cannot allow users to toggle the permission.
        setBrowserActionBadge(tab.id, '');
    }

    chrome.tabs.executeScript(tab.id, {
        'code': 'window.SCROLLMAPS_enabled = true',
        'allFrames': true
    });
    await injectScript(tab.id, 'all');
    chrome.tabs.sendMessage(tab.id, {'action': 'browserActionClicked'});
    setBrowserActionBadge(tab.id, BADGE_LOADING);
    refreshScrollMapsStatus(tab.id);
    setTimeout(async () => {
        // Remove the loading badge if no maps responded in 10s
        if (await getBadgeText(tab.id) === BADGE_LOADING) {
            setBrowserActionBadge(tab.id, '');
        }
    }, 10000);
}


chrome.browserAction.onClicked.addListener(async (tab) => {
    await handleBrowserActionClicked(tab);
});

function refreshScrollMapsStatus(tabId) {
    // Check if the map already has a scrollmaps injected (e.g. after extension reloading)
    chrome.tabs.executeScript(tabId, {
        code: '!!document.querySelector("[data-scrollmaps=\'enabled\']")',
        runAt: 'document_start',
        allFrames: true,
    }, async (responses) => {
        if (DEBUG) {
            console.log('Map probe responses', tabId, responses);
        }
        const any = (arr) => {
            for (const v of arr || []) {
                if (v) return true;
            }
            return false;
        };
        if (any(responses)) {
            setBrowserActionBadge(tabId, BADGE_ACTIVE);
        } else {
            if (await getBadgeText(tabId) === BADGE_ACTIVE) {
                setBrowserActionBadge(tabId, '');
            }
        }
        checkErrors('map probe', ['Cannot access']);
    });
}

function updateAllTabs() {
    chrome.tabs.query({}, (tabs) => {
        for (let tab of tabs) {
            refreshScrollMapsStatus(tab.id);
        }
    });
}

updateAllTabs();

if (chrome.contentScripts) {
    // chrome.contentScripts API is currently Firefox only. It allows us to
    // inject the script into frames that loads after the original page load
    // (and therefore not caught by chrome.tabs.onUpdated).
    // https://bugs.chromium.org/p/chromium/issues/detail?id=1054624 tracks
    // adding a similar feature to Chrome.
    chrome.contentScripts.register({
        allFrames: true,
        js: [{file: 'mapapi_inject.min.js'}],
        matches: ['<all_urls>']
    });
}
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading' || changeInfo.status === 'complete') {
        injectScript(tabId, 'all');

        // For single-page applications, if the loading state changed, check if
        // a scrollmap element is still present if the tab is "updated".
        // TODO: Maybe use chrome.tabs.connect for more robust status monitoring
        refreshScrollMapsStatus(tabId);
    }
});


function setBrowserActionBadge(tabId, badge) {
    chrome.browserAction.setBadgeText({ 'text': badge, 'tabId': tabId });
    if (badge !== '') {
        chrome.browserAction.setBadgeBackgroundColor(
            { 'color': BADGE_COLORS[badge], 'tabId': tabId });
    }
    chrome.browserAction.setPopup({
        'tabId': tabId,
        'popup': badge !== '' ? chrome.runtime.getURL('src/popup/popup.html') : '',
    });
}


chrome.runtime.onMessage.addListener(
    (request, sender, sendResponse) => {
        if (request.action === 'mapLoaded') {
            if (DEBUG) console.log('mapLoaded', sender.tab);
            if (sender.tab) {
                refreshScrollMapsStatus(sender.tab.id);
            } else {
                console.warn('mapLoaded sent without tab', sender);
            }
        } else if (request.action === 'mapUnloaded') {
            if (DEBUG) console.log('mapUnloaded', sender.tab);
            if (sender.tab) {
                refreshScrollMapsStatus(sender.tab.id);
            } else {
                console.warn('mapUnloaded sent without tab', sender);
            }
        } else if (request.action === 'popupLoaded') {
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                for (const tab of tabs) {
                    handleBrowserActionClicked(tab);
                }
            });
        }
    });
