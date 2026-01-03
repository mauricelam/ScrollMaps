import Permission from "../permission";
import { DEBUG } from "../utils";

document.addEventListener('DOMContentLoaded', async () => {
    const siteStatus = loadSiteStatus();

    function getTabUrl(): Promise<string> {
        return new Promise((resolve, reject) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs && tabs[0].url) {
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

    document.getElementById('reload')!.addEventListener('click', () => {
        chrome.runtime.reload();
        return false;
    }, false);
    document.getElementById('reload')!.classList.toggle('hidden', !DEBUG);

    document.getElementById('options')!.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
        window.close();
        return false;
    }, false);

    document.getElementById('site_granted')!.addEventListener('change', async function () {
        const status = await siteStatus;
        if ((this as HTMLInputElement).checked) {
            let granted = await chrome.permissions.request({ origins: [status.tabUrl] });
            if (!granted) {
                (this as HTMLInputElement).checked = false;
            }
        } else {
            chrome.permissions.remove({ origins: [status.tabUrl] });
        }
    }, false);
    document.getElementById('all_granted')!.addEventListener('change', async function () {
        let allGranted = (this as HTMLInputElement).checked;
        if (allGranted) {
            let granted = await chrome.permissions.request({ origins: ['<all_urls>'] });
            if (!granted) {
                allGranted = false;
                (this as HTMLInputElement).checked = false;
            }
        } else {
            chrome.permissions.remove({ origins: ['<all_urls>'] })
        }
        (document.getElementById('site_granted') as HTMLInputElement).checked = allGranted;
        refreshCheckboxEnabledStates(allGranted);
    }, false);

    function refreshCheckboxEnabledStates(allGranted: boolean) {
        (document.getElementById('site_granted') as HTMLInputElement).disabled = allGranted;
        document.querySelector('label[for=site_granted]')!.classList.toggle('disabled', allGranted);
    }

    chrome.runtime.sendMessage({ action: 'popupLoaded' });

    const status = await siteStatus;
    if (Permission.isOwnExtensionPage(status.tabUrl)) {
        document.body.classList.add('disable-options');
        document.getElementById('permissionExplanation')!.innerText =
            'ScrollMaps is enabled on this ScrollMaps page.';
        return;
    }
    if (!Permission.canInjectIntoPage(status.tabUrl)) {
        document.body.classList.add('disable-options');
        const protocol = new URL(status.tabUrl).protocol;
        document.getElementById('permissionExplanation')!.innerText =
            `ScrollMaps cannot be enabled on "${protocol}" pages`;
        return;
    }
    const host = new URL(status.tabUrl).host;
    (document.querySelector('label[for=site_granted] .PMcheckbox_smalltext') as HTMLElement)
        .innerText = `Enable ScrollMaps on ${host} without having to click on the extension icon`;

    (document.getElementById('all_granted') as HTMLInputElement).checked = status.isAllGranted;
    (document.getElementById('site_granted') as HTMLInputElement).checked = status.isSiteGranted;
    refreshCheckboxEnabledStates(status.isAllGranted);

}, false);