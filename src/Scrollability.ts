// @ts-nocheck
window.Scrollability = true;

(function () {
  'use strict';
  window.Scrollability = true;

  // Manages finding and attaching to maps.
  // This is a singleton.
  function Scrollability(pref) {
    var self = this;
    var isEnabled = false;

    // A list of all elements that have been found, and their corresponding ScrollableMap instance.
    let foundElements = [];

    function findMapElements(doc) {
      if (!doc) {
        return [];
      }
      return Array.from(doc.querySelectorAll('*')).filter(el => {
        if (!el.scrollWidth || el.scrollWidth < 200 || !el.scrollHeight || el.scrollHeight < 200) {
          return false;
        }
        if (el.classList.contains('gm-style') || el.classList.contains('mapboxgl-map')) {
          return true;
        }

        // Check if element has a shadow root. If so, check for maps in the shadow root.
        if (el.shadowRoot) {
          let shadowChildren = findMapElements(el.shadowRoot);
          if (shadowChildren.length > 0) {
            // Bing maps has a wrapper around the actual map element.
            // We want to attach to the wrapper.
            if (el.shadowRoot.host.id === 'bing-maps-root') {
              return true;
            }
          }
        }
        return false;
      }).map(el => {
        // Find parent-most map element
        let parent = el.parentElement;
        while (parent) {
          if (parent.classList.contains('gm-style')) {
            el = parent;
          }
          parent = parent.parentElement;
        }
        return el;
      }).filter((el, i, arr) => {
        // remove children of other maps
        for (var j = 0; j < arr.length; ++j) {
          if (i === j) continue;
          if (arr[j].contains(el)) {
            return false;
          }
        }
        return true;
      });
    }

    function find() {
      if (!isEnabled) {
        return;
      }

      let elements = findMapElements(document);
      elements.forEach(element => {
        if (foundElements.findIndex(found => found.container === element) !== -1) {
          // already found this element
          return;
        }

        let map = new ScrollableMap(element, self);

        foundElements.push({
          container: element,
          map: map,
        });

      });

      // Find elements that are no longer maps and remove them.
      for (let i = foundElements.length - 1; i >= 0; --i) {
        let found = foundElements[i];
        if (!document.body.contains(found.container) ||
          elements.findIndex(el => el === found.container) === -1) {
          found.map.disable();
          foundElements.splice(i, 1);
        }
      }
    }

    this.enable = function () {
      if (isEnabled) {
        return;
      }
      isEnabled = true;
      window.setInterval(find, 1000);
      find();
      if (window.top === window) {
        window.addEventListener('message', function (event) {
          if (!Scrollability.isAllowedDomain(event.origin)) {
            return;
          }
          if (event.data.message === 'scrollmaps-focus-iframe') {
            for (var i = 0; i < foundElements.length; ++i) {
              // find the iframe that contains this element and focus it
              var iframes = document.querySelectorAll('iframe');
              for (var j = 0; j < iframes.length; ++j) {
                if (iframes[j].contentWindow === event.source) {
                  iframes[j].focus();
                  break;
                }
              }
            }
          }
        });
      }
    };
    this.disable = function () {
      if (!isEnabled) {
        return;
      }
      isEnabled = false;
      foundElements.forEach(found => {
        found.map.disable();
      });
      foundElements = [];
    };
    this.focus = function () {
      if (window.top !== window) {
        window.top.postMessage({ message: 'scrollmaps-focus-iframe' }, '*');
      }
    };

    this.pref = pref;
  }

  Scrollability.isAllowedDomain = function (domain) {
    if (domain.match(/google\./)) {
      return true;
    }
    return false;
  };
})();
