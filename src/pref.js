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

	getOptions() {
		const opt = localStorage['options'];
		if (!opt) return false;
		const options = JSON.parse(opt);
		if (!options) return false;
		return options;
	},

	setOption(key, value) {
		let options = this.getOptions();
		if (!options) options = {};
        if (options[key] === value) return;
		options[key] = value;
		localStorage['options'] = JSON.stringify(options);
        for (const listener of this.listeners) {
            listener(key, value);
        }
		console.log('Options saved');
	},

	getOption(key) {
		let options = this.getOptions();
		if (!options) return this.getDefault(key);
		const output = options[key];
		if (output === undefined) {
			return this.getDefault(key);
        }
		return output;
	},

    onPreferenceChanged(key, func) {
        this.listeners.push((changedkey, changedvalue) => {
            if (changedkey === key) func(changedkey, changedvalue);
        });
    },

    // support for PrefReader which reads preferences from content scripts (which do not have access
    // to localStorage of the extension)
}

PrefManager.listeners.push((key, value) => {
    chrome.windows.getAll({populate: true}, (windows) => {
        for (const window of windows) {
            for (const tab of window.tabs) {
                chrome.tabs.sendMessage(
                    tab.id,
                    { 'action': 'preferenceChanged', 'data': {key: key, value: value} }
                );
            }
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

function pref(label){
    return PrefManager.getOption(label);
}
