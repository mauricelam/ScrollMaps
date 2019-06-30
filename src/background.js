/*global Message */

const DEBUG = false;

const BADGE_ACTIVE = '\u2713';
const BADGE_LOADING = '\u21bb';

function injectScript(tabId, frameId) {
    chrome.tabs.executeScript(tabId, {
        'file': 'mapapi_inject.min.js',
        'runAt': 'document_start',
        'frameId': frameId === 'all' ? null : frameId,
        'allFrames': frameId === 'all'
    });
    chrome.tabs.executeScript(tabId, {
        'file': 'scrollability_inject.min.js',
        'runAt': 'document_idle',
        'allFrames': true
    }, (result) => {
        let lastError = chrome.runtime.lastError;
        let errorMessage = lastError ? lastError.message : undefined;
        if (DEBUG) {
            console.log(tabId, errorMessage);
        } else if (errorMessage
            && errorMessage.indexOf('Cannot access') === -1
            && errorMessage.indexOf('The extensions gallery cannot be scripted') === -1) {
            console.warn(tabId, errorMessage);
        }
    });
}

chrome.webRequest.onBeforeRequest.addListener(
    function(details) {
        if (details.type === 'script') {
            if (DEBUG) {
                console.log('Map API script requested', details);
            }
            if (details.tabId < 0) {
                console.warn('Tab ID is less than 0', details);
                return;
            }
            injectScript(details.tabId, details.frameId);
        } else {
            if (DEBUG) {
                console.log('Non matching request', details);
            }
        }
        return;
    },
    {urls: ["*://maps.googleapis.com/*"]});

chrome.browserAction.onClicked.addListener((tab) => {
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

function refreshBrowserAction(tab) {
    if (DEBUG) {
        console.log('initialize tab', tab);
    }
    if (tab.url.indexOf('chrome://') === 0
        || tab.url.indexOf('chrome-extension://') === 0) {
        // This extension can't inject into chrome:// pages. Just show the popup
        // directly
        setBrowserActionBadge(tab.id, undefined)
        return;
    }
    if (Permission.isRequiredPermission(tab.url)) {
        // If the permission is required (e.g. if it is on the domain
        // google.com), we cannot allow users to toggle the permission.
        setBrowserActionBadge(tab.id, undefined)
        return;
    }
}

function refreshScrollMapsStatus(tabId, tab) {
    // Check if the map already has a scrollmaps injected (e.g. after extension reloading)
    chrome.tabs.executeScript(tabId, {
        'code': '!!document.querySelector("[data-scrollmaps]")',
        'runAt': 'document_start'
    }, (response) => {
        if (DEBUG) {
            console.log('response', tab, response);
        }
        if (response && response[0]) {
            setBrowserActionBadge(tabId, BADGE_ACTIVE);
        }
        // Ignore the error
        let lastError = chrome.runtime.lastError;
        let errorMessage = lastError ? lastError.message : undefined;
        if (DEBUG) {
            console.log(tabId, errorMessage);
        } else if (errorMessage && errorMessage.indexOf('Cannot access') === -1) {
            console.warn(tabId, errorMessage);
        }
    });
}

function updateAllTabs() {
    chrome.tabs.query({}, (tabs) => {
        for (let tab of tabs) {
            refreshBrowserAction(tab);
            refreshScrollMapsStatus(tab.id, tab);
        }
    });
}

updateAllTabs();

chrome.tabs.onUpdated.addListener(
    (tabId, changeInfo, tab) => {
        if (changeInfo.status === 'complete') {
            refreshBrowserAction(tab);
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
    }
    chrome.browserAction.setPopup({
        'tabId': tabId,
        'popup': popup ? chrome.runtime.getURL('src/popup/popup.html') : '',
    });
}

chrome.browserAction.setBadgeBackgroundColor({'color': '#4caf50'});

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
