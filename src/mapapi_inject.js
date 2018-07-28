/*global $ Message ScrollableMap */

console.log('Map API injected');

var SM = SM || { count: 0 };

SM.injectScript = function(host, src) {
    // // This is the least intrusive way to inject javascript into the DOM that I can
    // // think of, because this only executes the script and does not add or alter the
    // // DOM in any way.
    // var xhr = new XMLHttpRequest();
    // xhr.open("GET", Extension.getURL(src), false);
    // xhr.send();
    // // Note: The script should be a minified one so that it doesn't contain line
    // // comments, new lines and other stuff that will pollute the javascript: url
    // var scriptBody = xhr.responseText;
    // location.href = 'javascript:' + xhr.responseText;

    var script = document.createElement('script');
    script.setAttribute('id', '..scrollmaps_inject');
    script.src = Extension.getURL(src);
    host.insertBefore(script, host.firstChild);
    if (host.contains(script)) {
        host.removeChild(script);
    } else {
        console.warn('Unable to remove injected script element');
    }
};

// Init

if (document.URL.split('.').pop(0).toLowerCase() !== 'pdf') {
    SM.injectScript(document.documentElement, 'inject_content.min.js');

    window.addEventListener('mapsFound', function (event) {
        var map = event.target;
        new ScrollableMap(map, event.detail.type, SM.count++);
    }, true);
} else {
    // Don't run on PDF files. There seems to be a conflict between the built-in Chrome PDF plugin
    // and how the script tag is injected.
    console.log('ScrollMaps: Skipping PDF file');
}
