// @ts-nocheck
window.SM_FRAME_INJECT = true;

chrome.runtime.onMessage.addListener(
  function (message, sender, sendResponse) {
    if (message.message === 'scrollmaps-permission-check') {
      isSiteOnPermissionList(window.location.href, function (isAllowed) {
        sendResponse({ isAllowed: isAllowed });
      });
      return true;
    }
  }
);

window.addEventListener('message', function (event) {
  if (event.data.message === 'scrollmaps-ask-permission') {
    window.parent.postMessage({
      message: 'scrollmaps-ask-permission-from-frame',
    }, '*');
  } else if (event.data.message === 'scrollmaps-remove-permission') {
    window.parent.postMessage({
      message: 'scrollmaps-remove-permission-from-frame',
    }, '*');
  }
});
