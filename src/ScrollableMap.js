if (window.ScrollableMap === undefined) {
    const DEBUG = chrome.runtime.getManifest().version === '10000';
    window.ScrollableMap = function (div, type, id, prefs) {

        let enabled = false;

        function enable() {
            if (enabled) return;
            enabled = true;
            if (DEBUG) console.log('map loaded', type);
            chrome.runtime.sendMessage({ 'action': 'mapLoaded' });
            refreshActivationAffordance();
            div.setAttribute('data-scrollmaps', 'enabled');
        }

        function _findAncestorScrollMap(node) {
            if (!(node instanceof Element)) {
                return null;
            }
            if (node.hasAttribute('data-scrollmaps')) {
                return node;
            }
            return _findAncestorScrollMap(node.parentNode);
        }

        function _findDescendantScrollMap(node) {
            return node.querySelector('[data-scrollmaps]');
        }

        function _findLineageScrollMap(node) {
            return _findDescendantScrollMap(node)
                || _findAncestorScrollMap(node.parentNode);
        }

        let lineage = _findLineageScrollMap(div);
        if (lineage != null) {
            if (DEBUG) {
                console.log('Scrollmap already added', lineage, div);
            }
            return;
        }

        if (DEBUG) {
            console.log('Creating scrollable map', div, id);
        }

        // Avoid adding multiple event listeners to the same map
        if (div.__scrollMapAttached) return;
        div.__scrollMapAttached = true;

        const self = this;

        let mapClicked; // whether the map has ever been clicked (to activate the map)
        let bodyScrolls = false;

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
        document.head.appendChild(style);

        Scrollability.monitorScrollabilitySuper(div, (scrolls) => {
            bodyScrolls = scrolls;
            refreshActivationAffordance();
        });

        var States = { idle: 0, scrolling: 1, zooming: 2 };
        var state = States.idle;

        var averageX = new SMLowPassFilter(2);
        var averageY = new SMLowPassFilter(2);

        var accelero = new SM2DAccelerationDetector();

        self.init = function (div, type) {
            self.type = type;
            div.addEventListener('wheel', self.handleWheelEvent, true);

            mapClicked = false;

            Pref.onPreferenceChanged(null, (key, value) => {
                switch (key) {
                    case 'frameRequireFocus':
                        refreshActivationAffordance();
                        break;
                    case 'enabled':
                        if (value) enable();
                        break;
                }
                prefs[key] = value;
            });

            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                if (request.action === 'browserActionClicked') {
                    enable();
                }
            });

            if (window.SCROLLMAPS_enabled || prefs['enabled']) {
                enable();
            }

            div.addEventListener('click', (event) => {
                if (_isMapActivatable()) {
                    if (event) event.stopPropagation();
                    mapClicked = true;
                    div.focus();
                }
                refreshActivationAffordance();
                lastTarget = null;
            }, true);
            const blockEventIfNotActivated = (event) => {
                if (_isMapActivatable()) {
                    event.stopPropagation();
                    event.preventDefault();
                }
            }
            div.addEventListener('mousedown', blockEventIfNotActivated, true);
            div.addEventListener('mouseup', blockEventIfNotActivated, true)
            div.addEventListener('mouseleave', () => {
                mapClicked = false;
                refreshActivationAffordance();
            });
            setTimeout(refreshActivationAffordance, 500);

            // Observe if the scroll map element is removed. Send a message to the background
            // page so it can update the browser action status.
            const mutationObserver = new MutationObserver((mutationList, observer) => {
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

            const onRealPointerMove = (e) => {
                if (e.detail !== 88) {
                    if (lastTarget && dragger.mouseDownPoint) {
                        dragger.simulateMouseUp(lastTarget);
                    }
                }
            };

            // Attach to both event listeners to make sure our mouse-up code is run before any
            // custom event handlers from the maps.
            window.addEventListener('mousemove', onRealPointerMove, true);
            window.addEventListener('pointermove', onRealPointerMove, true);

            window.addEventListener('mousemove', function (e) {
                if (e.detail !== 88) {
                    const style = e.target.parentNode.style;
                    if (style && style.cursor !== 'pointer') {
                        dragger.lastAutoCursorPos = [e.clientX, e.clientY];
                    }
                }
            }, false);
        }

        // A map is activatable when
        //   1. relevant settings and scrollability requirements are met, and
        //   2. it is not currently activated.
        function _isMapActivatable() {
            return _isMapActivatableOrActivated() &&
                !mapClicked;
        }

        function _isMapActivatableOrActivated() {
            return self.type !== ScrollableMap.TYPE_GOOGLE_MAPS_WEB &&  // Web maps are never activatable
                bodyScrolls &&
                prefs['frameRequireFocus'] &&
                enabled;
        }

        function refreshActivationAffordance() {
            if (_isMapActivatableOrActivated()) {
                div.classList.add('scrollMapsActivatable');
                div.classList.toggle('scrollMapsActivated', mapClicked);
            } else {
                div.classList.remove('scrollMapsActivatable');
                div.classList.remove('scrollMapsActivated');
            }
        }

        // See the documentation in DRAG_SIMULATOR_DEFAULT_OPTS
        let maxDistanceUntilUp = 600;
        if (type === ScrollableMap.TYPE_GOOGLE_MAPS_LEGACY
            || type === ScrollableMap.TYPE_GOOGLE_MAPS_API
            || type === ScrollableMap.TYPE_GOOGLE_MAPS_IFRAME
            || type === ScrollableMap.TYPE_GOOGLE_MAPS_WEB) {
            maxDistanceUntilUp = div.offsetWidth && (div.offsetWidth * 0.5) || 600;
        } else {
            maxDistanceUntilUp = Infinity;
        }
        const dragger = new DragSimulator(type, {
            maxDistanceUntilUp
        });

        self.move = function (point, dx, dy, target) {
            dragger.simulateDrag(target, point, dx, dy);
        };

        const PINCH_ZOOM_SCALE = {
            [ScrollableMap.TYPE_GOOGLE_MAPS_LEGACY]: 8,
            [ScrollableMap.TYPE_GOOGLE_MAPS_IFRAME]: 8,
            [ScrollableMap.TYPE_GOOGLE_MAPS_API]: 8,
            [ScrollableMap.TYPE_GOOGLE_MAPS_WEB]: 1,
            [ScrollableMap.TYPE_ARCGIS]: 1.1,
            [ScrollableMap.TYPE_MAPBOX]: 3,
            [ScrollableMap.TYPE_LEAFLET]: 3,
            [ScrollableMap.TYPE_OPEN_STREET_MAP]: 0.8,
            [ScrollableMap.TYPE_APPLE_MAPKIT]: 1,
            [ScrollableMap.TYPE_MAPLIBRE]: 4,
            [ScrollableMap.TYPE_MAPYCZ]: 4,
        };

        // How much deltaY should correspond to a zoom level. 0 if scrolling is smooth.
        const ZOOM_STEP = {
            [ScrollableMap.TYPE_GOOGLE_MAPS_LEGACY]: 50,
            [ScrollableMap.TYPE_GOOGLE_MAPS_IFRAME]: 50,
            [ScrollableMap.TYPE_GOOGLE_MAPS_API]: 50,
            [ScrollableMap.TYPE_GOOGLE_MAPS_WEB]: 50,
            [ScrollableMap.TYPE_ARCGIS]: 50,
            [ScrollableMap.TYPE_MAPBOX]: 50,
            [ScrollableMap.TYPE_LEAFLET]: 50,
            [ScrollableMap.TYPE_OPEN_STREET_MAP]: 50,
            [ScrollableMap.TYPE_APPLE_MAPKIT]: 0,
            [ScrollableMap.TYPE_MAPLIBRE]: 0,
            [ScrollableMap.TYPE_MAPYCZ]: 50,
        };

        const TIME_THROTTLE = {
            [ScrollableMap.TYPE_GOOGLE_MAPS_LEGACY]: 400,
            [ScrollableMap.TYPE_GOOGLE_MAPS_IFRAME]: 400,
            [ScrollableMap.TYPE_GOOGLE_MAPS_API]: 400,
            [ScrollableMap.TYPE_GOOGLE_MAPS_WEB]: 0,
            [ScrollableMap.TYPE_ARCGIS]: 0,
            [ScrollableMap.TYPE_MAPBOX]: 0,
            [ScrollableMap.TYPE_LEAFLET]: 0,
            [ScrollableMap.TYPE_OPEN_STREET_MAP]: 0,
            [ScrollableMap.TYPE_APPLE_MAPKIT]: 0,
            [ScrollableMap.TYPE_MAPLIBRE]: 0,
            [ScrollableMap.TYPE_MAPYCZ]: 400,
        };

        const zoomDeltaTracker = new ZoomDeltaTracker(ZOOM_STEP[type], TIME_THROTTLE[type]);

        self.zoomInOrOut = function (mousePos, target, originalEvent, isZoomIn) {
            // New Google Maps zooms much better with respect to unmodified mouse wheel events. Let's
            // keep that behavior for Cmd-scrolling.
            if (originalEvent instanceof WheelEvent) {
                // Scale the pinch gesture 3x for non-web maps, because pinch gesture normally
                // have much less "delta" than scroll
                let delta = originalEvent.deltaY;
                if (originalEvent.ctrlKey) {
                    delta *= prefs['zoomSpeed'] / 100;
                    delta *= PINCH_ZOOM_SCALE[type];
                    if (type === ScrollableMap.TYPE_GOOGLE_MAPS_WEB && isWebGlCanvas(target)) {
                        // Special case: Google maps web scrolling is smooth when in webGL mode, but
                        // we only just got the event target to know about that.
                    } else {
                        // For 2d canvas (try with ?force=canvas in the URL), the zooming doesn't
                        // behave naturally. It zooms a specific increment on each wheel event
                        // and doesn't look at deltaY. Throttle the number of events to keep the
                        // zooming at a reasonable rate.
                        const trackerDelta = zoomDeltaTracker.zoomDelta(delta);
                        if (trackerDelta === false) {
                            return;
                        } else {
                            delta = trackerDelta;
                        }
                    }
                }

                const events = createBackdoorWheelEvents(originalEvent, isZoomIn, delta);
                for (const eventInit of events) {
                    target.dispatchEvent(new WheelEvent('wheel', eventInit));
                    target.dispatchEvent(new WheelEvent('mousewheel', {
                        ...eventInit,
                        deltaY: eventInit.deltaY,
                        detail: eventInit.deltaY,
                    }));
                    if (window.MouseScrollEvent) {
                        // Very old and deprecated mouse scroll event used by Firefox.
                        // OpenStreetMap still uses this event when it detects that the browser is Firefox.
                        // https://developer.mozilla.org/en-US/docs/Web/API/Element/DOMMouseScroll_event
                        const domMouseScrollEvent = new MouseEvent('DOMMouseScroll', {
                            ...eventInit,
                            detail: eventInit.deltaY / 16,
                            shiftKey: type === ScrollableMap.TYPE_ARCGIS,
                        });
                        target.dispatchEvent(domMouseScrollEvent);
                        if (type === ScrollableMap.TYPE_ARCGIS) {
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

        self.zoomIn = function (mousePos, target, originalEvent) {
            return self.zoomInOrOut(mousePos, target, originalEvent, /* isZoomIn= */ true);
        };

        self.zoomOut = function (mousePos, target, originalEvent) {
            return self.zoomInOrOut(mousePos, target, originalEvent, /* isZoomIn= */ false);
        };

        function createBackdoorWheelEvents(originalEvent, zoomIn, delta) {
            if (originalEvent instanceof WheelEvent) {
                const init = {};
                for (const i in originalEvent) {
                    init[i] = originalEvent[i];
                }
                init.detail = 10888;

                if (zoomIn && delta > 0) {
                    delta *= -1;
                } else if (!zoomIn && delta < 0) {
                    delta *= -1;
                }
                init.deltaY = delta;

                if (type === ScrollableMap.TYPE_MAPBOX || type === ScrollableMap.TYPE_MAPLIBRE) {
                    // Mapbox has this trackpad detection logic that we might confuse when we increase our zoom speed.
                    // https://github.com/mapbox/mapbox-gl-js/blob/c708474eb65d9c6a117fe232b677db19525f70b4/src/ui/handler/scroll_zoom.js#L17-L22
                    // Split the wheel event into many with small delta to make sure it's treated as trackpad
                    const numEvents = Math.ceil(Math.abs(delta / 4));
                    return Array(numEvents).fill({ ...init, deltaY: init.deltaY / numEvents });
                } else {
                    return [init];
                }
            } else {
                console.log('Trying to create backdoor event out of non-wheel event', originalEvent);
            }
        }

        function isWebGlCanvas(target) {
            if (!(target instanceof HTMLCanvasElement)) return false;
            return !!target.getContext('webgl');
        }

        var lastTarget;
        self.handleWheelEvent = function (e) {
            if (!enabled && !window.safari) return;
            if (_isMapActivatable()) {
                e.stopPropagation(); return;
            }

            if (e.detail == 10888) {
                return; // backdoor for zooming
            }

            var target = e.target || e.srcElement;
            var isAccelerating = accelero.isAccelerating(e.deltaX, e.deltaY, e.timeStamp);

            if (Scrollability.hasScrollableParent(target, div)) {
                // something is scrollable, let's allow it to scroll
                return;
            }

            if (lastTarget && div.contains(lastTarget)) {
                target = lastTarget;
            } else {
                lastTarget = target;
            }

            var destinationState = (e.metaKey || e.ctrlKey || e.altKey) ? States.zooming : States.scrolling;
            if (isAccelerating || state == destinationState) {
                state = destinationState;
                var mousePos = [e.clientX, e.clientY];

                switch (state) {
                    case States.zooming:
                        // In Chrome, ctrl + wheel => pinch gesture. Do not invert zoom for the pinch
                        // gesture.
                        var factor = (prefs['invertZoom'] && !(window.chrome && e.ctrlKey)) ? -1 : 1;
                        if (window.safari && e.webkitDirectionInvertedFromDevice) {
                            factor *= -1;
                        }
                        if (e.deltaY * factor < 0) {
                            self.zoomIn(mousePos, target, e);
                        } else if (e.deltaY * factor > 0) {
                            self.zoomOut(mousePos, target, e);
                        }
                        break;
                    case States.scrolling:
                        setTimer('flushAverage', function () { averageX.flush(); averageY.flush(); }, 200);
                        averageX.push(e.deltaX); averageY.push(e.deltaY);

                        const speedFactor = (prefs['scrollSpeed'] / 100) * (prefs['invertScroll'] ? 1 : -1);
                        let dx = averageX.getAverage() * speedFactor;
                        let dy = averageY.getAverage() * speedFactor;
                        dx = dx * Math.pow(Math.abs(dx), 0.20) * 0.80;
                        dy = dy * Math.pow(Math.abs(dy), 0.20) * 0.80;

                        if (dx !== 0 || dy !== 0) {
                            self.move(mousePos, dx, dy, target);
                        }
                        break;
                }
            } else {
                state = States.idle;
            }
            e.stopPropagation();
            e.preventDefault();
            return false;
        };

        self.init(div, type);

    };

    function setTimer(timerID, newFunction, newDelay) {
        window._timers = window._timers || {};
        clearTimeout(window._timers[timerID]);
        window._timers[timerID] = setTimeout(newFunction, newDelay);
    }

    ScrollableMap.TYPE_GOOGLE_MAPS_LEGACY = 0;
    ScrollableMap.TYPE_GOOGLE_MAPS_IFRAME = 1;
    ScrollableMap.TYPE_GOOGLE_MAPS_API = 2;
    ScrollableMap.TYPE_GOOGLE_MAPS_WEB = 3;
    ScrollableMap.TYPE_ARCGIS = 4;
    ScrollableMap.TYPE_MAPBOX = 5;
    ScrollableMap.TYPE_OPEN_STREET_MAP = 6;
    ScrollableMap.TYPE_APPLE_MAPKIT = 7;
    ScrollableMap.TYPE_MAPLIBRE = 8;
    ScrollableMap.TYPE_LEAFLET = 9;
    ScrollableMap.TYPE_MAPYCZ = 10;

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
        constructor(deltaPerZoomLevel, timeThrottle) {
            this.accumulatedZoomDelta = 0;
            this.lastZoomTime = 0;
            this.deltaPerZoomLevel = deltaPerZoomLevel;
            this.timeThrottle = timeThrottle;
        }

        /**
         * Add `delta` to the zoom tracker.
         *
         * @returns `false` if the tracker should not be zooming, or a number indicating the
         * accumulated zoom amount.
         */
        zoomDelta(delta) {
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
        constructor() {
            this.data = 0;
            this.lastDataTime = 0;
        }

        push(data, time) {
            this.data = this.data * SM_LOW_PASS_FILTER_SMOOTHING + data * (1 - SM_LOW_PASS_FILTER_SMOOTHING);
            this.lastDataTime = time || Date.now();
        }

        getAverage(time) {
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
        constructor() {
            this.max = 0;
            this.maxTime = 0;
            this.lastDelta = 0;
            this.lastTime = Date.now();
        }

        isAccelerating(delta, time) {
            delta = delta / (time - this.lastTime);
            setTimer('stateChangeTimer', this.newScrollAction.bind(this), 200);

            var output = false;

            if (Math.abs(delta) > Math.abs(this.max)) {
                this.max = delta;
                this.maxTime = time;
                output = true;
            }
            var t = time - this.maxTime;
            var prediction = this.max * Math.exp(-0.0038 * t);

            var difference = (Math.abs(delta) - Math.abs(prediction));

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
        constructor() {
            this.yAccelerationDetector = new SMAccelerationDetector();
            this.xAccelerationDetector = new SMAccelerationDetector();
        }

        isAccelerating(deltaX, deltaY, time) {
            var x = this.xAccelerationDetector.isAccelerating(deltaX, time);
            var y = this.yAccelerationDetector.isAccelerating(deltaY, time);
            return x || y;
        }
    }

    const DRAG_SIMULATOR_DEFAULT_OPTS = {
        // The minimum distance to simulate a drag, to avoid the event being interpreted as
        // a click. If the scroll gesture's distance is smaller than this, it will be scaled
        // up to reach this distance.
        'minDragDistance': 3,
        // The maximum distance that can be scrolled (along either X or Y axis) before a
        // mouse up is force triggered. This is useful for street view where the panning
        // is non-linear, so that the panning response will reset one in a while.
        // If this value is too large, the stree view will stop panning until you want for
        // the mouse-up timeout. If this value is too small, the event may be treated as a
        // mouse move rather than a drag.
        'maxDistanceUntilUp': 600,
        // The delay in milliseconds before a mouse up is simulated, after the last call to
        // simulateDrag. This is non-zero for newer implementations tend to have inertial-drag
        // which tracks the mouse events over time, and therefore firing mousedown + mousemove
        // + mouseup events in the same loop synchronously will not work.
        'mouseUpDelay': 100,
    };

    class DragSimulator {
        constructor(mapType, opts) {
            this.mapType = mapType;
            this.opts = { ...DRAG_SIMULATOR_DEFAULT_OPTS, ...opts };
        }

        // Dispatch mouse and pointer events
        _dispatchPointerEvent(target, type, opts) {
            const mouseEvent = new MouseEvent('mouse' + type, opts);
            const pointerEvent = new PointerEvent('pointer' + type, { pointerId: 10088, isPrimary: true, ...opts });
            target.dispatchEvent(mouseEvent);
            target.dispatchEvent(pointerEvent);
        }

        simulateMouseDown(target, point) {
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

        simulateMouseUp(target) {
            if (!this.mouseDownPoint) return;

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

        simulateMouseMove(target, dx, dy) {
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

        simulateDrag(target, point, dx, dy) {
            if (!this.mouseDownPoint) {
                // In Google maps, if a hover card is shown, it might be a hint that dragging does something other than
                // panning the map. Unfortunately, I couldn't find a more useful indicator to tell that, so we may be
                // playing a little cat-and-mouse game here.
                const hasDragHint = this.mapType === ScrollableMap.TYPE_GOOGLE_MAPS_WEB
                    && Array.from(document.querySelectorAll('[jsaction*="hovercard"]'))
                        .some(e => e.style.display !== "none")
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
            if (Math.abs(this.simulatedMousePoint[0] - this.mouseDownPoint[0]) > maxDistanceUntilUp ||
                Math.abs(this.simulatedMousePoint[1] - this.mouseDownPoint[1]) > maxDistanceUntilUp) {
                this.simulateMouseUp(target);
            }

            if (this.opts.mouseUpDelay > 0) {
                window.clearTimeout(this.timer);
                this.timer = window.setTimeout(
                    this.simulateMouseUp.bind(this, target),
                    this.opts.mouseUpDelay);
            }
        }
    }

}
