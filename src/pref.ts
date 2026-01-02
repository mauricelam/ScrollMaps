export interface Preferences {
    enabled: boolean
    invertScroll: boolean
    invertZoom: boolean
    isolateZoomScroll: boolean
    frameRequireFocus: boolean
    scrollSpeed: number
    zoomSpeed: number
}

const DEFAULT_PREFERENCES: Preferences = {
    'enabled': true,
    'invertScroll': false,
    'invertZoom': false,
    'isolateZoomScroll': true,
    'frameRequireFocus': true,
    'scrollSpeed': 200,
    'zoomSpeed': 250
}

const PrefManager = {
    async getOptions(): Promise<Preferences> {
        return await chrome.storage.local.get();
    },

    async getAllOptions(): Promise<Preferences> {
        const options = await this.getOptions();
        return { ...DEFAULT_PREFERENCES, ...options };
    },

    async setOption(key: string, value: any) {
        await chrome.storage.local.set({ [key]: value });
    },

    async getOption(key: string): Promise<any> {
        const options = await this.getAllOptions()
        return options[key];
    },

    onPreferenceChanged(key: string, func: (key: string, value: any) => void) {
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
        chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
            switch (message.action) {
                case 'setPreference':
                    PrefManager.setOption(message.data.key, message.data.value);
                    break;
            }
        });
    }
}

export default PrefManager;

export async function pref(key: string): Promise<any> {
    return await PrefManager.getOption(key);
}
