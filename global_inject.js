/*global $ Message ScrollableMap */

var SM = SM || { count: 0 };
SM.scriptInjected = false;

document.addEventListener('load', function (event) {
    if (SM.scriptInjected) return;
    SM.scriptInjected = true;

    document.head.insertBefore(SM.injectScript('inject_content.js'), document.head.firstChild);

    window.addEventListener('mapsFound', function (event) {
        var map = event.target;
        new ScrollableMap(map, ScrollableMap.TYPE_API, SM.count++);
    }, false);
}, true);

Message.extension.addListener(function (action, data, sender, sendResponse) {
    switch (action) {
        case 'listenBodyScrolls':
            if (window.top === window) {
                // document.body.addEventListener('DOMSubtreeModified', SM.updateBodyScrolls, false);
                window.addEventListener('resize', SM.updateBodyScrolls, false);
                window.addEventListener('load', function () { setTimeout(SM.updateBodyScrolls, 1000); }, false);
                SM.updateBodyScrolls();
            }
            break;
    }
});

SM.updateBodyScrolls = function () {
    var bodyScrolls = (document.body.scrollHeight > window.innerHeight && $(document.body).css('overflow') != 'hidden');
    if (SM.bodyScrolls !== bodyScrolls) {
        SM.bodyScrolls = bodyScrolls;
        Message.extension.sendMessage('setBodyScrolls', { scrolls: bodyScrolls });
    }
};

SM.injectScript = function(src) {
    var script = document.createElement('script');
    script.src = Extension.getURL(src);
    return script;
};