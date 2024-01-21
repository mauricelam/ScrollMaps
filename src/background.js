const DEBUG = chrome.runtime.getManifest().version === '10000';

const BADGE_ACTIVE = '\u2713';
const BADGE_LOADING = '\u21bb';
const BADGE_DISABLED = '\u2715';

const BADGE_COLORS = {
    [BADGE_ACTIVE]: '#4CAF50',
    [BADGE_LOADING]: '#CDDC39',
    [BADGE_DISABLED]: '#BDBDBD'
}

async function checkErrors(promise, name, expectedErrors = []) {
    try {
        return await promise;
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

async function injectScript(tabId, frameId) {
    const injectPromises = [
        checkErrors(
            chrome.scripting.executeScript({
                target: {
                    tabId: tabId,
                    frameIds: frameId === 'all' ? null : [frameId],
                    allFrames: frameId === 'all',
                },
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
                target: {
                    tabId: tabId,
                    frameIds: frameId === 'all' ? null : [frameId],
                    allFrames: frameId === 'all',
                },
            }),
            'inject everywhere CSS'
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
        ),
    ];

    return Promise.allSettled(injectPromises);
}


async function handleBrowserActionClicked(tab) {
    if (!Permission.canInjectIntoPage(tab.url)) {
        // This extension can't inject into chrome:// pages. Just show the popup
        // directly
        setBrowserActionBadge(tab.id, BADGE_DISABLED)
        return;
    }
    if (Permission.isOwnExtensionPage(tab.url)) {
        // If the permission is required (e.g. if it is on the domain
        // google.com), we cannot allow users to toggle the permission.
        chrome.tabs.sendMessage(tab.id, { 'action': 'browserActionClicked' });
        return;
    }

    chrome.scripting.executeScript({
        func: () => { window.SCROLLMAPS_enabled = true },
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
    setBrowserActionBadge(tab.id, BADGE_LOADING);
    refreshScrollMapsStatus(tab.id);
    setTimeout(async () => {
        // Remove the loading badge if no maps responded in 10s
        if (await chrome.action.getBadgeText({ tabId: tab.id }) === BADGE_LOADING) {
            setBrowserActionBadge(tab.id, '');
        }
    }, 10000);
}


chrome.action.onClicked.addListener(handleBrowserActionClicked);

async function refreshScrollMapsStatus(tabId) {
    // Check if the map already has a scrollmaps injected (e.g. after extension reloading)
    let responses = await checkErrors(chrome.scripting.executeScript({
        target: {
            tabId: tabId,
            allFrames: true
        },
        func: () => !!document.querySelector("[data-scrollmaps='enabled']"),
    }), 'map probe', INJECT_EXPECTED_ERRORS);
    responses = responses ? responses.map((r) => r && r.result) : [];
    if (DEBUG) {
        console.log('Map probe responses', tabId, responses);
    }
    const any = (arr) => {
        for (const v of arr || []) {
            if (v) return true;
        }
        return false;
    };
    await updateMapStatus(tabId, any(responses));
}

async function updateMapStatus(tabId, mapEnabled) {
    if (mapEnabled) {
        setBrowserActionBadge(tabId, BADGE_ACTIVE);
    } else {
        if (await chrome.action.getBadgeText({ tabId: tabId }) === BADGE_ACTIVE) {
            setBrowserActionBadge(tabId, '');
        }
    }
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

async function registerApiInjection(init) {
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

function sleep(time) {
    return new Promise((accept, _) => { setTimeout(accept, time); });
}

async function requestFramePermission(tabId) {
    let granted = await requestFramePermissionImpl(tabId);
    if (granted) {
        framePermissionGranted(tabId);
    }
    return granted;
}

async function requestFramePermissionImpl(tabId) {
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
                return await chrome.tabs.sendMessage(tab.id, { 'action': 'waitForPermission' });
            } catch (e) {
                console.log('waitForPermission error', e, 'retrying...')
                await sleep(1000);
            }
        }
        return false;
    }
}

function framePermissionGranted(tabId) {
    injectScript(tabId, 'all').then((r) => console.log(r));
}


chrome.runtime.onMessage.addListener(
    (request, sender, sendResponse) => {
        if (request.action === 'mapLoaded') {
            if (DEBUG) console.log('mapLoaded', sender.tab);
            console.log(sender.tab.url, chrome.runtime.getURL('src/options/options.html'))
            if (sender.tab) {
                if (sender.tab.url == chrome.runtime.getURL('src/options/options.html')) {
                    // Cannot inject script into extension page. Just trust the result from our
                    // options page
                    updateMapStatus(sender.tab.id, true);
                } else {
                    refreshScrollMapsStatus(sender.tab.id);
                }
            } else {
                console.warn('mapLoaded sent without tab', sender);
            }
        } else if (request.action === 'mapUnloaded') {
            if (DEBUG) console.log('mapUnloaded', sender.tab);
            if (sender.tab) {
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
            requestFramePermission(sender.tab.id).then(sendResponse);
            return true;
        } else if (request.action === 'framePermissionGranted') {
            framePermissionGranted(request.tabId || sender.tab.id);
        }
    });
