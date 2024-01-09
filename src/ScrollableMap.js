if (window.ScrollableMap === undefined) {

    const DEBUG = chrome.runtime.getManifest().version === '10000';
    window.ScrollableMap = function (div, type, id, prefs) {

        let enabled = false;

        function enable() {
            if (enabled) return;
            enabled = true;
            chrome.runtime.sendMessage({'action': 'mapLoaded'});
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
        style.innerHTML =   '.gmnoprint, .gm-style .place-card, .gm-style .login-control { transition: opacity 0.3s !important; }' +
                            '.scrollMapsHideControls .gmnoprint, .scrollMapsHideControls .gm-style .place-card, .scrollMapsHideControls .gm-style .login-control { opacity: 0.5 !important; }';
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

            window.addEventListener('mousemove', function (e) {
                if (e.detail !== 88) {
                    var event = new CustomEvent('realmousemove', {'detail': [e.pageX, e.pageY]});
                    e.target.dispatchEvent(event);
                }
            }, true);

            mapClicked = false;
            Pref.onPreferenceChanged('frameRequireFocus', (key, value) => {
                refreshActivationAffordance();
            });

            Pref.onPreferenceChanged('enabled', (key, value) => {
                if (value) enable();
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
                    chrome.runtime.sendMessage({action: 'mapUnloaded'});
                }
            });
            mutationObserver.observe(document.documentElement, { childList: true, subtree: true });

            window.addEventListener('unload', () => {
                // For the case where ScrollMap is loaded in an iframe, and that iframe is removed.
                chrome.runtime.sendMessage({action: 'mapUnloaded'});
            });
        }

        // A map is activatable when
        //   1. relevant settings and scrollability requirements are met, and
        //   2. it is not currently activated.
        function _isMapActivatable() {
            return self.type !== ScrollableMap.TYPE_NEWWEB &&  // Web maps are never activatable
                bodyScrolls &&
                prefs['frameRequireFocus'] &&
                enabled &&
                !mapClicked;
        }

        function refreshActivationAffordance() {
            if (_isMapActivatable()) {
                div.classList.add('scrollMapsHideControls');
            } else {
                div.classList.remove('scrollMapsHideControls');
            }
        }

        var dragger = new DragSimulator({});

        self.realMouseMoved = function (e) {
            if (lastTarget) {
                dragger.simulateMouseUp(lastTarget);
            }
        };
        window.addEventListener('realmousemove', self.realMouseMoved, true);

        self.move = function (point, dx, dy, target) {
            dragger.simulateDrag(target, point, dx, dy);
        };

        const zoomDeltaTracker = new ZoomDeltaTracker();

        self.zoomIn = function (mousePos, target, originalEvent) {
            // New Google Maps zooms much better with respect to unmodified mouse wheel events. Let's
            // keep that behavior for Cmd-scrolling.
            if (originalEvent instanceof WheelEvent) {
                // Scale the pinch gesture 3x for non-web maps, because pinch gesture normally
                // have much less "delta" than scroll
                let scale = 1;
                if (originalEvent.ctrlKey) {
                    scale = prefs['zoomSpeed'] / 100;
                    if (type !== ScrollableMap.TYPE_NEWWEB) scale *= 3;
                    if (type !== ScrollableMap.TYPE_NEWWEB || !isWebGlCanvas(target)) {
                        // For 2d canvas (try with ?force=canvas in the URL), the zooming doesn't
                        // behave naturally. It zooms a specific increment on each wheel event
                        // and doesn't look at deltaY. Throttle the number of events to keep the
                        // zooming at a reasonable rate.
                        if (!zoomDeltaTracker.zoomInDelta(originalEvent.deltaY * scale)) {
                            return;
                        }
                    }
                }
                let e = createBackdoorWheelEvent(originalEvent, true /* zoomIn */, scale);
                target.dispatchEvent(e);
                return;
            } else {
                console.warn('ScrollMaps unexpected event', originalEvent);
            }
        };

        self.zoomOut = function (mousePos, target, originalEvent) {
            // New Google Maps zooms much better using unmodified mouse wheel events. Let's
            // keep that behavior for Cmd-scrolling.
            if (originalEvent instanceof WheelEvent) {
                // Scale the pinch gesture 3x for non-web maps, because pinch gesture normally
                // have much less "delta" than scroll
                let scale = 1;
                if (originalEvent.ctrlKey) {
                    scale = prefs['zoomSpeed'] / 100;
                    if (type !== ScrollableMap.TYPE_NEWWEB) scale *= 3;
                    if (type !== ScrollableMap.TYPE_NEWWEB || !isWebGlCanvas(target)) {
                        // For 2d canvas (try with ?force=canvas in the URL), the zooming doesn't
                        // behave naturally. It zooms a specific increment on each wheel event
                        // and doesn't look at deltaY. Throttle the number of events to keep the
                        // zooming at a reasonable rate.
                        if (!zoomDeltaTracker.zoomOutDelta(originalEvent.deltaY * scale)) {
                            return;
                        }
                    }
                }
                let e = createBackdoorWheelEvent(originalEvent, false /* zoomIn */, scale);
                target.dispatchEvent(e);
                return;
            } else {
                console.warn('ScrollMaps unexpected event', originalEvent);
            }
        };

        function createBackdoorWheelEvent(originalEvent, zoomIn, scale) {
            if (originalEvent instanceof WheelEvent) {
                var init = {};
                for (var i in originalEvent) {
                    init[i] = originalEvent[i];
                }
                init.screenX = -88;
                init.screenY = -88;

                if (zoomIn && init.deltaY > 0) {
                    init.deltaY *= -1;
                } else if (!zoomIn && init.deltaY < 0) {
                    init.deltaY *= -1;
                }
                init.deltaY *= scale || 1;

                return new WheelEvent('wheel', init);
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

            if (e.screenX == -88 && e.screenY == -88) {
                return; // backdoor for zooming
            }

            var target = e.target || e.srcElement;
            var isAccelerating = accelero.isAccelerating(e.deltaX, e.deltaY, e.timeStamp);

            if (Scrollability.hasScrollableParent(target, div)) {
                // something is scrollable, let's allow it to scroll
                return;
            }

            if (lastTarget && div.contains(lastTarget))
                target = lastTarget;
            else
                lastTarget = target;

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
                        if (e.deltaY * factor < 0){
                            self.zoomIn(mousePos, target, e);
                        } else if (e.deltaY * factor > 0){
                            self.zoomOut(mousePos, target, e);
                        }
                        break;
                    case States.scrolling:
                        setTimer('flushAverage', function () { averageX.flush(); averageY.flush(); }, 200);
                        averageX.push(e.deltaX); averageY.push(e.deltaY);

                        console.log('invertscroll', prefs['invertScroll']);
                        const speedFactor = ( prefs['scrollSpeed'] / 100 ) * ( prefs['invertScroll'] ? 1 : -1 );
                        const dx = averageX.getAverage() * speedFactor;
                        const dy = averageY.getAverage() * speedFactor;

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

    function setTimer (timerID, newFunction, newDelay) {
        window._timers = window._timers || {};
        clearTimeout(window._timers[timerID]);
        window._timers[timerID] = setTimeout(newFunction, newDelay);
    }

    ScrollableMap.TYPE_WEB = 0;
    ScrollableMap.TYPE_IFRAME = 1;
    ScrollableMap.TYPE_API = 2;
    ScrollableMap.TYPE_NEWWEB = 3;
    ScrollableMap.TYPE_STREETVIEW_API = 4;


    const DELTA_PER_ZOOM_LEVEL = 50;

    class ZoomDeltaTracker {
        constructor() {
            this.accumulatedZoomDelta = 0;
            this.lastZoomTime = 0;
        }

        zoomInDelta(delta) {
            if (Date.now() - this.lastZoomTime > 1000) this.accumulatedZoomDelta = 0;
            this.accumulatedZoomDelta += delta;
            this.lastZoomTime = Date.now();
            if (this.accumulatedZoomDelta > -DELTA_PER_ZOOM_LEVEL) return false;
            this.accumulatedZoomDelta += DELTA_PER_ZOOM_LEVEL;
            return true;
        }

        zoomOutDelta(delta) {
            if (Date.now() - this.lastZoomTime > 1000) this.accumulatedZoomDelta = 0;
            this.accumulatedZoomDelta += delta;
            this.lastZoomTime = Date.now();
            if (this.accumulatedZoomDelta < DELTA_PER_ZOOM_LEVEL) return false;
            this.accumulatedZoomDelta -= DELTA_PER_ZOOM_LEVEL;
            return true;
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
                return 0;
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

            if (Math.abs(delta) > Math.abs(this.max)){
                this.max = delta;
                this.maxTime = time;
                output = true;
            }
            var t = time - this.maxTime;
            var prediction = this.max * Math.exp(-0.0038*t);

            var difference = (Math.abs(delta) - Math.abs(prediction));

            if (difference / Math.abs(prediction) > 1.2 && difference > 0.5){
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
        constructor(opts) {
            this.opts = {};
            for (var i in DRAG_SIMULATOR_DEFAULT_OPTS) {
                if (i in opts) {
                    this.opts[i] = opts[i];
                } else {
                    this.opts[i] = DRAG_SIMULATOR_DEFAULT_OPTS[i];
                }
            }
        }

        simulateMouseDown(target, point) {
            this.mouseDownPoint = [point[0], point[1]];  // Deep copy
            this.simulatedMousePoint = point;
            var downEvent = new MouseEvent('mousedown', {
                'bubbles': true,
                'cancelable': true,
                'detail': 1,
                'clientX': point[0],
                'clientY': point[1],
                'button': 0,
                'buttons': 1
            });
            target.dispatchEvent(downEvent);
        }

        simulateMouseUp(target) {
            if (!this.mouseDownPoint) return;
            var upEvent = new MouseEvent('mouseup', {
                'bubbles': true,
                'cancelable': true,
                'detail': 1,
                'clientX': this.simulatedMousePoint[0],
                'clientY': this.simulatedMousePoint[1],
                'button': 0,
                'buttons': 0
            });
            target.dispatchEvent(upEvent);
            this.mouseDownPoint = null;
        }

        simulateMouseMove(target, dx, dy) {
            this.simulatedMousePoint[0] += dx;
            this.simulatedMousePoint[1] += dy;
            var moveEvent = new MouseEvent('mousemove', {
                'bubbles': true,
                'cancelable': false,
                'detail': 88,
                'clientX': this.simulatedMousePoint[0],
                'clientY': this.simulatedMousePoint[1],
                'button': 0,
                'buttons': 1  // Left mouse button should be down when simulating drag-move
            })
            target.dispatchEvent(moveEvent);
        }

        simulateDrag(target, point, dx, dy) {
            var minDragDistance = this.opts.minDragDistance;
            var diffX = Math.abs(dx), diffY = Math.abs(dy);
            if (diffX < minDragDistance && diffY < minDragDistance) {
                // scale to make sure at least one of them is > minDragDistance
                // this ensures it's treated as a drag, not a click
                var scale = (minDragDistance * 1.05) / Math.max(diffX, diffY);
                dx *= scale;
                dy *= scale;
            }

            if (!this.mouseDownPoint) {
                this.simulateMouseDown(target, point);
            }

            this.simulateMouseMove(target, dx, dy);

            // Street view panning has set an exponential decaying curve, in order for the scroll
            // to continue, pretend a mouse up every so often.
            // There is a visible jump when this happens if you observe carefully, but the results
            // are good enough for general use.
            var maxDistanceUntilUp = this.opts.maxDistanceUntilUp;
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
