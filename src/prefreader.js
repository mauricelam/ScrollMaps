/*global $ */

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

    Message.extension.addListener(function (action, data, sender, sendResponse) {
        switch (action) {
            case 'preferenceChanged':
                PrefReader.options[data.key] = data.value;
                for (const listener of listeners) {
                    listener(data.key, data.value);
                }
                break;
        }
    });

    Message.extension.sendMessage('getAllPreferences', {}, (_options) => {
        $.extend(PrefReader.options, _options);
        for (const key in _options) {
            for (const listener of listeners) {
                listener(key, _options[key]);
            }
        }
    });

    PrefReader.setOption = function(key, value){
        PrefReader.options[key] = value;
        Message.extension.sendMessage('setPreference', {key: key, value: value});
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
