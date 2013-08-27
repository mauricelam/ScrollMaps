/*global Message */

Message.extension.addListener(function (action, data, sender, sendResponse) {
    switch(action) {
        case 'setBodyScrolls':
            // reflect the message to all content scripts in tab
            data._allFrames = true;
            Message.tab.sendMessage(sender, action, data);
            break;
        case 'listenBodyScrolls':
            data._allFrames = true;
            Message.tab.sendMessage(sender, action, data);
            break;
    }
});
