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
