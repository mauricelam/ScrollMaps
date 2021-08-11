/*global $ Message pref */

const DEBUG = false;

var ScrollableMap = function (div, type, id) {

    let enabled = false;

    function enable() {
        enabled = true;
        chrome.runtime.sendMessage({'action': 'mapLoaded'});
        hideControls();
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
    if (div.__scrollMapEnabled) return;
    div.__scrollMapEnabled = true;

    var self = this;

    var mapClicked; // whether the map has ever been clicked (to activate the map)
    var bodyScrolls = false;

    div.setAttribute('data-scrollmaps', id);

    var style = document.createElement('style');
    style.innerHTML =   '.gmnoprint, .gm-style .place-card, .gm-style .login-control { transition: opacity 0.3s !important; }' +
                        '.scrollMapsHideControls .gmnoprint, .scrollMapsHideControls .gm-style .place-card, .scrollMapsHideControls .gm-style .login-control { opacity: 0.5 !important; }';
    document.head.appendChild(style);

    function getWheelEventTarget(mousePos) {
        var hoverElement = document.elementFromPoint(mousePos[0], mousePos[1]);
        return hoverElement && div.contains(hoverElement) ? hoverElement : div;
    }

    Scrollability.monitorScrollabilitySuper(div, function (scrolls) {
        bodyScrolls = scrolls;
        if (bodyScrolls) { hideControls(); } else { showControls(); }
    });

    function mapRequiresActivation () {
        return self.type != ScrollableMap.TYPE_NEWWEB && bodyScrolls;
    }

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
        Pref.onPreferenceChanged('frameRequireFocus', function(pair){
            (pair.value) ? hideControls() : showControls();
        });

        Pref.onPreferenceChanged('enabled', (pair) => {
            if (pair.value) enable();
        });

        chrome.runtime.onMessage.addListener(
            (request, sender, sendResponse) => {
                if (request.action === 'browserActionClicked') {
                    enable();
                }
            });

        div.addEventListener('click', handleClick, true);
        div.addEventListener('mousedown', blockEventIfNotActivated, true);
        div.addEventListener('mouseup', blockEventIfNotActivated, true)
        $(div).mouseleave(hideControls);
        if (mapRequiresActivation()){
            setTimeout(hideControls, 500);
        }
    }

    function blockEventIfNotActivated(event) {
        if (pref('frameRequireFocus') && mapRequiresActivation() && !mapClicked) {
            event.stopPropagation();
            event.preventDefault();
        }
    }

    function handleClick(event) {
        showControls(event);
        lastTarget = null;
    }

    function showControls(event) {
        if (pref('frameRequireFocus') && mapRequiresActivation() && !mapClicked) {
            if (event) event.stopPropagation();
            mapClicked = true;
            $(div).removeClass('scrollMapsHideControls');
        }
    }
    function hideControls() {
        if (mapRequiresActivation() && enabled && pref('frameRequireFocus')) {
            mapClicked = false;
            $(div).addClass('scrollMapsHideControls');
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

    self.zoomIn = function (mousePos, target, originalEvent) {
        zoomInWeb(mousePos, target, originalEvent);
    };

    self.zoomOut = function (mousePos, target, originalEvent) {
        zoomOutWeb(mousePos, target, originalEvent);
    };

    var lastZoomTime = 0;
    var MINZOOMINTERVAL = 200;

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

    function zoomInWeb (mousePos, target, originalEvent) {
        // New Google Maps zooms much better with respect to unmodified mouse wheel events. Let's
        // keep that behavior for Cmd-scrolling.
        if (originalEvent instanceof WheelEvent) {
            // Scale the pinch gesture 3x for non-web maps, because pinch gesture normally
            // have much less "delta" than scroll
            let scale = 1;
            if (originalEvent.ctrlKey) {
                scale = pref('zoomSpeed') / 100;
                if (type !== ScrollableMap.TYPE_NEWWEB) scale *= 3;
            }
            let e = createBackdoorWheelEvent(originalEvent, true /* zoomIn */, scale);
            target.dispatchEvent(e);
            return;
        }

        // Fallback, just-in-case the original event is not a wheel event (e.g. programmatic call,
        // or keyboard +/-)
        if (Date.now() - lastZoomTime < MINZOOMINTERVAL) return;
        lastZoomTime = Date.now();
        // (-88, -88) is to pass through backdoor that the ScrollMaps event handler left open
        let dispatchClick = (event) => {
            let e = new MouseEvent(event, {
                bubbles: true,
                cancelable: true,
                screenX: -88,
                screenY: -88,
                button: 1,
                buttons: 1,
                clientX: mousePos[0],
                clientY: mousePos[1],
                view: window
            });
            target.dispatchEvent(e);
        };
        dispatchClick('mousedown');
        dispatchClick('mouseup');
        dispatchClick('click');
        dispatchClick('mousedown');
        dispatchClick('mouseup');
        dispatchClick('click');
        dispatchClick('dblclick');
    }

    function zoomOutWeb (mousePos, target, originalEvent) {
        // New Google Maps zooms much better using unmodified mouse wheel events. Let's
        // keep that behavior for Cmd-scrolling.
        if (originalEvent instanceof WheelEvent) {
            // Scale the pinch gesture 3x for non-web maps, because pinch gesture normally
            // have much less "delta" than scroll
            let scale = 1;
            if (originalEvent.ctrlKey) {
                scale = pref('zoomSpeed') / 100;
                if (type !== ScrollableMap.TYPE_NEWWEB) scale *= 3;
            }
            let e = createBackdoorWheelEvent(originalEvent, false /* zoomIn */, scale);
            target.dispatchEvent(e);
            return;
        }

        // Fallback, just-in-case the original event is not a wheel event (e.g. programmatic call,
        // or keyboard +/-)
        if (Date.now() - lastZoomTime < MINZOOMINTERVAL) return;
        lastZoomTime = Date.now();
        // (-88, -88) is to pass through backdoor that the ScrollMaps event handler left open
        let dispatchRightClick = (event) => {
            let e = new MouseEvent(event, {
                bubbles: true,
                cancelable: true,
                screenX: -88,
                screenY: -88,
                button: 2,
                buttons: 2,
                clientX: mousePos[0],
                clientY: mousePos[1],
                view: window
            });
            target.dispatchEvent(e);
        };
        dispatchRightClick('mousedown');
        dispatchRightClick('mouseup');
        dispatchRightClick('mousedown');
        dispatchRightClick('mouseup');
    }

    var lastTarget;
    self.handleWheelEvent = function (e) {
        if (!enabled && !window.safari) return;
        if (pref('frameRequireFocus') && mapRequiresActivation() && !mapClicked) {
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

        if (lastTarget && arrayContainsElement($(lastTarget).parents(), div))
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
                    var factor = (pref('invertZoom') && !(window.chrome && e.ctrlKey)) ? -1 : 1;
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

                    const speedFactor = ( pref('scrollSpeed') / 100 ) * ( pref('invertScroll') ? 1 : -1 );
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

    function isFirefox() {
        return navigator.userAgent.indexOf('Firefox') !== -1;
    }

    self.init(div, type);

};

function arrayContainsElement (array, element) {
    if (!array) return false;
    for (var i = 0; i < array.length; i++) {
        try {
            if (element.isSameNode(array[i])) return true;
        } catch (e) {
            console.warn(e, array, element);
        }
    }
    return false;
}

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

var SMLowPassFilter = function SMLowPassFilter () { this.init.apply(this, arguments); };
SMLowPassFilter.SMOOTHING = 0.5;

SMLowPassFilter.prototype = {
    init: function () {
        this.data = 0;
        this.lastDataTime = 0;
    },
    push: function (data, time) {
        this.data = this.data * SMLowPassFilter.SMOOTHING + data * (1 - SMLowPassFilter.SMOOTHING);
        this.lastDataTime = time || Date.now();
    },
    getAverage: function (time) {
        time = time || Date.now();
        if (this.lastDataTime === 0) {
            return 0;
        }
        return this.data * Math.pow(SMLowPassFilter.SMOOTHING, (time - this.lastDataTime) / 20);
    },
    flush: function () {
        this.data = 0;
    }
};

var SMAccelerationDetector = function SMAccelerationDetector() { this.init.apply(this, arguments); };

SMAccelerationDetector.prototype = {
    init: function () {
        this.max = 0;
        this.maxTime = 0;
        this.lastDelta = 0;
        this.lastTime = Date.now();
    },
    isAccelerating: function(delta, time){
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
    },
    newScrollAction: function (){
        this.max = 0;
        this.maxTime = 0;
        this.lastDelta = 0;
    }
};

var SM2DAccelerationDetector = function SM2DAccelerationDetector() { this.init.apply(this, arguments); };

SM2DAccelerationDetector.prototype = {
    init: function () {
        this.yAccelerationDetector = new SMAccelerationDetector();
        this.xAccelerationDetector = new SMAccelerationDetector();
    },
    isAccelerating: function (deltaX, deltaY, time) {
        var x = this.xAccelerationDetector.isAccelerating(deltaX, time);
        var y = this.yAccelerationDetector.isAccelerating(deltaY, time);
        return x || y;
    }
};

var DragSimulator = function DragSimulator() { this.init.apply(this, arguments); };

DragSimulator.defaultOpts = {
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

DragSimulator.prototype = {
    init: function (opts) {
        this.opts = {};
        for (var i in DragSimulator.defaultOpts) {
            if (i in opts) {
                this.opts[i] = opts[i];
            } else {
                this.opts[i] = DragSimulator.defaultOpts[i];
            }
        }
    },
    simulateMouseDown: function (target, point) {
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
    },
    simulateMouseUp: function (target) {
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
    },
    simulateMouseMove: function (target, dx, dy) {
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
    },
    simulateDrag: function (target, point, dx, dy) {
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
};
