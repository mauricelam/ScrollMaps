/**
 * Uses message passing mechanism to read preference values from the context of the extension. This
 * class has a cache of its own to provide all required preference values instantly.
 */

var PrefReader = {};
var Pref = PrefReader;

// convenience function
function pref(key){
    return PrefReader.getOption(key);
}

(function(){

    PrefReader.options = {};
    const listeners = [];

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        switch (message.action) {
            case 'preferenceChanged':
                PrefReader.options[message.data.key] = message.data.value;
                for (const listener of listeners) {
                    listener(message.data.key, message.data.value);
                }
                break;
        }
    });

    chrome.runtime.sendMessage({ 'action': 'getAllPreferences' }, (_options) => {
        PrefReader.options = { ...PrefReader.options, ..._options };
        for (const key in PrefReader.options) {
            for (const listener of listeners) {
                listener(key, PrefReader.options[key]);
            }
        }
    });

    PrefReader.setOption = function(key, value){
        PrefReader.options[key] = value;
        chrome.runtime.sendMessage({'action': 'setPreference', 'data': {key: key, value: value}});
    };

    PrefReader.getOption = function(key){
        return PrefReader.options[key];
    };

    PrefReader.onPreferenceChanged = function(key, func){
        listeners.push((changedkey, changedvalue) => {
            if (changedkey === key) func(changedkey, changedvalue);
        });
    };
})();
