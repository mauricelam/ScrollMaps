import PrefManager, { Preferences } from "./pref";
import Scrollability from "./Scrollability";
import { DEBUG } from "./utils";

type Point = [number, number]

function _findAncestorScrollMap(node: Element | null): Element | null {
  if (!(node instanceof Element)) {
    return null;
  }
  if (node.hasAttribute('data-scrollmaps')) {
    return node;
  }
  return _findAncestorScrollMap(node.parentElement);
}

function _findDescendantScrollMap(node: Element): Element | null {
  return node.querySelector('[data-scrollmaps]');
}

function _findLineageScrollMap(node: Element): Element | null {
  return _findDescendantScrollMap(node)
    || _findAncestorScrollMap(node.parentElement);
}

function isWebGlCanvas(target: Element) {
  if (!(target instanceof HTMLCanvasElement)) return false;
  return !!target.getContext('webgl');
}

enum State {
  Idle = 0,
  Scrolling = 1,
  Zooming = 2,
}

class ScrollableMap {
  enabled = false;
  mapClicked = false;
  bodyScrolls = false;
  state = State.Idle;

  averageX = new SMLowPassFilter();
  averageY = new SMLowPassFilter();

  accelero = new SM2DAccelerationDetector();
  dragger: DragSimulator;
  zoomDeltaTracker: ZoomDeltaTracker;

  constructor(
    private div: HTMLElement,
    private type: MapType,
    private id: number,
    private prefs: Preferences
  ) {
    this.zoomDeltaTracker = new ZoomDeltaTracker(ZOOM_STEP[this.type], TIME_THROTTLE[this.type])

    // See the documentation in DRAG_SIMULATOR_DEFAULT_OPTS
    let maxDistanceUntilUp = 600;
    if (type === MapType.TYPE_GOOGLE_MAPS_LEGACY
      || type === MapType.TYPE_GOOGLE_MAPS_API
      || type === MapType.TYPE_GOOGLE_MAPS_IFRAME
      || type === MapType.TYPE_GOOGLE_MAPS_WEB) {
      maxDistanceUntilUp = div.offsetWidth && (div.offsetWidth * 0.5) || 600;
    } else {
      maxDistanceUntilUp = Infinity;
    }
    this.dragger = new DragSimulator(type, {
      maxDistanceUntilUp
    });

    const lineage = _findLineageScrollMap(div);
    if (lineage) {
      if (DEBUG) {
        console.log('Scrollmap already added', lineage, div);
      }
      return;
    }

    if (DEBUG) {
      console.log('Creating scrollable map', div, id);
    }

    // Avoid adding multiple event listeners to the same map
    if ((div as any).__scrollMapAttached) return;
    (div as any).__scrollMapAttached = true;

    div.setAttribute('data-scrollmaps', 'false');


    const style = document.createElement('style');
    style.innerHTML = `
            [data-scrollmaps]::after {
                all: initial;
                transition: outline 0.3s;
                outline: 3px solid rgba(33, 150, 243, 0);
                outline-offset: -3px;
            }
            [data-scrollmaps]::before {
                all: initial;
                transition: opacity 0.3s 0s, background 0.3s 0s;
                opacity: 0;
                text-shadow: 0 0 7px #fff;
                pointer-events: none;
            }
            [data-scrollmaps].scrollMapsActivatable:hover::after {
                outline: 3px solid rgba(33, 150, 243, 0.5);
            }
            [data-scrollmaps].scrollMapsActivatable::before {
                content: 'Click to activate ScrollMaps';
                white-space: nowrap;
                font-family: 'Arial', sans-serif;
                font-size: 14px;
                display: inline-block;
                position: absolute;
                z-index: 9999;
                top: 3px; left: 50%;
                transform: translateX(-50%);
                background: linear-gradient(rgba(33, 150, 243, 0.5) 0%, rgba(33, 150, 243, 0.8) 40%);
                padding: 0 7px 2px 7px;
                border-radius: 0 0 8px 8px;
                text-align: center;
                color: #333;
            }
            [data-scrollmaps].scrollMapsActivatable:hover::before {
                opacity: 1;
            }
            [data-scrollmaps].scrollMapsActivatable::after {
                content: '';
                display: block;
                position: absolute;
                top: 0px; left: 0px; right: 0px; bottom: 0px;
                pointer-events: none;
                z-index: 9999;
            }
            [data-scrollmaps].scrollMapsActivated::before,
            [data-scrollmaps].scrollMapsActivated:hover::before {
                content: 'ScrollMaps activated';
                white-space: nowrap;
                opacity: 1;
                animation: fadeOutActivatedBanner 1s ease-in 3s forwards;
                background: rgba(33, 150, 243, 0.8);
            }
            @keyframes fadeOutActivatedBanner {
                to {
                    opacity: 0;
                }
            }
            [data-scrollmaps].scrollMapsActivated::after,
            [data-scrollmaps].scrollMapsActivated:hover::after {
                outline: 3px solid rgba(33, 150, 243, 0.8);
            }
        `;
    try {
      const rootNode = div.getRootNode();
      ((rootNode as any).documentElement || rootNode).appendChild(style);
    } catch (e) {
      console.error("Error injecting CSS", e)
    }

    Scrollability.monitorScrollabilitySuper(div, (scrolls) => {
      this.bodyScrolls = scrolls;
      this.refreshActivationAffordance();
    });

    this.init(div, type);
  }

  private enable(): void {
    if (this.enabled) return;
    this.enabled = true;
    if (DEBUG) console.log('map loaded', this.type);
    chrome.runtime.sendMessage({ 'action': 'mapLoaded' });
    this.refreshActivationAffordance();
    this.div.setAttribute('data-scrollmaps', 'enabled');
  }

  private init(div: HTMLElement, type: MapType): void {
    this.type = type;
    div.addEventListener('wheel', (e) => this.handleWheelEvent(e), true);

    this.mapClicked = false;

    PrefManager.onPreferenceChanged(null, (key, value) => {
      switch (key) {
        case 'frameRequireFocus':
          this.refreshActivationAffordance();
          break;
        case 'enabled':
          if (value) this.enable();
          break;
      }
      this.prefs[key] = value;
    });

    chrome.runtime.onMessage.addListener((request, _sender, _sendResponse) => {
      if (request.action === 'browserActionClicked') {
        this.enable();
      }
    });

    if ((window as any).SCROLLMAPS_enabled || this.prefs['enabled']) {
      this.enable();
    }

    div.addEventListener('click', (event) => {
      if (this._isMapActivatable()) {
        if (event) event.stopPropagation();
        this.mapClicked = true;
        div.focus();
      }
      this.refreshActivationAffordance();
      this.lastTarget = null;
    }, true);
    const blockEventIfNotActivated = (event: Event) => {
      if (this._isMapActivatable()) {
        event.stopPropagation();
        event.preventDefault();
      }
    }
    div.addEventListener('mousedown', blockEventIfNotActivated, true);
    div.addEventListener('mouseup', blockEventIfNotActivated, true)
    div.addEventListener('mouseleave', () => {
      this.mapClicked = false;
      this.refreshActivationAffordance();
    });
    setTimeout(() => this.refreshActivationAffordance(), 500);

    // Observe if the scroll map element is removed. Send a message to the background
    // page so it can update the browser action status.
    const mutationObserver = new MutationObserver((mutationList, _observer) => {
      const hasRemovedNodes = mutationList.some(m => m.removedNodes.length > 0);
      if (hasRemovedNodes && !document.contains(div)) {
        chrome.runtime.sendMessage({ action: 'mapUnloaded' });
      }
    });
    mutationObserver.observe(document.documentElement, { childList: true, subtree: true });

    window.addEventListener('unload', () => {
      // For the case where ScrollMap is loaded in an iframe, and that iframe is removed.
      chrome.runtime.sendMessage({ action: 'mapUnloaded' });
    });

    const onRealPointerMove = (e: MouseEvent | PointerEvent) => {
      if (e.detail !== 88) {
        if (this.lastTarget instanceof Element && this.dragger.mouseDownPoint) {
          this.dragger.simulateMouseUp(this.lastTarget);
        }
      }
    };

    // Attach to both event listeners to make sure our mouse-up code is run before any
    // custom event handlers from the maps.
    window.addEventListener('mousemove', onRealPointerMove, true);
    window.addEventListener('pointermove', onRealPointerMove, true);

    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (e.detail !== 88) {
        const style = ((e.target as Node).parentNode as HTMLElement).style;
        if (style && style.cursor !== 'pointer') {
          this.dragger.lastAutoCursorPos = [e.clientX, e.clientY];
        }
      }
    }, false);
  }

  // A map is activatable when
  //   1. relevant settings and scrollability requirements are met, and
  //   2. it is not currently activated.
  private _isMapActivatable(): boolean {
    return this._isMapActivatableOrActivated() && !this.mapClicked;
  }

  private _isMapActivatableOrActivated(): boolean {
    return this.type !== MapType.TYPE_GOOGLE_MAPS_WEB &&  // Web maps are never activatable
      this.bodyScrolls &&
      this.prefs['frameRequireFocus'] &&
      this.enabled;
  }

  private refreshActivationAffordance() {
    if (this._isMapActivatableOrActivated()) {
      this.div.classList.add('scrollMapsActivatable');
      this.div.classList.toggle('scrollMapsActivated', this.mapClicked);
    } else {
      this.div.classList.remove('scrollMapsActivatable');
      this.div.classList.remove('scrollMapsActivated');
    }
  }

  private move(point: Point, dx: number, dy: number, target: Element) {
    this.dragger.simulateDrag(target, point, dx, dy);
  };

  zoomInOrOut(_mousePos: Point, target: Element, originalEvent: Event, isZoomIn: boolean): void {
    // New Google Maps zooms much better with respect to unmodified mouse wheel events. Let's
    // keep that behavior for Cmd-scrolling.
    if (originalEvent instanceof WheelEvent) {
      // Scale the pinch gesture 3x for non-web maps, because pinch gesture normally
      // have much less "delta" than scroll
      let delta = originalEvent.deltaY;
      if (originalEvent.ctrlKey) {
        delta *= this.prefs['zoomSpeed'] / 100;
        delta *= PINCH_ZOOM_SCALE[this.type];
        if (this.type === MapType.TYPE_GOOGLE_MAPS_WEB && isWebGlCanvas(target)) {
          // Special case: Google maps web scrolling is smooth when in webGL mode, but
          // we only just got the event target to know about that.
        } else {
          // For 2d canvas (try with ?force=canvas in the URL), the zooming doesn't
          // behave naturally. It zooms a specific increment on each wheel event
          // and doesn't look at deltaY. Throttle the number of events to keep the
          // zooming at a reasonable rate.
          const trackerDelta = this.zoomDeltaTracker.zoomDelta(delta);
          if (trackerDelta === false) {
            return;
          } else {
            delta = trackerDelta;
          }
        }
      }

      const events = this.createBackdoorWheelEvents(originalEvent, isZoomIn, delta);
      for (const eventInit of events) {
        target.dispatchEvent(new WheelEvent('wheel', eventInit));
        target.dispatchEvent(new WheelEvent('mousewheel', {
          ...eventInit,
          deltaY: eventInit.deltaY,
          detail: eventInit.deltaY,
        }));
        if ((window as any).MouseScrollEvent) {
          // Very old and deprecated mouse scroll event used by Firefox.
          // OpenStreetMap still uses this event when it detects that the browser is Firefox.
          // https://developer.mozilla.org/en-US/docs/Web/API/Element/DOMMouseScroll_event
          const domMouseScrollEvent = new MouseEvent('DOMMouseScroll', {
            ...eventInit,
            detail: eventInit.deltaY / 16,
            shiftKey: this.type === MapType.TYPE_ARCGIS,
          });
          target.dispatchEvent(domMouseScrollEvent);
          if (this.type === MapType.TYPE_ARCGIS) {
            target.dispatchEvent(new MouseEvent('MozMousePixelScroll', {
              ...eventInit,
              detail: eventInit.deltaY / 16,
              shiftKey: true,
            }));
          }
        }
      }
      return;
    } else {
      console.warn('ScrollMaps unexpected event', originalEvent);
    }
  };

  zoomIn(mousePos: Point, target: Element, originalEvent: WheelEvent): void {
    return this.zoomInOrOut(mousePos, target, originalEvent, /* isZoomIn= */ true);
  };

  zoomOut(mousePos: Point, target: Element, originalEvent: WheelEvent): void {
    return this.zoomInOrOut(mousePos, target, originalEvent, /* isZoomIn= */ false);
  };

  createBackdoorWheelEvents(originalEvent: WheelEvent, zoomIn: boolean, delta: number) {
    const init: Partial<WheelEventInit> = {};
    for (const i in originalEvent) {
      (init as any)[i] = (originalEvent as any)[i];
    }
    init.detail = 10888;

    if (zoomIn && delta > 0) {
      delta *= -1;
    } else if (!zoomIn && delta < 0) {
      delta *= -1;
    }
    init.deltaY = delta;

    if (this.type === MapType.TYPE_MAPBOX || this.type === MapType.TYPE_MAPLIBRE) {
      // Mapbox has this trackpad detection logic that we might confuse when we increase our zoom speed.
      // https://github.com/mapbox/mapbox-gl-js/blob/c708474eb65d9c6a117fe232b677db19525f70b4/src/ui/handler/scroll_zoom.js#L17-L22
      // Split the wheel event into many with small delta to make sure it's treated as trackpad
      const numEvents = Math.ceil(Math.abs(delta / 4));
      return Array(numEvents).fill({ ...init, deltaY: init.deltaY / numEvents });
    } else {
      return [init];
    }
  }

  lastTarget: EventTarget | null = null;
  handleWheelEvent(e: WheelEvent) {
    if (!this.enabled && !(window as any).safari) return;
    if (this._isMapActivatable()) {
      e.stopPropagation(); return;
    }

    if (e.detail == 10888) {
      return; // backdoor for zooming
    }

    let target: Element = (e.target || e.srcElement) as Element;
    const isAccelerating = this.accelero.isAccelerating(e.deltaX, e.deltaY, e.timeStamp);

    if (target instanceof Element && Scrollability.hasScrollableParent(target, this.div)) {
      // something is scrollable, let's allow it to scroll
      return;
    }

    if (this.lastTarget instanceof Element && this.div.contains(this.lastTarget)) {
      target = this.lastTarget;
    } else {
      this.lastTarget = target;
    }

    const destinationState = (e.metaKey || e.ctrlKey || e.altKey) ? State.Zooming : State.Scrolling;
    if (isAccelerating || this.state == destinationState) {
      this.state = destinationState;
      const mousePos: Point = [e.clientX, e.clientY];

      switch (this.state) {
        case State.Zooming:
          // In Chrome, ctrl + wheel => pinch gesture. Do not invert zoom for the pinch
          // gesture.
          var factor = (this.prefs['invertZoom'] && !(window.chrome && e.ctrlKey)) ? -1 : 1;
          if ((window as any).safari && (e as any).webkitDirectionInvertedFromDevice) {
            factor *= -1;
          }
          if (e.deltaY * factor < 0) {
            this.zoomIn(mousePos, target, e);
          } else if (e.deltaY * factor > 0) {
            this.zoomOut(mousePos, target, e);
          }
          break;
        case State.Scrolling:
          setTimer('flushAverage', () => {
            this.averageX.flush();
            this.averageY.flush();
          }, 200);
          this.averageX.push(e.deltaX);
          this.averageY.push(e.deltaY);

          const speedFactor = (this.prefs['scrollSpeed'] / 100) * (this.prefs['invertScroll'] ? 1 : -1);
          let dx = this.averageX.getAverage() * speedFactor;
          let dy = this.averageY.getAverage() * speedFactor;
          dx = dx * Math.pow(Math.abs(dx), 0.20) * 0.80;
          dy = dy * Math.pow(Math.abs(dy), 0.20) * 0.80;

          if (dx !== 0 || dy !== 0) {
            this.move(mousePos, dx, dy, target);
          }
          break;
      }
    } else {
      this.state = State.Idle;
    }
    e.stopPropagation();
    e.preventDefault();
    return false;
  };
}

export default ScrollableMap;

function setTimer(timerID: string, newFunction: TimerHandler, newDelay: number) {
  const win = window as any;
  win._timers = win._timers || {};
  clearTimeout(win._timers[timerID]);
  win._timers[timerID] = setTimeout(newFunction, newDelay);
}

export enum MapType {
  TYPE_GOOGLE_MAPS_LEGACY = 0,
  TYPE_GOOGLE_MAPS_IFRAME = 1,
  TYPE_GOOGLE_MAPS_API = 2,
  TYPE_GOOGLE_MAPS_WEB = 3,
  TYPE_ARCGIS = 4,
  TYPE_MAPBOX = 5,
  TYPE_OPEN_STREET_MAP = 6,
  TYPE_APPLE_MAPKIT = 7,
  TYPE_MAPLIBRE = 8,
  TYPE_LEAFLET = 9,
  TYPE_MAPYCZ = 10,
  TYPE_MSMAP = 11,
}

const PINCH_ZOOM_SCALE = {
  [MapType.TYPE_GOOGLE_MAPS_LEGACY]: 8,
  [MapType.TYPE_GOOGLE_MAPS_IFRAME]: 8,
  [MapType.TYPE_GOOGLE_MAPS_API]: 8,
  [MapType.TYPE_GOOGLE_MAPS_WEB]: 1,
  [MapType.TYPE_ARCGIS]: 1.1,
  [MapType.TYPE_MAPBOX]: 3,
  [MapType.TYPE_LEAFLET]: 3,
  [MapType.TYPE_OPEN_STREET_MAP]: 0.8,
  [MapType.TYPE_APPLE_MAPKIT]: 1,
  [MapType.TYPE_MAPLIBRE]: 4,
  [MapType.TYPE_MAPYCZ]: 4,
  [MapType.TYPE_MSMAP]: 4,
};

// How much deltaY should correspond to a zoom level. 0 if scrolling is smooth.
const ZOOM_STEP = {
  [MapType.TYPE_GOOGLE_MAPS_LEGACY]: 50,
  [MapType.TYPE_GOOGLE_MAPS_IFRAME]: 50,
  [MapType.TYPE_GOOGLE_MAPS_API]: 50,
  [MapType.TYPE_GOOGLE_MAPS_WEB]: 50,
  [MapType.TYPE_ARCGIS]: 50,
  [MapType.TYPE_MAPBOX]: 50,
  [MapType.TYPE_LEAFLET]: 50,
  [MapType.TYPE_OPEN_STREET_MAP]: 50,
  [MapType.TYPE_APPLE_MAPKIT]: 0,
  [MapType.TYPE_MAPLIBRE]: 0,
  [MapType.TYPE_MAPYCZ]: 50,
  [MapType.TYPE_MSMAP]: 0,
};

const TIME_THROTTLE = {
  [MapType.TYPE_GOOGLE_MAPS_LEGACY]: 400,
  [MapType.TYPE_GOOGLE_MAPS_IFRAME]: 400,
  [MapType.TYPE_GOOGLE_MAPS_API]: 400,
  [MapType.TYPE_GOOGLE_MAPS_WEB]: 0,
  [MapType.TYPE_ARCGIS]: 0,
  [MapType.TYPE_MAPBOX]: 0,
  [MapType.TYPE_LEAFLET]: 0,
  [MapType.TYPE_OPEN_STREET_MAP]: 0,
  [MapType.TYPE_APPLE_MAPKIT]: 0,
  [MapType.TYPE_MAPLIBRE]: 0,
  [MapType.TYPE_MAPYCZ]: 400,
  [MapType.TYPE_MSMAP]: 0,
};

/**
 * Tracker for mouse wheel events, to throttle the zoom level.
 *
 * Some maps use the number of events to determine how much to zoom and ignore the delta amount;
 * for the "smooth" pinch gesture that generates a large number of events with small delta
 * values this results in what I call "crazy zooming". This tracker negates that effect by
 * keeping track of the accumulated zoom delta, and trigger one real zoom event only if a
 * certain threshold is reached.
 */
class ZoomDeltaTracker {
  accumulatedZoomDelta = 0;
  lastZoomTime = 0;

  constructor(private deltaPerZoomLevel: number, private timeThrottle: number) { }

  /**
   * Add `delta` to the zoom tracker.
   *
   * @returns `false` if the tracker should not be zooming, or a number indicating the
   * accumulated zoom amount.
   */
  zoomDelta(delta: number) {
    if (this.deltaPerZoomLevel === 0) {
      return delta;
    }
    if (Date.now() - this.lastZoomTime > 1000) this.accumulatedZoomDelta = 0;
    this.accumulatedZoomDelta += delta;
    this.lastZoomTime = Date.now();
    if (delta < 0) {
      // Zoom in
      if (this.accumulatedZoomDelta > -this.deltaPerZoomLevel) return false;
      this.accumulatedZoomDelta += this.deltaPerZoomLevel;
    } else if (delta > 0) {
      // Zoom out
      if (this.accumulatedZoomDelta < this.deltaPerZoomLevel) return false;
      this.accumulatedZoomDelta -= this.deltaPerZoomLevel;
    }
    return this.deltaPerZoomLevel;
  }
}

const SM_LOW_PASS_FILTER_SMOOTHING = 0.5;

class SMLowPassFilter {
  data = 0;
  lastDataTime = 0;

  push(data: number, time?: number) {
    this.data = this.data * SM_LOW_PASS_FILTER_SMOOTHING + data * (1 - SM_LOW_PASS_FILTER_SMOOTHING);
    this.lastDataTime = time || Date.now();
  }

  getAverage(time?: number) {
    time = time || Date.now();
    if (this.lastDataTime === 0) {
      return this.data;
    }
    return this.data * Math.pow(SM_LOW_PASS_FILTER_SMOOTHING, (time - this.lastDataTime) / 20);
  }

  flush() {
    this.data = 0;
  }
}

class SMAccelerationDetector {
  max = 0;
  maxTime = 0;
  lastDelta = 0;
  lastTime = Date.now();

  isAccelerating(delta: number, time: number): boolean {
    delta = delta / (time - this.lastTime);
    setTimer('stateChangeTimer', () => this.newScrollAction(), 200);

    let output = false;

    if (Math.abs(delta) > Math.abs(this.max)) {
      this.max = delta;
      this.maxTime = time;
      output = true;
    }
    const t = time - this.maxTime;
    const prediction = this.max * Math.exp(-0.0038 * t);

    const difference = (Math.abs(delta) - Math.abs(prediction));

    if (difference / Math.abs(prediction) > 1.2 && difference > 0.5) {
      this.newScrollAction();
      output = true;
    }
    return output;
  }

  newScrollAction() {
    this.max = 0;
    this.maxTime = 0;
    this.lastDelta = 0;
  }
}

class SM2DAccelerationDetector {
  yAccelerationDetector = new SMAccelerationDetector();
  xAccelerationDetector = new SMAccelerationDetector();

  isAccelerating(deltaX: number, deltaY: number, time: number): boolean {
    const x = this.xAccelerationDetector.isAccelerating(deltaX, time);
    const y = this.yAccelerationDetector.isAccelerating(deltaY, time);
    return x || y;
  }
}

interface DragSimulatorOptions {
  // The minimum distance to simulate a drag, to avoid the event being interpreted as
  // a click. If the scroll gesture's distance is smaller than this, it will be scaled
  // up to reach this distance.
  minDragDistance: number,
  // The maximum distance that can be scrolled (along either X or Y axis) before a
  // mouse up is force triggered. This is useful for street view where the panning
  // is non-linear, so that the panning response will reset one in a while.
  // If this value is too large, the stree view will stop panning until you want for
  // the mouse-up timeout. If this value is too small, the event may be treated as a
  // mouse move rather than a drag.
  maxDistanceUntilUp: number,
  // The delay in milliseconds before a mouse up is simulated, after the last call to
  // simulateDrag. This is non-zero for newer implementations tend to have inertial-drag
  // which tracks the mouse events over time, and therefore firing mousedown + mousemove
  // + mouseup events in the same loop synchronously will not work.
  mouseUpDelay: number,
}

const DRAG_SIMULATOR_DEFAULT_OPTS: DragSimulatorOptions = {
  'minDragDistance': 3,
  'maxDistanceUntilUp': 600,
  'mouseUpDelay': 100,
};

class DragSimulator {
  mouseDownPoint: Point | null = null;
  simulatedMousePoint: Point | null = null;
  opts: DragSimulatorOptions;
  lastAutoCursorPos: Point | null = null;
  timer: number | null = null;

  constructor(private mapType: MapType, opts: Partial<DragSimulatorOptions>) {
    this.opts = { ...DRAG_SIMULATOR_DEFAULT_OPTS, ...opts };
  }

  // Dispatch mouse and pointer events
  _dispatchPointerEvent(target: Element, type: 'move' | 'up' | 'down', opts: MouseEventInit & PointerEventInit) {
    const mouseEvent = new MouseEvent('mouse' + type, opts);
    const pointerEvent = new PointerEvent('pointer' + type, { pointerId: 10088, isPrimary: true, ...opts });
    target.dispatchEvent(mouseEvent);
    target.dispatchEvent(pointerEvent);
  }

  simulateMouseDown(target: Element, point: Point) {
    this.mouseDownPoint = [point[0], point[1]];  // Deep copy
    this.simulatedMousePoint = point;
    const eventOpts = {
      'bubbles': true,
      'cancelable': true,
      'detail': 1,
      'clientX': point[0],
      'clientY': point[1],
      'button': 0,
      'buttons': 1,
      'pressure': 0.5,
    };
    this._dispatchPointerEvent(target, 'down', eventOpts);
  }

  simulateMouseUp(target: Element) {
    if (!this.mouseDownPoint || !this.simulatedMousePoint) throw new Error("Missing mouse point");

    // If the minimum drag distance is not reached, dispatch an extra move event
    let dx = this.simulatedMousePoint[0] - this.mouseDownPoint[0];
    let dy = this.simulatedMousePoint[1] - this.mouseDownPoint[1];
    const minDragDistance = this.opts.minDragDistance;
    if (Math.abs(dx) < minDragDistance && Math.abs(dy) < minDragDistance) {
      // scale to make sure at least one of them is > minDragDistance
      // this ensures it's treated as a drag, not a click
      const scale = (minDragDistance * 1.05) / Math.max(Math.abs(dx), Math.abs(dy), 1);
      this.simulateMouseMove(target, dx * scale, dy * scale);
    }

    this._dispatchPointerEvent(target, 'up', {
      'bubbles': true,
      'cancelable': true,
      'detail': 1,
      'clientX': this.simulatedMousePoint[0],
      'clientY': this.simulatedMousePoint[1],
      'button': 0,
      'buttons': 0,
      'pressure': 0,
    });

    // Trigger a move event so that map updates the cursor based on the current cursor position.
    this._dispatchPointerEvent(target, 'move', {
      'bubbles': true,
      'cancelable': false,
      'detail': 88,
      'clientX': this.mouseDownPoint[0],
      'clientY': this.mouseDownPoint[1],
      'button': 0,
      'buttons': 0,
      'pressure': 0,
    })

    this.lastAutoCursorPos = [this.simulatedMousePoint[0], this.simulatedMousePoint[1]];
    this.mouseDownPoint = null;
  }

  simulateMouseMove(target: Element, dx: number, dy: number) {
    if (!this.simulatedMousePoint) throw new Error("Missing mouse point");

    this.simulatedMousePoint[0] += dx;
    this.simulatedMousePoint[1] += dy;
    const eventOpts = {
      'bubbles': true,
      'cancelable': false,
      'detail': 88,
      'clientX': this.simulatedMousePoint[0],
      'clientY': this.simulatedMousePoint[1],
      'button': 0,
      'buttons': 1,  // Left mouse button should be down when simulating drag-move
      'pressure': 0.5,
    };
    this._dispatchPointerEvent(target, 'move', eventOpts);
  }

  simulateDrag(target: Element, point: Point, dx: number, dy: number) {
    if (!this.mouseDownPoint) {
      // In Google maps, if a hover card is shown, it might be a hint that dragging does something other than
      // panning the map. Unfortunately, I couldn't find a more useful indicator to tell that, so we may be
      // playing a little cat-and-mouse game here.
      const hasDragHint = this.mapType === MapType.TYPE_GOOGLE_MAPS_WEB
        && Array.from(document.querySelectorAll('[jsaction*="hovercard"]'))
          .some(e => (e as HTMLElement).style.display !== "none")
      if (hasDragHint && this.lastAutoCursorPos) {
        // If the cursor style is pointer, we might be hovering on a route. Dragging
        // will alter the route, which we don't want, so use the last mouse down point
        // instead.
        this.simulateMouseDown(target, this.lastAutoCursorPos);
      } else {
        this.simulateMouseDown(target, point);
      }
    }

    this.simulateMouseMove(target, dx, dy);

    // Street view panning has set an exponential decaying curve, in order for the scroll
    // to continue, pretend a mouse up every so often.
    // There is a visible jump when this happens if you observe carefully, but the results
    // are good enough for general use.
    const maxDistanceUntilUp = this.opts.maxDistanceUntilUp;
    if (this.simulatedMousePoint && this.mouseDownPoint) {
      if (Math.abs(this.simulatedMousePoint[0] - this.mouseDownPoint[0]) > maxDistanceUntilUp ||
        Math.abs(this.simulatedMousePoint[1] - this.mouseDownPoint[1]) > maxDistanceUntilUp) {
        this.simulateMouseUp(target);
      }
    }

    if (this.opts.mouseUpDelay > 0) {
      this.timer && window.clearTimeout(this.timer);
      this.timer = window.setTimeout(
        () => this.simulateMouseUp(target),
        this.opts.mouseUpDelay);
    }
  }
}

if ((window as any).ScrollableMap === undefined) {
  (window as any).ScrollableMap = ScrollableMap;
}
