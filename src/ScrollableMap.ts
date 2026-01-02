// @ts-nocheck
/*
 * Copyright 2017 Maurice Lam
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

// var SM_DEBUG = true;
var SM_DEBUG = false;

function SMLog(message) {
  if (SM_DEBUG) {
    console.log(message);
  }
}

function getEventSource(event) {
  if (event.srcElement) {
    return event.srcElement;
  } else if (event.target) {
    return event.target;
  }
  return null;
}

// target: a DOM element
// returns the first ancestor of target that has the specified tagName
// or null if no such ancestor exists
function findAncestorByTagName(target, tagName) {
  var parent = target.parentElement;
  while (parent) {
    if (parent.tagName === tagName) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}

function findAncestorByClassName(target, className) {
  var parent = target.parentElement;
  while (parent) {
    if (parent.classList.contains(className)) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}

function isDescendant(parent, child) {
  var node = child.parentElement;
  while (node !== null) {
    if (node === parent) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

function onNextRepaint(callback) {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(callback);
  });
}

function eventHasCtrlKey(event) {
  return event.ctrlKey || event.metaKey;
}

/**
 * Creates a new ScrollableMap.
 *
 * @constructor
 * @param {Element} target The element that should be scrollable.
 * @param {Scrollability} scrollability A scrollability object that can be
 * used to control the scrolling behavior of this map.
 */
function ScrollableMap(target, scrollability) {
  var self = this;

  var pref = scrollability.pref;

  var Mode = {
    SCROLL: 0,
    ZOOM: 1
  };
  var lastMode = Mode.SCROLL;
  var lastEventTime = Date.now();
  var scrollAmount = 0;
  var gestureDetector = new GestureDetector(target);

  var mapTypes = {
    google: {
      detect: function () {
        return (window.location.host.match(/^(www|maps)\.google\./) ||
          window.location.host.match(/mapy\.google\.pl/) ||
          window.location.host.match(/ditu\.google\.cn/)) !== null;
      },
      // for new google maps, zoom is center-anchored
      // for old google maps, zoom is cursor-anchored
      // old google maps has a # button for classic UI
      // old google maps doesn't have a body.app-mode
      zoomCursorAnchored: function () {
        return document.body.classList.contains('vasquette') ||  // classic maps
          !document.body.classList.contains('app-mode');     // lite maps
      },
      getExtraZoomElements: function (target) {
        if (!document.querySelector('.app-zoom-in-button')) {
          // old google maps, bing maps
          return [target];
        } else {
          // new google maps
          return [target, document.querySelector('canvas')];
        }
      },
      getExtraScrollElements: function (target) {
        if (!document.querySelector('.app-zoom-in-button')) {
          return [target];
        } else {
          return [target, document.querySelector('canvas')];
        }
      },
      getDragSimulator: function () {
        var ds = new DragSimulator();
        ds.opts.mapType = 'google';
        ds.opts.prepDrag = function (target, point) {
          // For google maps, we want to start the drag at the center of the map.
          // This seems to allow a larger scroll amount before the map stops dragging.
          // I think this is because Google Maps limits dragging based on cursor position.
          ds.mouseDownPoint = { x: target.clientWidth / 2, y: target.clientHeight / 2 };
        };
        return ds;
      },
    },

    newbing: {
      detect: function () {
        return window.location.host.match(/www\.bing\.com\/maps/) &&
          document.querySelector('.b_mapUnfortunately') === null &&
          document.querySelector('#b_map') !== null;
      },
      zoomCursorAnchored: false,
      getDragSimulator: function () {
        var ds = new DragSimulator();
        ds.opts.mapType = 'newbing';
        ds.opts.prepDrag = function (target, point) {
          ds.mouseDownPoint = point;
        };
        ds.opts.moveEvent = 'mousemove';
        ds.opts.upEvent = 'mouseup';
        return ds;
      },
    },

    classicbing: {
      detect: function () {
        return window.location.host.match(/www\.bing\.com\/maps/) &&
          document.querySelector('.b_mapUnfortunately') !== null;
      },
      zoomCursorAnchored: true,
      getDragSimulator: function () {
        var ds = new DragSimulator();
        ds.opts.mapType = 'classicbing';
        ds.opts.prepDrag = function (target, point) {
          ds.mouseDownPoint = point;
        };
        return ds;
      },
    },

    waze: {
      detect: function () {
        return window.location.host.match(/www\.waze\.com/);
      },
      zoomCursorAnchored: false,
      getDragSimulator: function () {
        var ds = new DragSimulator();
        ds.opts.mapType = 'waze';
        ds.opts.prepDrag = function (target, point) {
          ds.mouseDownPoint = { x: target.clientWidth / 2, y: target.clientHeight / 2 };
        };
        return ds;
      },
    },

    here: {
      detect: function () {
        return window.location.host.match(/www\.here\.com/);
      },
      zoomCursorAnchored: false,
      getDragSimulator: function () {
        var ds = new DragSimulator();
        ds.opts.mapType = 'here';
        ds.opts.prepDrag = function (target, point) {
          ds.mouseDownPoint = point;
        };
        return ds;
      },
    },

    openstreetmap: {
      detect: function () {
        return window.location.host.match(/www\.openstreetmap\.org/);
      },
      zoomCursorAnchored: false,
      getDragSimulator: function () {
        var ds = new DragSimulator();
        ds.opts.mapType = 'openstreetmap';
        ds.opts.prepDrag = function (target, point) {
          ds.mouseDownPoint = point;
        };
        return ds;
      },
    },

    wikimapia: {
      detect: function () {
        return window.location.host.match(/wikimapia\.org/);
      },
      zoomCursorAnchored: true,
      getDragSimulator: function () {
        var ds = new DragSimulator();
        ds.opts.mapType = 'wikimapia';
        ds.opts.prepDrag = function (target, point) {
          ds.mouseDownPoint = point;
        };
        return ds;
      },
    },

    yandex: {
      detect: function () {
        return window.location.host.match(/yandex\.(com|ru)\/maps/);
      },
      zoomCursorAnchored: false,
      getDragSimulator: function () {
        var ds = new DragSimulator();
        ds.opts.mapType = 'yandex';
        ds.opts.prepDrag = function (target, point) {
          ds.mouseDownPoint = point;
        };
        return ds;
      },
    },

    mapy_cz: {
      detect: function () {
        return window.location.host.match(/mapy\.cz/);
      },
      zoomCursorAnchored: false,
      getDragSimulator: function () {
        var ds = new DragSimulator();
        ds.opts.mapType = 'mapy_cz';
        ds.opts.prepDrag = function (target, point) {
          ds.mouseDownPoint = point;
        };
        return ds;
      },
    },

    generic: {
      detect: function () { return true; },
      zoomCursorAnchored: true,
      getDragSimulator: function () {
        var ds = new DragSimulator();
        ds.opts.mapType = 'generic';
        ds.opts.prepDrag = function (target, point) {
          ds.mouseDownPoint = point;
        };
        return ds;
      },
    }
  };
  var mapType = getMapType();
  var dragSimulator = mapType.getDragSimulator();

  SMLog('ScrollableMap created for ' + mapType.getDragSimulator().opts.mapType + ' maps');
  SMLog(target);

  function getMapType() {
    for (var i in mapTypes) {
      if (mapTypes[i].detect()) {
        return mapTypes[i];
      }
    }
  }

  function simulateCtrlWheel(element, delta, point) {
    if (mapType.zoomCursorAnchored) {
      mouseMove(element, point);
    }

    var event = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: delta,
      modifiers: ['ctrl'],
      clientX: point ? point.x : undefined,
      clientY: point ? point.y : undefined,
    });
    event.ctrlKey = true;
    element.dispatchEvent(event);
  }

  function mouseMove(element, point) {
    element.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      clientX: point.x,
      clientY: point.y,
    }));
  }

  function doScroll(delta, point) {
    lastMode = Mode.SCROLL;

    // TODO: support horizontal scrolling
    dragSimulator.simulateDrag(target, { x: 0, y: -delta }, point,
      mapType.getExtraScrollElements ? mapType.getExtraScrollElements(target) : undefined);
  }

  function doZoom(delta, point) {
    if (eventHasCtrlKey(gestureDetector.lastEvent)) {
      // If ctrl key is pressed, let the browser handle it (usually triggers browser zoom)
      return;
    }

    lastMode = Mode.ZOOM;

    if (pref.isolateZoomScroll) {
      if (Math.abs(scrollAmount) < 20) {
        scrollAmount += delta;
        return;
      }
      delta += scrollAmount;
      scrollAmount = 0;
    }

    simulateCtrlWheel(target, delta, point);

    if (mapType.getExtraZoomElements) {
      mapType.getExtraZoomElements(target).forEach(el => {
        if (el !== target) {
          simulateCtrlWheel(el, delta, point);
        }
      });
    }

  }

  function getMode(event) {
    if (event.shiftKey) {
      return Mode.ZOOM;
    } else if (event.ctrlKey) {
      return Mode.SCROLL;
    }
    var time = Date.now();
    var mode = lastMode;
    if (time - lastEventTime > 300) {
      // If there's a pause, choose mode based on first scroll direction.
      // Need to use wheelDelta instead of deltaY as sign is more reliable.
      if (Math.abs(event.wheelDeltaX) > Math.abs(event.wheelDeltaY)) {
        mode = Mode.ZOOM;
      } else {
        mode = Mode.SCROLL;
      }
    }
    lastEventTime = time;
    return mode;
  }

  this.handleEvent = function (event) {
    SMLog(event);
    if (event.type !== 'wheel') {
      return;
    }
    if (event.button !== 0) {
      // We only care about left clicks, not middle or right clicks.
      // For some reason, mouse wheel events can have a non-zero button.
      // We ignore these events.
      return;
    }
    if (pref.frameRequireFocus && window.top !== window && document.activeElement.tagName !== 'CANVAS' &&
      !isDescendant(document.activeElement, target)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    scrollability.setEnabled(true);

    var delta = pref.invertScroll ? -event.deltaY : event.deltaY;
    var point = { x: event.clientX, y: event.clientY };

    var mode;
    if (pref.enableZoom) {
      mode = getMode(event);
    } else {
      mode = Mode.SCROLL;
    }
    if (mode === Mode.ZOOM) {
      doZoom(delta, point);
    } else {
      doScroll(delta, point);
    }
  };

  target.addEventListener('wheel', this, { capture: true, passive: false });
  // Some maps have an inner element that has the wheel listener.
  // We add our own wheel listener to that inner element so we can intercept
  // the events and stop them from propagating.
  if (target.id === 'map') {
    var innerMap = target.querySelector('#map_canvas');
    if (innerMap) {
      innerMap.addEventListener('wheel', this, { capture: true, passive: false });
    }
  }

  SMLog('Attaching to gesture detector');
  gestureDetector.listener = {
    onGestureStart: (point) => {
      lastMode = Mode.ZOOM;
      SMLog('Gesture started');
      dragSimulator.cancel();
      mouseMove(target, point);
    },
    onGestureChange: (scale, point) => {
      if (pref.enableZoom) {
        var delta = (1 - scale) * pref.zoomSpeed * 2;
        SMLog('Zooming: ' + delta);
        doZoom(delta, point);
      }
    },
  };

  this.disable = function () {
    target.removeEventListener('wheel', this, { capture: true, passive: false });
  };
}

/**
 * Creates a new DragSimulator.
 * A drag simulator listens to mouse events on an element and simulates drags
 * by generating mousedown, mousemove, and mouseup events.
 * @constructor
 */
function DragSimulator() {

  this.opts = {};
  var self = this;
  var lastPoint = null;
  var STEADY_TIMEOUT = 100;
  var STEADY_MAX_WAIT = 500;
  var steadyTimer = null;
  var steadyMaxWaitTimer = null;

  function cancelSteadyTimer() {
    if (steadyTimer) {
      window.clearTimeout(steadyTimer);
      steadyTimer = null;
    }
  }
  function resetSteadyTimer(target, extraElements) {
    cancelSteadyTimer();
    steadyTimer = window.setTimeout(function () {
      steady(target, extraElements);
      steadyTimer = null;
    }, STEADY_TIMEOUT);
  }

  function cancelSteadyMaxWaitTimer() {
    if (steadyMaxWaitTimer) {
      window.clearTimeout(steadyMaxWaitTimer);
      steadyMaxWaitTimer = null;
    }
  }
  function resetSteadyMaxWaitTimer(target, extraElements) {
    if (!steadyMaxWaitTimer) {
      steadyMaxWaitTimer = window.setTimeout(function () {
        steady(target, extraElements);
      }, STEADY_MAX_WAIT);
    }
  }

  function steady(target, extraElements) {
    cancelSteadyTimer();
    cancelSteadyMaxWaitTimer();
    if (lastPoint) {
      self.simulateMouseUp(target, extraElements);
      lastPoint = null;
    }
  }

  function getEvent(name, point) {
    if (name === 'mousemove' || name === 'mouseup') {
      return new MouseEvent(name, {
        bubbles: true,
        cancelable: true,
        clientX: point.x,
        clientY: point.y,
        buttons: 1, // left button
      });
    } else {
      return new MouseEvent(name, {
        bubbles: true,
        cancelable: true,
        clientX: point.x,
        clientY: point.y,
      });
    }
  }

  this.simulateMouseDown = function (target, point) {
    var event = getEvent(this.opts.downEvent || 'mousedown', point);
    SMLog(event);
    target.dispatchEvent(event);
  };
  this.simulateMouseMove = function (target, point) {
    var event = getEvent(this.opts.moveEvent || 'mousemove', point);
    SMLog(event);
    target.dispatchEvent(event);
  };
  this.simulateMouseUp = function (target, extraElements) {
    SMLog('steady');
    var event = getEvent(this.opts.upEvent || 'mouseup', lastPoint);
    SMLog(event);
    target.dispatchEvent(event);
    if (extraElements) {
      extraElements.forEach(el => el.dispatchEvent(getEvent(this.opts.upEvent || 'mouseup', lastPoint)));
    }
  };

  this.simulateDrag = function (target, delta, cursorPoint, extraElements) {
    if (lastPoint) {
      this.simulatedMousePoint = {
        x: lastPoint.x + delta.x,
        y: lastPoint.y + delta.y,
      };
      this.simulateMouseMove(target, this.simulatedMousePoint);
    } else {
      this.opts.prepDrag(target, cursorPoint);
      this.simulatedMousePoint = this.mouseDownPoint;
      this.simulateMouseDown(target, this.simulatedMousePoint);
      onNextRepaint(() => {
        this.simulateMouseMove(target, {
          x: this.simulatedMousePoint.x + delta.x,
          y: this.simulatedMousePoint.y + delta.y,
        });
        this.simulatedMousePoint = {
          x: this.simulatedMousePoint.x + delta.x,
          y: this.simulatedMousePoint.y + delta.y,
        };
      });
    }
    lastPoint = this.simulatedMousePoint;
    resetSteadyTimer(target, extraElements);
    resetSteadyMaxWaitTimer(target, extraElements);
  };

  this.cancel = function () {
    steady(document.body);
  };
}

/**
 * Creates a new GestureDetector which detects pinch-zoom gestures.
 * @param {Element} target The element to attach the gesture detector to.
 */
function GestureDetector(target) {
  var self = this;
  var pointerCache = {};
  var prevDist = -1;

  function removeEvent(event) {
    delete pointerCache[event.pointerId];
  }

  function onPointerUp(event) {
    removeEvent(event);
    prevDist = -1;
  }

  function getMidPoint() {
    var keys = Object.keys(pointerCache);
    var p1 = pointerCache[keys[0]];
    var p2 = pointerCache[keys[1]];
    return {
      x: (p1.clientX + p2.clientX) / 2,
      y: (p1.clientY + p2.clientY) / 2
    };
  }

  this.listener = null;
  this.lastEvent = null;

  target.addEventListener('pointerdown', function (event) {
    self.lastEvent = event;
    pointerCache[event.pointerId] = event;
  });
  target.addEventListener('pointermove', function (event) {
    self.lastEvent = event;
    if (pointerCache[event.pointerId]) {
      pointerCache[event.pointerId] = event;
    }

    var keys = Object.keys(pointerCache);
    if (keys.length === 2) {
      var p1 = pointerCache[keys[0]];
      var p2 = pointerCache[keys[1]];
      var dist = Math.sqrt(Math.pow(p1.clientX - p2.clientX, 2) + Math.pow(p1.clientY - p2.clientY, 2));

      if (self.listener) {
        if (prevDist > 0) {
          self.listener.onGestureChange(dist / prevDist, getMidPoint());
        } else {
          self.listener.onGestureStart(getMidPoint());
        }
      }
      prevDist = dist;
    }
  });

  target.addEventListener('pointerup', onPointerUp);
  target.addEventListener('pointercancel', onPointerUp);
  target.addEventListener('pointerout', onPointerUp);
  target.addEventListener('pointerleave', onPointerUp);
}

/**
 * A class to help simulate drags for different map types.
 *
 * Some map types require the cursor to be at a particular place before dragging.
 * This class helps abstract that out.
 *
 * @constructor
 * @param {string} mapType The type of map to simulate drags for.
 */
function DragSimulatorForMap(mapType) {
  var self = this;
  var cursorSetter;

  this.mapType = mapType;
  this.timer = null;
  this.opts = {
    // time in ms to wait before resetting cursor
    cursorResetDelay: 500
  };
  this.isDragging = function () {
    return !!self.timer;
  };
  this.willDrag = function () {
    return self.timer && self.timer !== -1;
  };
  this.startDrag = function (target, point) {
    // We get a timer event if we successfully start dragging.
    // If we don't, then we should use native scrolling.
    self.timer = -1;
    cursorSetter = new CursorSetter(target);
    cursorSetter.setCursor(point);
    self.timer = window.setTimeout(function () {
      self.timer = null;
      cursorSetter.resetCursor();
    }, self.opts.cursorResetDelay);
  };
  this.stopDrag = function (target) {
    if (self.timer) {
      window.clearTimeout(self.timer);
    }
    self.timer = null;
    if (cursorSetter) {
      cursorSetter.resetCursor();
    }
  };
}

/**
 * A class to help with setting the cursor position.
 *
 * In order to simulate drags for certain map types, we need to temporarily
 * take over the cursor. This class helps with that.
 *
 * This class works by creating a div that overlays the entire page.
 * The cursor is hidden, and the div shows a fake cursor that is moved around.
 *
 * @constructor
 * @param {Element} parent The parent element to attach the cursor setter to.
 */
function CursorSetter(parent) {
  var self = this;
  var isCursorSet = false;
  var cursor = document.createElement('div');
  cursor.style.display = 'none';
  cursor.style.position = 'fixed';
  cursor.style.left = '0';
  cursor.style.top = '0';
  cursor.style.width = '100%';
  cursor.style.height = '100%';
  cursor.style.zIndex = '99999999';

  parent.appendChild(cursor);

  this.setCursor = function (point) {
    if (isCursorSet) {
      return;
    }
    document.body.style.cursor = 'none';
    cursor.style.cursor = 'move';
    cursor.style.display = 'block';
    self.lastAutoCursorPos = point;
    isCursorSet = true;
  };

  this.resetCursor = function () {
    if (!isCursorSet) {
      return;
    }
    document.body.style.cursor = '';
    cursor.style.display = 'none';
    isCursorSet = false;
  };

  this.destroy = function () {
    parent.removeChild(cursor);
  };
}
