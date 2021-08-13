/*global ScrollableMap */

let SM = SM || { count: 0 };
SM.inframe = (window.top !== window);

let retries = 3;

function injectMaps() {
    const elem = document.getElementById('content-container');
    if (elem) {
        new ScrollableMap(elem, ScrollableMap.TYPE_NEWWEB, SM.count++);
    } else if (retries > 0) {
        // Retry a few times because the new map canvas is not installed on DOM load
        retries--;
        setTimeout(injectMaps, 1000);
    }
}

function injectFrame() {
    let elem = document.getElementById('map');
    elem = elem || document.getElementById('mapDiv');
    if (elem) {
        new ScrollableMap(
            elem,
            (SM.inframe) ? ScrollableMap.TYPE_IFRAME : ScrollableMap.TYPE_WEB,
            SM.count++);
    } else if (!SM.inframe) {
        injectMaps();
    }
}

window.addEventListener('DOMContentLoaded', injectFrame, false);
