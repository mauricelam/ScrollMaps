if (window.SM_FRAME === undefined) {
    window.SM_FRAME = { count: 0 };
    SM_FRAME.inframe = (window.top !== window);

    let retries = 3;

    async function injectMaps() {
        const elem = document.getElementById('content-container');
        if (elem) {
            new ScrollableMap(elem, ScrollableMap.TYPE_NEWWEB, SM_FRAME.count++, await Pref.getAllOptions());
        } else if (retries > 0) {
            // Retry a few times because the new map canvas is not installed on DOM load
            retries--;
            setTimeout(injectMaps, 1000);
        }
    }

    async function injectFrame() {
        let elem = document.getElementById('map');
        elem = elem || document.getElementById('mapDiv');
        if (elem) {
            new ScrollableMap(
                elem,
                (SM_FRAME.inframe) ? ScrollableMap.TYPE_IFRAME : ScrollableMap.TYPE_WEB,
                SM_FRAME.count++,
                await Pref.getAllOptions());
        } else if (!SM_FRAME.inframe) {
            injectMaps();
        }
    }

    window.addEventListener('DOMContentLoaded', injectFrame, false);

}
