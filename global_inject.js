function injectScript(src) {
    var script = document.createElement('script');
    script.src = chrome.extension.getURL(src);
    return script;
}

var scriptInjected = false;
document.addEventListener('load', function (event) {
    if (scriptInjected) return;
    scriptInjected = true;

    if (document.head.firstChild) {
        document.head.insertBefore(injectScript('inject_content.js'), document.head.firstChild);
    } else {
        document.head.appendChild(injectScript('inject_content.js'));
    }

    window.addEventListener('mapsFound', function (event) {
        new ScrollableMap(event.detail, ScrollableMap.TYPE_API);
    }, false);
}, true);

document.addEventListener('DOMContentLoaded', function () {
    var iframes = document.getElementsByTagName('iframe');
    for (var i in iframes) {
        if (isMapsURL(iframes[i].src)) {
            var bodyScrolls = (document.body.scrollHeight > window.innerHeight && $(document.body).css('overflow') != 'hidden');
            iframes[i].src += '#bodyScrolls=' + bodyScrolls;
        }
    }
}, true);

function isMapsURL(url) {
    var regex = /(map[sy]|ditu)\.google\.com/;
    return regex.test(url);
}
