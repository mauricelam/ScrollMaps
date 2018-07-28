/*global Message */

// let tabInjected = new Set();
// let frameInjected = new Set();

// chrome.webRequest.onBeforeRequest.addListener(function(request) {
//     let requestKey = request.tabId + ',' + request.frameId;
//     if (!frameInjected.has(requestKey)) {
//         frameInjected.add(requestKey);
//         chrome.tabs.executeScript(request.tabId, {
//             frameId: request.frameId,
//             file: 'mapapi_inject.min.js',
//             runAt: 'document_start'
//         }, () => console.log('done map inject'));
//     }

//     if (!tabInjected.has(request.tabId)) {
//         tabInjected.add(request.tabId);
//         chrome.tabs.executeScript(request.tabId, {
//             allFrames: true,
//             file: 'scrollability_inject.min.js',
//             runAt: 'document_start'
//         });
//     }

//     console.log('Done onBeforeRequest');
//     return {};
// }, {
//     'urls': ['*://maps.googleapis.com/*']
// }, ['blocking']);
