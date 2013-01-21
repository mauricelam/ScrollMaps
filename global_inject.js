/*global $ safari ScrollableMap */

var SM = SM || {};
SM.scriptInjected = false;

document.addEventListener('load', function (event) {
    if (SM.scriptInjected) return;
    SM.scriptInjected = true;

    SM.prepend(document.head, SM.injectScript('inject_content.js'));

    window.addEventListener('mapsFound', function (event) {
        new ScrollableMap(event.detail, ScrollableMap.TYPE_API);
    }, false);
}, true);

safari.self.addEventListener('message', function (event) {
    if (event.name === 'listenBodyScrolls') {
        if (window.top == window) {
            document.body.addEventListener('DOMSubtreeModified', SM.updateBodyScrolls, false);
            window.addEventListener('resize', SM.updateBodyScrolls, false);
            window.addEventListener('load', function () { setTimeout(SM.updateBodyScrolls, 1000); }, false);
            SM.updateBodyScrolls();
        }
    }
}, false);

SM.updateBodyScrolls = function () {
    var bodyScrolls = (document.body.scrollHeight > window.innerHeight && $(document.body).css('overflow') != 'hidden');
    if (SM.bodyScrolls !== bodyScrolls) {
        SM.bodyScrolls = bodyScrolls;
        safari.self.tab.dispatchMessage('setBodyScrolls', bodyScrolls);
    }
};

SM.injectScript = function(src) {
    var script = document.createElement('script');
    script.src = safari.extension.baseURI + src;
    return script;
};

SM.prepend = function (parent, child) {
    if (parent.firstChild) {
        parent.insertBefore(child, parent.firstChild);
    } else {
        parent.appendChild(child);
    }
};
