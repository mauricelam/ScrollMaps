/**
 * Uses message passing mechanism to read preference values from the context of the extension. This
 * class has a cache of its own to provide all required preference values instantly.
 */
let _PrefReaderInit;
const PrefReader = {
    options: {},
    listeners: [],
    _promise: new Promise((accept, reject) => _PrefReaderInit = accept),

    setOption(key, value) {
        this.options[key] = value;
        chrome.runtime.sendMessage({'action': 'setPreference', 'data': {key: key, value: value}});
    },

    async getOption(key) {
        await this._promise;
        return this.options[key];
    },

    async getAllOptions() {
        await this._promise;
        return this.options;
    },

    onPreferenceChanged(key, func) {
        this.listeners.push((changedkey, changedvalue) => {
            console.log('Pref change', changedkey, changedvalue);
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
    _PrefReaderInit();
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
