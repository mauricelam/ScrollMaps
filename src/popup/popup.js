document.addEventListener('DOMContentLoaded', async () => {

    const DEBUG = chrome.runtime.getManifest().version === '10000';
    const siteStatus = loadSiteStatus();

    function getTabUrl() {
        return new Promise((resolve, reject) => {
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                if (tabs) {
                    resolve(tabs[0].url);
                } else {
                    reject('No active tab but browser action received');
                }
            });
        });
    }

    async function loadSiteStatus() {
        return await Permission.loadSiteStatus(await getTabUrl());
    }

    document.getElementById('reload').addEventListener('click', () => {
        chrome.runtime.reload();
        return false;
    }, false);
    document.getElementById('reload').classList.toggle('hidden', !DEBUG);

    document.getElementById('options').addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
        window.close();
        return false;
    }, false);

    document.getElementById('site_granted').addEventListener('change', async function() {
        const status = await siteStatus;
        if (this.checked) {
            let granted = await chrome.permissions.request({origins: [status.tabUrl]});
            if (!granted) {
                this.checked = false;
            }
        } else {
            chrome.permissions.remove({origins: [status.tabUrl]});
        }
    }, false);
    document.getElementById('all_granted').addEventListener('change', async function() {
        let allGranted = this.checked;
        if (allGranted) {
            let granted = await chrome.permissions.request({origins: ['<all_urls>']});
            if (!granted) {
                allGranted = false;
                this.checked = false;
            }
        } else {
            chrome.permissions.remove({origins: ['<all_urls>']})
        }
        document.getElementById('site_granted').checked = allGranted;
        refreshCheckboxEnabledStates(allGranted);
    }, false);

    function refreshCheckboxEnabledStates(allGranted) {
        document.getElementById('site_granted').disabled = allGranted;
        document.querySelector('label[for=site_granted]').classList.toggle('disabled', allGranted);
    }

    chrome.runtime.sendMessage({action: 'popupLoaded'});

    const status = await siteStatus;
    if (Permission.isOwnExtensionPage(status.tabUrl)) {
        document.body.classList.add('disable-options');
        document.getElementById('permissionExplanation').innerText =
            'ScrollMaps is enabled on this Google Maps page.';
        return;
    }
    if (!Permission.canInjectIntoPage(status.tabUrl)) {
        document.body.classList.add('disable-options');
        const protocol = new URL(status.tabUrl).protocol;
        document.getElementById('permissionExplanation').innerText =
            `ScrollMaps cannot be enabled on "${protocol}" pages`;
        return;
    }
    const host = new URL(status.tabUrl).host;
    document.querySelector('label[for=site_granted] .PMcheckbox_smalltext')
        .innerText = `Enable ScrollMaps on ${host} without having to click on the extension icon`;

    document.getElementById('all_granted').checked = status.isAllGranted;
    document.getElementById('site_granted').checked = status.isSiteGranted;
    refreshCheckboxEnabledStates(status.isAllGranted);

}, false);