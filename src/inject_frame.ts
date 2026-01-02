import Permission from './permission';
import PrefManager from './pref';
import ScrollableMap, { MapType } from './ScrollableMap'

if ((window as any).SM_FRAME === undefined) {
  const SM_FRAME = { count: 0, inframe: window.top !== window };
  (window as any).SM_FRAME = SM_FRAME;

  let retries = 3;

  async function injectMaps() {
    let elem = document.getElementById('content-container');
    elem = elem || document.querySelector('[role=application]:has(canvas)');
    const minimap = document.getElementById('minimap');
    if (elem || minimap) {
      if (elem && !elem.hasAttribute('data-scrollmap')) {
        new ScrollableMap(elem, MapType.TYPE_GOOGLE_MAPS_WEB, SM_FRAME.count++, await PrefManager.getAllOptions());
      }
      if (minimap && !minimap.hasAttribute('data-scrollmap')) {
        new ScrollableMap(minimap, MapType.TYPE_GOOGLE_MAPS_WEB, SM_FRAME.count++, await PrefManager.getAllOptions());
      }
    }
    if ((!elem || !minimap) && retries > 0) {
      // Retry a few times because the new map canvas is not installed on DOM load
      retries--;
      setTimeout(injectMaps, 1000);
    }
  }

  async function injectFrame() {
    const elem = document.getElementById('map') || document.getElementById('mapDiv');
    if (elem) {
      new ScrollableMap(
        elem,
        (SM_FRAME.inframe) ? MapType.TYPE_GOOGLE_MAPS_IFRAME : MapType.TYPE_GOOGLE_MAPS_LEGACY,
        SM_FRAME.count++,
        await PrefManager.getAllOptions());
    } else if (!SM_FRAME.inframe) {
      injectMaps();
    }
  }

  if (Permission.isMapsSite(document.URL)) {
    if (document.readyState === "complete"
      || (document.readyState as string) === "loaded"
      || document.readyState === "interactive") {
      injectFrame();
    }
    window.addEventListener('DOMContentLoaded', injectFrame, false);
  }
}
