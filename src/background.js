const DEBUG = chrome.runtime.getManifest().version === '10000';

const BADGE_ACTIVE = '\u2713';
const BADGE_LOADING = '\u21bb';
const BADGE_DISABLED = '\u2715';

const BADGE_COLORS = {
    [BADGE_ACTIVE]: '#4CAF50',
    [BADGE_LOADING]: '#CDDC39',
    [BADGE_DISABLED]: '#BDBDBD'
}

async function checkErrors(promise, name, expectedErrors) {
    try {
        await promise;
    } catch (e) {
        let errorMessage = e ? e.message : undefined;
        if (DEBUG && errorMessage) {
            for (let expectedError of expectedErrors) {
                if (errorMessage.indexOf(expectedError) !== -1) {
                    console.log(name, errorMessage);
                    return;
                }
            }
            console.warn(name, errorMessage);
        }
    }
}

const INJECT_EXPECTED_ERRORS = [
    'Cannot access',
    'The extensions gallery cannot be scripted'
];

function injectScript(tabId, frameId) {
    return Promise.allSettled([
        checkErrors(
            chrome.scripting.executeScript({
                target: {
                    tabId: tabId,
                    frameIds: frameId === 'all' ? null : [frameId],
                    allFrames: frameId === 'all',
                },
                files: ['mapapi_inject.min.js'],
            }),
            'inject mapapi',
            INJECT_EXPECTED_ERRORS
        ),
        checkErrors(
            chrome.scripting.executeScript({
                target: {
                    'tabId': tabId,
                    'allFrames': true
                },
                files: ['scrollability_inject.min.js'],
            }),
            'inject scrollability',
            INJECT_EXPECTED_ERRORS
        )
    ]);
}


async function handleBrowserActionClicked(tab) {
    // BUG: The checkmark seems to be shown on all pages
    if (!Permission.canInjectIntoPage(tab.url)) {
        // This extension can't inject into chrome:// pages. Just show the popup
        // directly
        setBrowserActionBadge(tab.id, BADGE_DISABLED)
        return;
    }
    if (Permission.isOwnExtensionPage(tab.url) || Permission.isRequiredPermission(tab.url)) {
        // If the permission is required (e.g. if it is on the domain
        // google.com), we cannot allow users to toggle the permission.
        setBrowserActionBadge(tab.id, '');
    }

    chrome.scripting.executeScript({
        func: () => { window.SCROLLMAPS_enabled = true },
        target: {
            tabId: tab.id,
            allFrames: true
        }
    });
    await injectScript(tab.id, 'all');
    chrome.tabs.sendMessage(tab.id, {'action': 'browserActionClicked'});
    setBrowserActionBadge(tab.id, BADGE_LOADING);
    refreshScrollMapsStatus(tab.id);
    setTimeout(async () => {
        // Remove the loading badge if no maps responded in 10s
        if (await chrome.action.getBadgeText({tabId: tab.id}) === BADGE_LOADING) {
            setBrowserActionBadge(tab.id, '');
        }
    }, 10000);
}


chrome.action.onClicked.addListener(handleBrowserActionClicked);

async function refreshScrollMapsStatus(tabId) {
    // Check if the map already has a scrollmaps injected (e.g. after extension reloading)
    let responses = await chrome.scripting.executeScript({
        target: {
            tabId: tabId,
            allFrames: true
        },
        func: () => !!document.querySelector("[data-scrollmaps='enabled']"),
    });
    responses = responses.map((r) => r.result);
    if (DEBUG) {
        console.log('Map probe responses', tabId, responses);
    }
    const any = (arr) => {
        for (const v of arr || []) {
            if (v) return true;
        }
        return false;
    };
    if (any(responses)) {
        setBrowserActionBadge(tabId, BADGE_ACTIVE);
    } else {
        if (await chrome.action.getBadgeText({tabId: tabId}) === BADGE_ACTIVE) {
            setBrowserActionBadge(tabId, '');
        }
    }
    checkErrors('map probe', ['Cannot access']);
}

function updateAllTabs() {
    chrome.tabs.query({}, (tabs) => {
        for (let tab of tabs) {
            refreshScrollMapsStatus(tab.id);
        }
    });
}

updateAllTabs();

Pref.initBackgroundPage();

if (chrome.contentScripts) {
    // chrome.contentScripts API is currently Firefox only. It allows us to
    // inject the script into frames that loads after the original page load
    // (and therefore not caught by chrome.tabs.onUpdated).
    // https://bugs.chromium.org/p/chromium/issues/detail?id=1054624 tracks
    // adding a similar feature to Chrome.
    chrome.contentScripts.register({
        allFrames: true,
        js: [{file: 'mapapi_inject.min.js'}],
        matches: ['<all_urls>']
    });
} else if (chrome.scripting) {
    (async () => {
        try {
            chrome.scripting.registerContentScripts([
                {
                    id: 'global_mapapi_inject',
                    allFrames: true,
                    matches: ['<all_urls>'],
                    js: ['mapapi_inject.min.js']
                }
            ]);
        } catch (e) {
            console.error(e);
        }
    })();
}
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading' || changeInfo.status === 'complete') {
        injectScript(tabId, 'all');

        // For single-page applications, if the loading state changed, check if
        // a scrollmap element is still present if the tab is "updated".
        // TODO: Maybe use chrome.tabs.connect for more robust status monitoring
        refreshScrollMapsStatus(tabId);
    }
});


function setBrowserActionBadge(tabId, badge) {
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


chrome.runtime.onMessage.addListener(
    (request, sender, sendResponse) => {
        if (request.action === 'mapLoaded') {
            if (DEBUG) console.log('mapLoaded', sender.tab);
            if (sender.tab) {
                refreshScrollMapsStatus(sender.tab.id);
            } else {
                console.warn('mapLoaded sent without tab', sender);
            }
        } else if (request.action === 'mapUnloaded') {
            if (DEBUG) console.log('mapUnloaded', sender.tab);
            if (sender.tab) {
                refreshScrollMapsStatus(sender.tab.id);
            } else {
                console.warn('mapUnloaded sent without tab', sender);
            }
        } else if (request.action === 'popupLoaded') {
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                for (const tab of tabs) {
                    handleBrowserActionClicked(tab);
                }
            });
        }
    });
