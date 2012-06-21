// global variables to store state of the maps. Another version injected only in main page sets SCROLLMAPS_inframe to false
//if(SCROLLMAPS_inframe === undefined) var SCROLLMAPS_inframe = true;
SCROLLMAPS_inframe = (window.top !== window);

function inject_frame() {
    // dont activate this thing at all if the frame has no map
    if(document.getElementById('map')){
        new ScrollableMap(document.getElementById('map'), (SCROLLMAPS_inframe) ? ScrollableMap.TYPE_IFRAME : ScrollableMap.TYPE_WEB);
    }
}

window.addEventListener('DOMContentLoaded', inject_frame, false);
