/*global Message */

const DEBUG = false;

chrome.webRequest.onBeforeRequest.addListener(
    function(details) {
        if (details.type === 'script') {
            if (DEBUG) {
                console.log('Map API script requested', details);
            }
            if (details.tabId < 0) {
                console.warn('Tab ID is less than 0', details);
                return {};
            }
            chrome.tabs.executeScript(details.tabId, {
                'file': 'mapapi_inject.min.js',
                'runAt': 'document_start',
                'frameId': details.frameId
            });
            chrome.tabs.executeScript(details.tabId, {
                'file': 'scrollability_inject.min.js',
                'runAt': 'document_idle',
                'allFrames': true
            });
        } else {
            if (DEBUG) {
                console.log('Non matching request', details);
            }
        }
        return {};
    },
    {urls: ["*://maps.googleapis.com/*"]});

async function initializeTab(tab) {
    if (tab.url.indexOf('chrome://') === 0 || tab.url.indexOf('chrome-extension://') === 0) {
        // This extension can't inject into chrome:// pages. Just show the popup
        // directly
        updateBrowserAction(tab, {active: false})
        return;
    }
    if (Permission.isMapsSite(tab.url) || Permission.isRequiredPermission(tab.url)) {
        updateBrowserAction(tab);
        return;
    }
    let siteStatus = await Permission.loadSiteStatus(tab.url);
    if (siteStatus.isSiteGranted || siteStatus.isAllGranted) {
        updateBrowserAction(tab);
        return;
    }
    updateBrowserAction(tab, {active: false, popup: false});
}

function updateAllTabs() {
    chrome.tabs.query({}, (tabs) => {
        for (let tab of tabs) {
            initializeTab(tab);
        }
    });
}

updateAllTabs();

chrome.tabs.onUpdated.addListener(
    (tabId, changeInfo, tab) => initializeTab(tab));

function updateBrowserAction(tab, {active = true, popup = true} = {}) {
    chrome.browserAction.setBadgeText({
        'text': active ? '\u2713' : '',
        'tabId': tab.id
    });
    chrome.browserAction.setPopup({
        'tabId': tab.id,
        'popup': popup ? chrome.runtime.getURL('src/popup/popup.html') : '',
    });
}

chrome.browserAction.setBadgeBackgroundColor({'color': '#4caf50'});

chrome.browserAction.onClicked.addListener((tab) => {
    chrome.tabs.executeScript(tab.id, {
        'file': 'mapapi_inject.min.js',
        'runAt': 'document_start',
        'allFrames': true
    });
    chrome.tabs.executeScript(tab.id, {
        'file': 'scrollability_inject.min.js',
        'runAt': 'document_idle',
        'allFrames': true
    });

    updateBrowserAction(tab);
});

chrome.permissions.onAdded.addListener((permissions) => updateAllTabs());
chrome.permissions.onRemoved.addListener((permissions) => updateAllTabs());
