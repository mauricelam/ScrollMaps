/*global chrome */

chrome.extension.onMessage.addListener(function (message, sender, sendResponse) {
    switch (message.action) {
        case 'setBodyScrolls':
            // reflect the message to all content scripts in tab
            chrome.tabs.sendMessage(sender.tab.id, message);
            break;
        case 'listenBodyScrolls':
            chrome.tabs.sendMessage(sender.tab.id, message);
            break;
    }
});
