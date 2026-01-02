// @ts-nocheck
window.SM_INJECT = true;

(function () {
  window.SM_INJECT = true;

  var pref;
  var scrollability;
  var lastFocus;

  function init() {
    new Pref(function (newPref) {
      pref = newPref;
      scrollability = new Scrollability(pref);
      if (pref.enabled) {
        scrollability.enable();
      }
      addSMStyle();

      pref.subscribe(function (key, value) {
        if (key === 'enabled' && value) {
          scrollability.enable();
        } else if (key === 'enabled' && !value) {
          scrollability.disable();
        }
      });

      window.addEventListener('focus', function (event) {
        if (event.target === window || event.target === document) {
          return;
        }
        lastFocus = event.target;
      }, true);
    });
  }

  function SMLog(message) {
    if (SM_DEBUG) {
      console.log(message);
    }
  }

  function addSMStyle() {
    var style = document.createElement('style');
    style.textContent = '' +
      '.scrollmaps_enabled {' +
      'border: 2px solid #3879D9;' +
      'box-sizing: border-box;' +
      '}' +
      '.scrollmaps_enabled.scrollmaps_focused {' +
      'border-width: 3px;' +
      '}' +
      '';
    document.head.appendChild(style);
  }

  // Find all elements that can be made scrollable.
  // This is not an easy task, as there are many different map providers.
  // This is the basic heuristic used:
  // - The element must be a certain size to be a map.
  // - The element must not be a child of another map element.
  // - The element must have some sign that it is a map.
  //
  // The following signs are used to determine if an element is a map:
  // - Element has a class name containing "maps"
  // - Element has a child with a class name containing "maps"
  // - Element has a child with a "gm-" class name (for Google Maps)
  // - Element has a URL as a background image.
  //
  // Returns a list of elements that can be made scrollable.
  // Each element in the list has a "container" and a list of "shadowRoots"
  // from which the map was found.
  function findScrollableElements() {
    const MIN_MAP_SIZE = 200;
    const all = document.querySelectorAll('*:not(.scrollmaps_popup)');
    const results = [];

    // Finds elements in a document or shadow root.
    function findElementsIn(root) {
      let elements = [];
      try {
        elements = Array.from(root.querySelectorAll('*'));
      } catch (e) {
        // Can get "DOMException: Not allowed to query selector in a non-connected route"
        // in some cases.
        return [];
      }

      for (let el of elements) {
        let shadowRoot = el.shadowRoot;
        if (shadowRoot) {
          findElementsIn(shadowRoot).forEach(result => {
            result.shadowRoots.unshift(shadowRoot);
            results.push(result);
          });
        }
      }

      elements = elements.filter(el => {
        if (el.scrollWidth > MIN_MAP_SIZE && el.scrollHeight > MIN_MAP_SIZE && el.matches(
          // Heuristic for Google maps
          '[class*="maps"], [class*="Maps"], [aria-label*="Map"], [aria-label*="map"], a[href*="/maps/"], a[href*="/maps/"], ' +
          // Heuristic for Bing maps
          '.b_map')) {
          return true;
        }

        // Heuristic for Google maps, which uses a non-semantic class name for the map container
        if (el.matches('[class^="gm-"]')) {
          let parent = el.parentElement;
          while (parent) {
            if (parent.scrollWidth > MIN_MAP_SIZE && parent.scrollHeight > MIN_MAP_SIZE) {
              elements.push(parent);
            }
            parent = parent.parentElement;
          }
        }
        return false;
      });
      elements = elements.filter((el, i) => {
        // remove children of other maps
        for (let j = 0; j < elements.length; ++j) {
          if (i === j) continue;
          if (elements[j].contains(el)) {
            return false;
          }
        }
        return true;
      });

      return elements.map(el => { return { container: el, shadowRoots: [] }; });
    }

    results.push(...findElementsIn(document));
    return results;
  }

  // The ElementFinder is responsible for finding map elements.
  // It occasionally runs and looks for new maps.
  function ElementFinder() {
    let self = this;
    let timer;

    // A list of all elements that have been found, and their corresponding ScrollableMap instance.
    let foundElements = [];

    this.start = function () {
      if (timer) {
        return;
      }
      timer = window.setInterval(self.find, 1000);
    };

    this.stop = function () {
      if (timer) {
        window.clearInterval(timer);
        timer = null;
      }
    };

    this.find = function () {
      let elements = findScrollableElements();
      elements.forEach(element => {
        if (foundElements.findIndex(found => found.container === element.container) !== -1) {
          // already found this element
          return;
        }

        let map = new ScrollableMap(element.container, scrollability);
        let listeners = [];
        let focusTimer;

        function addFocusability(el, shadowRoot) {
          if (!el.hasAttribute('tabindex')) {
            el.setAttribute('tabindex', -1);
          }
          let focusListener = () => {
            el.classList.add('scrollmaps_focused');
            window.clearTimeout(focusTimer);
            focusTimer = window.setTimeout(function () {
              el.classList.remove('scrollmaps_focused');
            }, 500);
          };
          shadowRoot.addEventListener('focus', focusListener, true);
          listeners.push({
            el: shadowRoot,
            type: 'focus',
            listener: focusListener,
            capture: true,
          });
        }
        addFocusability(element.container, document);
        element.shadowRoots.forEach(shadowRoot => addFocusability(element.container, shadowRoot));
        element.container.classList.add('scrollmaps_enabled');

        foundElements.push({
          ...element,
          map: map,
          listeners: listeners,
        });

      });

      // Find elements that are no longer maps and remove them.
      for (let i = foundElements.length - 1; i >= 0; --i) {
        let found = foundElements[i];
        if (!document.contains(found.container) ||
          elements.findIndex(el => el.container === found.container) === -1) {
          found.listeners.forEach(l => l.el.removeEventListener(l.type, l.listener, l.capture));
          found.container.classList.remove('scrollmaps_enabled');
          found.map.disable();
          foundElements.splice(i, 1);
        }
      }
    };

  }
  let elementFinder = new ElementFinder();
  elementFinder.start();

  function SMכהnabled() {
    elementFinder.find();
  }
  function SMכהisabled() {
  }

  // For Google maps, we inject some code into the page to get access to their
  // internal map object. This allows us to do a few things that aren't possible
  // otherwise, such as getting the current map location.
  if (window.location.host.match(/^(www|maps)\.google\./)) {
    let script = document.createElement('script');
    script.textContent = `
    (function() {
      if (window.SM_HOOK) {
        return;
      }
      window.SM_HOOK = true;
      let originalAddListener = google.maps.event.addListener;
      google.maps.event.addListener = function(...args) {
        if (args[1] === 'wheel') {
          return {remove: () => {}};
        }
        return originalAddListener.apply(this, args);
      };
    })();
    `;
    document.documentElement.appendChild(script);
  }


  document.addEventListener('SrollMapsSetFocus', function (event) {
    new ScrollableMap(event.detail.element, SM_INJECT.scrollability).setFocus();
  });


  init();
})();
