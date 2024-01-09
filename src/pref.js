const PrefManager = {

    _DEFAULTS: {
        'enabled': true,
        'invertScroll': false,
        'invertZoom': false,
        'isolateZoomScroll': true,
        'frameRequireFocus': true,
        'scrollSpeed': 200,
        'zoomSpeed': 250
    },

    getDefault(label) {
        return this._DEFAULTS[label];
    },

    async getOptions() {
        return await chrome.storage.local.get();
    },

    async getAllOptions() {
        const options = await this.getOptions();
        return { ...PrefManager._DEFAULTS, ...options };
    },

    async setOption(key, value) {
        await chrome.storage.local.set({ [key]: value });
    },

    async getOption(key) {
        const options = await this.getAllOptions()
        return options[key];
    },

    onPreferenceChanged(key, func) {
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local') {
                for (const changedKey in changes) {
                    if (key === null || changedKey === key) {
                        func(changedKey, changes[changedKey].newValue);
                    }
                }
            }
        });
    },

    initBackgroundPage() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            switch (message.action) {
                case 'setPreference':
                    PrefManager.setOption(message.data.key, message.data.value);
                    break;
            }
        });
    }
}

const Pref = PrefManager;

async function pref(key) {
    return await PrefManager.getOption(key);
}
