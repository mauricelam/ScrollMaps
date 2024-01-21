// Workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1392624, which allows the background
// page to create a new tab to ask the user for permission, because we cannot directly do that in
// neither the content script nor the background script.
//
// Used only on Firefox.

function getRequestingTabId() {
    const url = new URL(location.href);
    return parseInt(url.searchParams.get('id'), 10);
}

function init() {
    const permissonBtn = document.getElementById('frame-perm-btn');
    const boxContent = document.getElementById('box-content');
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'waitForPermission') {
            console.log('waiting for permission', sender, sendResponse);
            permissonBtn.onclick = async () => {
                let granted = await Permission.requestFramePermission();
                if (granted) {
                    sendResponse(granted);
                    window.close();
                }
            };
            boxContent.style.visibility = 'visible';
            responseSender = sendResponse;
            return true;
        }
    });
}

document.addEventListener('DOMContentLoaded', init, false);
