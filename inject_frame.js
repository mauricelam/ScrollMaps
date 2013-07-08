/*global ScrollableMap */

var SM = SM || { count: 0 };
SM.inframe = (window.top !== window);

var retries = 3;

function injectNewMaps() {
    var elem = document.querySelectorAll('.widget-scene')[0];
    if (elem) {
        new ScrollableMap(elem, ScrollableMap.TYPE_NEWWEB, SM.count++);
    } else if (retries > 0) {
        // Retry a few times because the new map canvas is not installed on DOM load
        retries--;
        setTimeout(injectNewMaps, 1000);
    }
}

function injectFrame() {
    // dont activate this thing at all if the frame has no map
    var elem = document.getElementById('map');
    if (elem) {
        new ScrollableMap(elem, (SM.inframe) ? ScrollableMap.TYPE_IFRAME : ScrollableMap.TYPE_WEB, SM.count++);
    } else if (!SM.inframe) {
        injectNewMaps();
    }
}

window.addEventListener('DOMContentLoaded', injectFrame, false);
