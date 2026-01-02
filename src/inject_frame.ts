// @ts-nocheck
window.SM_FRAME = true;

(function () {
  'use strict';
  SM_FRAME = true; // global in this file

  var pref;
  var scrollability;

  function init() {
    new Pref(function (newPref) {
      pref = newPref;
      scrollability = {
        pref: pref,
        setEnabled: function (enabled) {
          window.parent.postMessage({
            message: 'scrollmaps-enabled',
            enabled: enabled
          }, document.referrer);
        },
        focus: function () {
          window.parent.postMessage({ message: 'scrollmaps-focus-iframe' }, document.referrer);
        }
      };

      isSiteOnPermissionList(window.location.href, function (isAllowed) {
        if (isAllowed) {
          findMaps();
        }
      });
    });
  }

  function findMaps() {
    var map = document.querySelector('.gm-style');
    if (map) {
      new ScrollableMap(map, scrollability, ScrollableMap.TYPE_GOOGLE_MAPS_WEB);
    }
    var embedMap = document.querySelector('#map_canvas');
    if (embedMap) {
      new ScrollableMap(
        embedMap, scrollability, ScrollableMap.TYPE_GOOGLE_MAPS_IFRAME,
        document.querySelector('.embed-map-container-is-scroll-wheel-disabled'));
    }
    var legacyMap = document.querySelector('#routemap');
    if (legacyMap) {
      new ScrollableMap(legacyMap, scrollability, ScrollableMap.TYPE_GOOGLE_MAPS_LEGACY);
    }
    var streetView = document.querySelector('#streetview');
    if (streetView) {
      new ScrollableMap(streetView, scrollability);
    }
  }

  // Delay init until page is loaded
  if (document.readyState === 'complete' || document.readyState === 'loaded' ||
    document.readyState === 'interactive') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', function (event) {
      init();
    });
  }

})();
