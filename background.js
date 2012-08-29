var bodyScrolls = {};
chrome.extension.onRequest.addListener(function (request, sender, sendResponse) {
    switch (request.action) {
        case 'setBodyScrolls':
            // reflect the message to all content scripts in tab
            chrome.tabs.sendRequest(sender.tab.id, request);
            bodyScrolls[sender.tab.id] = request.value;
            break;
        case 'getBodyScrolls':
            sendResponse(bodyScrolls[sender.tab.id]);
            break;
    }
});
