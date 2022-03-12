/**
 * Uses message passing mechanism to read preference values from the context of the extension. This
 * class has a cache of its own to provide all required preference values instantly.
 */
const PrefReader = {
    options: {},
    listeners: [],

    setOption(key, value) {
        this.options[key] = value;
        chrome.runtime.sendMessage({'action': 'setPreference', 'data': {key: key, value: value}});
    },

    getOption(key) {
        return this.options[key];
    },

    onPreferenceChanged(key, func) {
        this.listeners.push((changedkey, changedvalue) => {
            if (changedkey === key) func(changedkey, changedvalue);
        });
    }
};
const Pref = PrefReader;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
        case 'preferenceChanged':
            PrefReader.options[message.data.key] = message.data.value;
            for (const listener of PrefReader.listeners) {
                listener(message.data.key, message.data.value);
            }
            break;
    }
});

chrome.runtime.sendMessage({ 'action': 'getAllPreferences' }, (_options) => {
    PrefReader.options = { ...PrefReader.options, ..._options };
    for (const key in PrefReader.options) {
        for (const listener of PrefReader.listeners) {
            listener(key, PrefReader.options[key]);
        }
    }
});

// convenience function
function pref(key){
    return PrefReader.getOption(key);
}
