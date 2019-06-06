/*global Message */

chrome.webRequest.onBeforeRequest.addListener(
    function(details) {
        if (details.type === 'script') {
            chrome.tabs.executeScript(details.tabId, {
                'file': 'mapapi_inject.min.js',
                'runAt': 'document_start',
                'frameId': details.frameId
            });
        }
        return {};
    },
    {urls: ["*://maps.googleapis.com/*"]});
