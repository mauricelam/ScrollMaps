var Message = {};

(function() {

    Message.tab = {};

    Message.tab.addListener = function (listener) {
        chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
            var action = message.action;
            var data = message.data;
            listener.call(this, action, data, sender, sendResponse);
        });
    };

    Message.tab.sendMessage = function (target, action, data, responseCallback) {
        var tabId = (typeof target === 'number') ? target : (target.tab) ? target.tab.id : target.id;
        responseCallback = responseCallback || function () {};
        chrome.tabs.sendMessage(tabId, { 'action': action, 'data': data }, responseCallback);
    };

    Message.extension = {};

    Message.extension.addListener = function (listener) {
        chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
            var action = message.action;
            var data = message.data;
            listener.call(this, action, data, sender, sendResponse);
        });
    };

    Message.extension.sendMessage = function (action, data, responseCallback) {
        responseCallback = responseCallback || function () {};
        chrome.runtime.sendMessage({ 'action': action, 'data': data }, responseCallback);
    };

})();

var Extension = {};

(function () {

    Extension.getURL = function (path) {
        return chrome.extension.getURL(path);
    };

    Extension.forAllTabs = function (fn) {
        chrome.windows.getAll({populate: true}, function(windows){
            for(var i in windows){
                var tabs = windows[i].tabs;
                for(var j in tabs){
                    fn(tabs[j]);
                }
            }
        });
    };

}());
