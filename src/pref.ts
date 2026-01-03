export interface Preferences {
  enabled: boolean
  invertScroll: boolean
  invertZoom: boolean
  isolateZoomScroll: boolean
  frameRequireFocus: boolean
  scrollSpeed: number
  zoomSpeed: number
}

export type BoolPrefKey = {
  [K in keyof Preferences]: Preferences[K] extends boolean ? K : never
}[keyof Preferences];

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

  async setOption<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    await chrome.storage.local.set({ [key]: value });
  },

  async getOption<K extends keyof Preferences>(key: K): Promise<Preferences[K]> {
    const options = await this.getAllOptions()
    return options[key];
  },

  onPreferenceChanged<K extends keyof Preferences>(
    key: K | null,
    func: <K2 extends K>(key: K2, value: Preferences[K2]) => void
  ) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        for (const changedKey in changes) {
          if (changedKey in DEFAULT_PREFERENCES) {
            if (key === null || changedKey === key) {
              func(
                changedKey as K,
                changes[changedKey].newValue as Preferences[K]
              );
            }
          } else {
            console.warn("Preference changed on unknown key", changedKey)
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

export async function pref<K extends keyof Preferences>(key: K): Promise<Preferences[K]> {
  return await PrefManager.getOption(key);
}
