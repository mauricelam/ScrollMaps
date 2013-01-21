/*global Message */

Message.extension.addListener(function (action, data, sender, sendResponse) {
    switch(action) {
        case 'setBodyScrolls':
            // reflect the message to all content scripts in tab
            Message.tab.sendMessage(sender, action, data);
            break;
        case 'listenBodyScrolls':
            Message.tab.sendMessage(sender, action, data);
            break;
    }
});
