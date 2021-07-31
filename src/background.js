/*global Message */

const DEBUG = chrome.runtime.getManifest().version == 10000;

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
    chrome.tabs.executeScript(tabId, {
        'file': 'mapapi_inject.min.js',
        'runAt': 'document_start',
        'frameId': frameId === 'all' ? null : frameId,
        'allFrames': frameId === 'all'
    }, () => checkErrors('inject mapapi', INJECT_EXPECTED_ERRORS));
    chrome.tabs.executeScript(tabId, {
        'file': 'scrollability_inject.min.js',
        'runAt': 'document_idle',
        'allFrames': true
    }, () => checkErrors('inject scrollability', INJECT_EXPECTED_ERRORS));
}

chrome.browserAction.onClicked.addListener((tab) => {
    if (tab.url.indexOf('chrome://') === 0
        || tab.url.indexOf('chrome-extension://') === 0) {
        // This extension can't inject into chrome:// pages. Just show the popup
        // directly
        setBrowserActionBadge(tab.id, BADGE_DISABLED)
        return;
    }
    if (Permission.isRequiredPermission(tab.url)) {
        // If the permission is required (e.g. if it is on the domain
        // google.com), we cannot allow users to toggle the permission.
        setBrowserActionBadge(tab.id, '')
        return;
    }

    injectScript(tab.id, 'all');
    setBrowserActionBadge(tab.id, BADGE_LOADING);
    setTimeout(() => {
        // Remove the loading badge if no maps responded in 10s
        chrome.browserAction.getBadgeText({'tabId': tab.id}, (text) => {
            if (text === BADGE_LOADING) {
                setBrowserActionBadge(tab.id, '');
            }
        });
    }, 10000);
});

function refreshScrollMapsStatus(tabId, tab) {
    // Check if the map already has a scrollmaps injected (e.g. after extension reloading)
    chrome.tabs.executeScript(tabId, {
        'code': '!!document.querySelector("[data-scrollmaps]")',
        'runAt': 'document_start'
    }, (response) => {
        if (DEBUG) {
            console.log('Map probe response', tab, response);
        }
        if (response && response[0]) {
            setBrowserActionBadge(tabId, BADGE_ACTIVE);
        }
        checkErrors('map probe', ['Cannot access']);
    });
}

function updateAllTabs() {
    chrome.tabs.query({}, (tabs) => {
        for (let tab of tabs) {
            refreshScrollMapsStatus(tab.id, tab);
        }
    });
}

updateAllTabs();

chrome.tabs.onUpdated.addListener(
    (tabId, changeInfo, tab) => {
        if (changeInfo.status === 'loading') {
            injectScript(tab.id, 'all');
        }
    });

function setBrowserActionBadge(
        tabId,
        badge,
        {popup = true} = {}) {
    if (badge !== undefined) {
        chrome.browserAction.setBadgeText({
            'text': badge,
            'tabId': tabId
        });
        chrome.browserAction.setBadgeBackgroundColor({
            'color': BADGE_COLORS[badge]
        });
    }
    chrome.browserAction.setPopup({
        'tabId': tabId,
        'popup': popup ? chrome.runtime.getURL('src/popup/popup.html') : '',
    });
}


chrome.runtime.onMessage.addListener(
    (request, sender, sendResponse) => {
        if (request.action === 'mapLoaded') {
            if (DEBUG) {
                console.log('mapLoaded', sender.tab);
            }
            if (sender.tab) {
                setBrowserActionBadge(sender.tab.id, BADGE_ACTIVE);
            } else {
                console.warn('mapLoaded sent without tab', sender);
            }
        }
    });
