/*global chrome */

// var bodyScrolls = {};
chrome.extension.onMessage.addListener(function (message, sender, sendResponse) {
    switch (message.action) {
        case 'setBodyScrolls':
            // reflect the message to all content scripts in tab
            chrome.tabs.sendMessage(sender.tab.id, message);
            // bodyScrolls[sender.tab.id] = message.value;
            break;
        // case 'getBodyScrolls':
        //     sendResponse(bodyScrolls[sender.tab.id]);
        //     break;
        case 'listenBodyScrolls':
            chrome.tabs.sendMessage(sender.tab.id, message);
            break;
    }
});
