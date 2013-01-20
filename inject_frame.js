/*global ScrollableMap */

var SM = SM || {};
SM.inframe = (window.top !== window);

function injectFrame() {
    // dont activate this thing at all if the frame has no map
    if(document.getElementById('map')){
        new ScrollableMap(document.getElementById('map'), (SM.inframe) ? ScrollableMap.TYPE_IFRAME : ScrollableMap.TYPE_WEB);
    }
}

window.addEventListener('DOMContentLoaded', injectFrame, false);
