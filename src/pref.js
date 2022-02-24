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
    listeners: [],

	getDefault(label) {
        return this._DEFAULTS[label];
	},

	async getOptions() {
		const options = await chrome.storage.sync.get();
		if (!options) return false;
		return options;
	},

    async getAllOptions() {
        const options = await this.getOptions();
        return {...DEFAULTS, ...options};
    },

	async setOption(key, value) {
		await chrome.storage.sync.set({[key]: value});
		console.log('Options saved');
        for (const listener of this.listeners) {
            listener(key, value);
        }
	},

	async getOption(key) {
		let options = await this.getOptions();
		if (!options) return getDefault(key);
		const output = options[key];
		if (output === undefined) {
			return this.getDefault(key);
        }
		return output;
	},

    onPreferenceChanged(key, func) {
        chrome.storage.onChanged.addListener((changes, area) => {
            for (const changedKey in changes) {
                if (changedKey === key) {
                    func(changedKey, changes[key]);
                }
            }
        });
    }
    // support for PrefReader which reads preferences from content scripts (which do not have access
    // to localStorage of the extension)
}

PrefManager.listeners.push((key, value) => {
    chrome.windows.getAll({populate: true}, (windows) => {
        for (const window of windows) {
            for (const tab of window.tabs) {
                console.log('Sending pref change to tab ', tab);
                chrome.tabs.sendMessage(
                    tab.id,
                    { 'action': 'preferenceChanged', 'data': {key: key, value: value} }
                );
            }
            // Support for PrefReader which reads preferences from content scripts
        }
    });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
        case 'setPreference':
            PrefManager.setOption(message.data.key, message.data.value);
            break;
        case 'getAllPreferences':
            const allOptions = { ...PrefManager._DEFAULTS, ...PrefManager.getOptions() };
            sendResponse(allOptions);
            break;
    }
});

const Pref = PrefManager;

async function pref(label){
    return await PrefManager.getOption(label);
}
