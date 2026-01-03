import Permission from "./permission";
import PrefManager from "./pref";
import { DEBUG, sleep } from "./utils";

enum Badge {
    Active = '\u2713',
    Loading = '\u21bb',
    Disabled = '\u2715',
    None = '',
}

const BADGE_COLORS = {
    [Badge.Active]: '#4CAF50',
    [Badge.Loading]: '#CDDC39',
    [Badge.Disabled]: '#BDBDBD'
}

async function checkErrors<T>(promise: Promise<T>, name: string, expectedErrors: string[] = []): Promise<T | undefined> {
    try {
        return await promise;
    } catch (e) {
        if (e instanceof Error) {
            if (DEBUG && e.message) {
                for (let expectedError of expectedErrors) {
                    if (e.message.indexOf(expectedError) !== -1) {
                        console.log(name, e.message);
                        return;
                    }
                }
                console.warn(name, e.message);
            }
        } else {
            console.warn(name, e);
        }
    }
}

const INJECT_EXPECTED_ERRORS = [
    'Cannot access',
    'The extensions gallery cannot be scripted'
];

async function injectScript(tabId: number, frameId: number | 'all') {
    const injectionTarget = frameId === 'all' ? {
        tabId: tabId,
        allFrames: true,
    } : {
        tabId: tabId,
        frameIds: [frameId],
    };
    const injectPromises = [
        checkErrors(
            chrome.scripting.executeScript({
                target: injectionTarget,
                files: [
                    'inject_everywhere.min.js',
                    'inject_frame.min.js',
                ],
            }),
            'inject scripts',
            INJECT_EXPECTED_ERRORS
        ),
        checkErrors(
            chrome.scripting.insertCSS({
                files: ['src/inject_everywhere.css'],
                target: injectionTarget,
            }),
            'inject everywhere CSS'
        ),
        checkErrors(
            chrome.scripting.executeScript({
                target: {
                    'tabId': tabId,
                    'allFrames': true
                },
                files: ['inject_scrollability.min.js'],
            }),
            'inject scrollability',
            INJECT_EXPECTED_ERRORS
        ),
    ];

    return Promise.allSettled(injectPromises);
}


async function handleBrowserActionClicked(tab: chrome.tabs.Tab) {
    if (!tab.id) return;
    if (!tab.url || !Permission.canInjectIntoPage(tab.url)) {
        // This extension can't inject into chrome:// pages. Just show the popup
        // directly
        setBrowserActionBadge(tab.id, Badge.Disabled)
        return;
    }
    if (tab.url && Permission.isOwnExtensionPage(tab.url)) {
        // If the permission is required (e.g. if it is on the domain
        // google.com), we cannot allow users to toggle the permission.
        chrome.tabs.sendMessage(tab.id, { 'action': 'browserActionClicked' });
        return;
    }

    chrome.scripting.executeScript({
        func: () => { (window as any).SCROLLMAPS_enabled = true },
        target: {
            tabId: tab.id,
            allFrames: true
        }
    });
    await injectScript(tab.id, 'all');
    await registerApiInjection(false);

    if (!await chrome.permissions.contains({ origins: ["*://www.google.com/"] })) {
        await checkErrors(
            chrome.scripting.executeScript({
                target: {
                    tabId: tab.id,
                    allFrames: true,
                },
                files: ['inject_frame_permission.min.js'],
            }),
            'inject frame permission',
            INJECT_EXPECTED_ERRORS
        );
    }

    chrome.tabs.sendMessage(tab.id, { 'action': 'browserActionClicked' });
    setBrowserActionBadge(tab.id, Badge.Loading);
    refreshScrollMapsStatus(tab.id);
    setTimeout(async () => {
        if (!tab.id) return;
        // Remove the loading badge if no maps responded in 10s
        if (await chrome.action.getBadgeText({ tabId: tab.id }) === Badge.Loading) {
            setBrowserActionBadge(tab.id, Badge.None);
        }
    }, 10000);
}


chrome.action.onClicked.addListener(handleBrowserActionClicked);

async function refreshScrollMapsStatus(tabId: number) {
    // Check if the map already has a scrollmaps injected (e.g. after extension reloading)
    const rawResponses = await checkErrors(chrome.scripting.executeScript({
        target: {
            tabId: tabId,
            allFrames: true
        },
        func: () => !!document.querySelector("[data-scrollmaps='enabled']"),
    }), 'map probe', INJECT_EXPECTED_ERRORS);
    const responses = rawResponses ? rawResponses.map((r) => r && r.result) : [];
    if (DEBUG) {
        console.log('Map probe responses', tabId, responses);
    }
    const any = (arr: any[] | undefined) => {
        for (const v of arr || []) {
            if (v) return true;
        }
        return false;
    };
    await updateMapStatus(tabId, any(responses));
}

async function updateMapStatus(tabId: number, mapEnabled: boolean): Promise<void> {
    if (mapEnabled) {
        setBrowserActionBadge(tabId, Badge.Active);
    } else {
        if (await chrome.action.getBadgeText({ tabId: tabId }) === Badge.Active) {
            setBrowserActionBadge(tabId, Badge.None);
        }
    }
}

function updateAllTabs() {
    chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
            if (tab.id) {
                refreshScrollMapsStatus(tab.id);
            }
        }
    });
}

updateAllTabs();

PrefManager.initBackgroundPage();

async function registerApiInjection(init: boolean): Promise<void> {
    try {
        let func = init ? chrome.scripting.registerContentScripts : chrome.scripting.updateContentScripts;
        await func([
            {
                id: 'inject_everywhere',
                allFrames: true,
                matches: ['<all_urls>'],
                js: ['inject_everywhere.min.js'],
                css: ['src/inject_everywhere.css']
            }
        ]);
    } catch (e) {
        console.error(e);
    }
}

registerApiInjection(true);
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading' || changeInfo.status === 'complete') {
        injectScript(tabId, 'all');

        // For single-page applications, if the loading state changed, check if
        // a scrollmap element is still present if the tab is "updated".
        // TODO: Maybe use chrome.tabs.connect for more robust status monitoring
        refreshScrollMapsStatus(tabId);
    }
});


function setBrowserActionBadge(tabId: number, badge: Badge) {
    chrome.action.setBadgeText({ 'text': badge, 'tabId': tabId });
    if (badge !== '') {
        chrome.action.setBadgeBackgroundColor(
            { 'color': BADGE_COLORS[badge], 'tabId': tabId });
    }
    chrome.action.setPopup({
        'tabId': tabId,
        'popup': badge !== '' ? chrome.runtime.getURL('src/popup/popup.html') : '',
    });
}

async function requestFramePermission(tabId: number): Promise<boolean> {
    let granted = await requestFramePermissionImpl(tabId);
    if (granted) {
        framePermissionGranted(tabId);
    }
    return granted;
}

async function requestFramePermissionImpl(tabId: number): Promise<boolean> {
    try {
        return await Permission.requestFramePermission();
    } catch (e) {
        // On Firefox background scripts cannot request permissions because the "user gesture" is not propagated through
        // chrome.runtime.sendMessage: https://bugzilla.mozilla.org/show_bug.cgi?id=1392624
        // Create a page to ask the user about it instead.
        console.log('error requesting permission', e);
        let tab = await chrome.tabs.create({ openerTabId: tabId, url: chrome.runtime.getURL(`src/options/framepermission.html?id=${tabId}`) });
        for (let i = 0; i < 5; i++) {
            try {
                if (tab.id) {
                    return await chrome.tabs.sendMessage(tab.id, { 'action': 'waitForPermission' });
                }
            } catch (e) {
                console.log('waitForPermission error', e, 'retrying...')
                await sleep(1000);
            }
        }
        return false;
    }
}

function framePermissionGranted(tabId: number): void {
    injectScript(tabId, 'all').then((r) => console.log(r));
}

async function injectMainScript(sender: chrome.runtime.MessageSender) {
    if (!sender.tab?.id || !sender.frameId) return;
    return await checkErrors(
        chrome.scripting.executeScript({
            target: {
                tabId: sender.tab.id,
                frameIds: [sender.frameId],
            },
            files: [
                'inject_main.min.js',
            ],
            world: "MAIN",
        }),
        'inject main script',
        INJECT_EXPECTED_ERRORS
    );
}


chrome.runtime.onMessage.addListener(
    (request, sender, sendResponse) => {
        if (request.action === 'mapLoaded') {
            if (DEBUG) console.log('mapLoaded', sender.tab);
            console.log(sender.tab?.url, chrome.runtime.getURL('src/options/options.html'))
            if (sender.tab?.id) {
                if (sender.tab.url == chrome.runtime.getURL('src/options/options.html')) {
                    // Cannot inject script into extension page. Just trust the result from our
                    // options page
                    updateMapStatus(sender.tab.id, true);
                } else {
                    refreshScrollMapsStatus(sender.tab.id);
                }
                injectMainScript(sender);
            } else {
                console.warn('mapLoaded sent without tab', sender);
            }
        } else if (request.action === 'mapUnloaded') {
            if (DEBUG) console.log('mapUnloaded', sender.tab);
            if (sender.tab?.id) {
                if (sender.tab.url == chrome.runtime.getURL('src/options/options.html')) {
                    // Cannot inject script into extension page. Just trust the result from our
                    // options page
                    updateMapStatus(sender.tab.id, false);
                } else {
                    refreshScrollMapsStatus(sender.tab.id);
                }
            } else {
                console.warn('mapUnloaded sent without tab', sender);
            }
        } else if (request.action === 'popupLoaded') {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                for (const tab of tabs) {
                    handleBrowserActionClicked(tab);
                }
            });
        } else if (request.action === 'requestIframePermission') {
            if (sender.tab?.id) {
                requestFramePermission(sender.tab.id).then(sendResponse);
                return true;
            }
        } else if (request.action === 'framePermissionGranted') {
            framePermissionGranted(request.tabId || sender.tab?.id);
        }
    });
