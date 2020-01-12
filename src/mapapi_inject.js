/*global $ Message ScrollableMap */

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

function _matchAncestor(node, predicate) {
    if (predicate(node)) {
        return node;
    }
    if (node.parentNode && node.parentNode !== node) {
        return _matchAncestor(node.parentNode, predicate);
    }
    return null;
}

let GoogleMapFinder = {};

GoogleMapFinder._findGmStyleMap = function() {
    return Array.from(document.querySelectorAll('.gm-style'))
        .filter(container =>
            _querySrc(container, 'img',
                [
                    '//maps.googleapis.com/maps/',
                    '//www.google.com/maps/',
                    '//maps.google.com/maps/'
                ])
                || container.querySelector('canvas'))
        .map(container => container.parentNode);
};

function _querySrc(container, tag, possible_substrings) {
    for (let elem of container.querySelectorAll(tag)) {
        for (let substring of possible_substrings) {
            if (elem.src.indexOf(substring) !== -1) {
                return true;
            }
        }
    }
    return false;
}

GoogleMapFinder._findFallbackMap = function() {
    let foundImages = Array.from(
        document.querySelectorAll('img[src*="//maps.googleapis.com/maps/"]'));
    // To handle multiple maps on the same page, we make the threshold
    // number of images / 4. We consider the common ancestor to be found below
    // that threshold.
    let foundThreshold = foundImages.length / 4;
    for (let i = 0; i < 5; i++) {
        // Walk maximum 5 levels to find the common ancestor
        foundImages = foundImages.map(img => img.parentNode);
        foundSet = new Set(foundImages);
        if (foundSet.size <= foundThreshold) {
            return Array.from(foundSet)
                .map(container => _matchAncestor(container,
                    node => $(node).is(':visible')
                        && $(node).height() > 1
                        && $(node).width() > 1));
        }
    }
    return [];
}

GoogleMapFinder.findMaps = function() {
    let mapContainers = GoogleMapFinder._findGmStyleMap();
    if (mapContainers.length > 0) {
        return mapContainers;
    }

    mapContainers = GoogleMapFinder._findFallbackMap();
    return mapContainers;
}

function scrollifyExistingMaps() {
    maps = GoogleMapFinder.findMaps();
    if (DEBUG) {
        console.log('existing maps', maps);
    }
    if (maps.length <= 0) {
        return false;
    }
    for (map of maps) {
        new ScrollableMap(map, ScrollableMap.TYPE_API, SM.count++);
    }
    return true;
}

function poll(func, timeout, count) {
    if (count <= 0) {
        return;
    }
    window.setTimeout(() => {
        if (!func()) {
            poll(func, timeout, count - 1);
        }
    }, timeout);
}

// Init
SM.injectScript(document.documentElement, 'inject_content.min.js');
poll(scrollifyExistingMaps, 1000, 5);

window.addEventListener('mapsFound', function (event) {
    var map = event.target;
    new ScrollableMap(map, event.detail.type, SM.count++);
}, true);
