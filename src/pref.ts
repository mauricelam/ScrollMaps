// @ts-nocheck
'use strict';

function Pref(callback) {
  var self = this;
  var listeners = {};
  var pref = {
    'enabled': true,
    'invert-scroll': false,
    'invert-zoom': false,
    'isolate-zoom-scroll': true,
    'frame-require-focus': true,
    'scroll-speed': 4,
    'zoom-speed': 10,
  };
  var a = document.createElement('a');
  function getHostname(url) {
    a.href = url;
    return a.hostname;
  }
  function isSubdomain(subdomain, domain) {
    if (!subdomain) {
      return false;
    }
    var regex = new RegExp('.*\\.' + domain + '$');
    return subdomain.match(regex);
  }

  function prefToStorage(label) {
    return 'pref-' + label;
  }
  function storageToPref(label) {
    if (label.indexOf('pref-') === 0) {
      return label.substring(5);
    }
    return null;
  }

  this.getAll = function () {
    return pref;
  };

  chrome.storage.sync.get(null, function (items) {
    for (var key in items) {
      var prefKey = storageToPref(key);
      if (prefKey) {
        pref[prefKey] = items[key];
      }
    }
    callback(self);
  });

  this.get = function (key) {
    return pref[key];
  };

  this.set = function (key, value) {
    pref[key] = value;
    var storage = {};
    storage[prefToStorage(key)] = value;
    chrome.storage.sync.set(storage);
  };

  this.subscribe = function (key, func) {
    if (!listeners[key]) {
      listeners[key] = [];
    }
    listeners[key].push(func);
  };

  chrome.storage.onChanged.addListener(function (changes, area) {
    for (var key in changes) {
      var prefKey = storageToPref(key);
      if (prefKey) {
        pref[prefKey] = changes[key].newValue;
        if (listeners[prefKey]) {
          listeners[prefKey].forEach(function (func) {
            func(prefKey, pref[prefKey]);
          });
        }
      }
    }
  });

  chrome.runtime.onMessage.addListener(
    function (message, sender, sendResponse) {
      if (message.pref) {
        for (var key in message.pref) {
          self.set(key, message.pref[key]);
        }
      }
    });
}
if (window.location.protocol !== 'chrome-extension:') {
  var pref;
  window.addEventListener('message', function (event) {
    if (event.data.message === 'scrollmaps-get-pref-response') {
      pref = event.data.pref;
    }
  });
  window.parent.postMessage({ message: 'scrollmaps-get-pref' }, '*');
}
