/*global safari */

var bodyScrolls = {};
safari.application.addEventListener('message', function (event) {
    if (event.name == 'listenBodyScrolls') {
        event.target.page.dispatchMessage('listenBodyScrolls', null);
    }
    if (event.name == 'setBodyScrolls') {
        bodyScrolls[event.target] = event.message;
        event.target.page.dispatchMessage('setBodyScrolls', bodyScrolls[event.target]);
    }
}, false);
