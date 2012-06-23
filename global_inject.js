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

if (window.top == window) {
    document.addEventListener('DOMContentLoaded', function () {
        document.body.addEventListener('DOMSubtreeModified', updateBodyScrolls, false);
        window.addEventListener('resize', updateBodyScrolls, false);
        window.addEventListener('load', function () { setTimeout(updateBodyScrolls, 1000); }, false);
        function updateBodyScrolls () {
            var bodyScrolls = (document.body.scrollHeight > window.innerHeight && $(document.body).css('overflow') != 'hidden');
            if (SM.bodyScrolls !== bodyScrolls) {
                SM.bodyScrolls = bodyScrolls;
                chrome.extension.sendRequest({action: 'setBodyScrolls', value: bodyScrolls});
            }
        }
        updateBodyScrolls();
    }, true);
}

SM.injectScript = function(src) {
    var script = document.createElement('script');
    script.src = chrome.extension.getURL(src);
    return script;
};

SM.prepend = function (parent, child) {
    if (parent.firstChild) {
        parent.insertBefore(child, parent.firstChild);
    } else {
        parent.appendChild(child);
    }
};
