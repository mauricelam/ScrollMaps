/*global $ Message pref */

var ScrollableMap = function (div, type, id) {
    var self = this;

    var mapClicked; // whether the map has ever been clicked (to activate the map)
    var bodyScrolls = false;

    // Whether an element is scrollable
    function scrollable (element) {
        if (!element || !element.ownerDocument) return false;
        if (element.scrollHeight <= element.clientHeight) return false;
        var overflow = $(element).css('overflow');
        return overflow !== 'hidden' && overflow !== 'visible';
    }

    function hasScrollableParent (element, until) {
        if (scrollable(element)) return true;
        if (!element.parentNode || element.parentNode === until || element.isSameNode(until)) return false;
        return hasScrollableParent(element.parentNode, until);
    }

    if (type === ScrollableMap.TYPE_IFRAME) {
        setTimeout(function () {
            Message.extension.sendMessage('listenBodyScrolls', {});
        }, 500);
        Message.extension.addListener(function(action, data, sender, sendResponse){
            if (action === 'setBodyScrolls') setBodyScrolls(data.scrolls);
        });
    } else {
        window.addEventListener('resize', function () {
            setBodyScrolls(hasScrollableParent(div.parentNode));
        });
        window.setTimeout(function () {
            setBodyScrolls(hasScrollableParent(div.parentNode));
        }, 1000);
    }

    function setBodyScrolls (scrolls) {
        bodyScrolls = scrolls;
        if (bodyScrolls) { hideControls(); } else { showControls(); }
    }
    function mapRequiresActivation () { return bodyScrolls; }

    var States = { idle: 0, scrolling: 1, zooming: 2 };
    var state = States.idle;

    var averageX = new SMLowPassFilter(2);
    var averageY = new SMLowPassFilter(2);

    var accelero = new SM2DAccelerationDetector();
    
    self.init = function (div, type) {
        self.type = type;
        div.addEventListener('mousewheel', self.handleWheelEvent, true);
        initFrame(div);
        // Fix for webkit bug
        document.documentElement.style.overflow = 'scroll';
    };

    function initFrame (div) {
        mapClicked = false;
        Pref.onPreferenceChanged('frameRequireFocus', function(pair){
            (pair.value) ? hideControls() : showControls();
        });
        div.addEventListener('click', didClickMap, true);
        $(div).mouseleave(hideControls);
        if (mapRequiresActivation()){
            setTimeout(hideControls, 500);
        }
    }

    function didClickMap (event) {
        showControls(event);
        lastTarget = null;
    }

    function showControls(event){
        if (!mapClicked) {
            if (event) event.stopPropagation();
            mapClicked = true;
            $(div).find('.gmnoprint').fadeIn(100);
        }
    }
    function hideControls(){
        if (mapRequiresActivation() && pref('enabled') && pref('frameRequireFocus')) {
            mapClicked = false;
            $(div).find('.gmnoprint').fadeOut(200);
        }
    }

    var gpoint = [0, 0];
    var timer;
    var pretendingMouseDown = false;

    self.moveNewMaps = function (point, dx, dy, target) {
        if (!pretendingMouseDown) {
            gpoint = point;
        }
        point = gpoint;
        var diffX = Math.abs(dx), diffY = Math.abs(dy);
        if (diffX < 3 && diffY < 3) {
            // scale to make sure at least one of them is > 3
            // this ensures it's treated as a drag, not a click
            var scale = 3.2 / Math.max(diffX, diffY);
            dx *= scale;
            dy *= scale;
        }

        if (!pretendingMouseDown) {
            var downEvent = document.createEvent('MouseEvents');
            downEvent.initMouseEvent('mousedown', true, true, window, 1, 0, 0, point[0], point[1], false, false, false, false, 0, null);
            target.dispatchEvent(downEvent);
            pretendingMouseDown = true;
        }

        var moveEvent = document.createEvent('MouseEvents');
        moveEvent.initMouseEvent('mousemove', true, false, window, 88, 0, 0, point[0]+dx, point[1]+dy, false, false, false, false, 0, null);
        target.dispatchEvent(moveEvent);

        window.clearTimeout(timer);
        timer = window.setTimeout(function () {
            var upEvent = document.createEvent('MouseEvents');
            upEvent.initMouseEvent('mouseup', true, true, window, 1, 0, 0, gpoint[0], gpoint[1], false, false, false, false, 0, null);
            target.dispatchEvent(upEvent);
            pretendingMouseDown = false;
        }, 100);

        gpoint[0] += dx;
        gpoint[1] += dy;
    };

    self.mouseMoved = function () {
        if (self.type !== ScrollableMap.TYPE_NEWWEB || !lastTarget) return;
        var upEvent = document.createEvent('MouseEvents');
        upEvent.initMouseEvent('mouseup', true, true, window, 1, 0, 0, gpoint[0], gpoint[1], false, false, false, false, 0, null);
        lastTarget.dispatchEvent(upEvent);
        pretendingMouseDown = false;
    };
    window.addEventListener('realmousemove', self.mouseMoved, true);

    self.moveLegacy = function (point, dx, dy, target) {
        var diffX = Math.abs(dx), diffY = Math.abs(dy);
        if (diffX < 3 && diffY < 3) {
            // scale to make sure at least one of them is > 3
            // this ensures it's treated as a drag, not a click
            var scale = 3.2 / Math.max(diffX, diffY);
            dx *= scale;
            dy *= scale;
        }

        var downEvent = document.createEvent('MouseEvents');
        downEvent.initMouseEvent('mousedown', true, true, window, 1, 0, 0, point[0], point[1], false, false, false, false, 0, null);
        target.dispatchEvent(downEvent);

        var moveEvent = document.createEvent('MouseEvents');
        moveEvent.initMouseEvent('mousemove', true, true, window, 1, 0, 0, point[0]+dx, point[1]+dy, false, false, false, false, 0, null);
        target.dispatchEvent(moveEvent);

        var upEvent = document.createEvent('MouseEvents');
        upEvent.initMouseEvent('mouseup', true, true, window, 1, 0, 0, point[0]+dx, point[1]+dy, false, false, false, false, 0, null);
        target.dispatchEvent(upEvent);
    };

    self.move = function (point, dx, dy, target) {
        if (self.type === ScrollableMap.TYPE_NEWWEB) {
            self.moveNewMaps(point, dx, dy, target);
        } else {
            self.moveLegacy(point, dx, dy, target);
        }
    };

    self.zoomIn = function (mousePos, target) {
        if (self.type == ScrollableMap.TYPE_IFRAME) {
            zoomInFrame(mousePos, target);
        } else {
            zoomInWeb(mousePos, target);
        }
    };

    self.zoomOut = function (mousePos, target) {
        if (self.type == ScrollableMap.TYPE_IFRAME) {
            zoomOutFrame(mousePos, target);
        } else {
            zoomOutWeb(mousePos, target);
        }
    };

    var lastZoomTime = 0;
    var MINZOOMINTERVAL = 200;

    function zoomInWeb (mousePos, target) {
        if (Date.now() - lastZoomTime < MINZOOMINTERVAL) return;
        lastZoomTime = Date.now();
        // (-88, -88) is to pass through backdoor that the ScrollMaps event handler left open
        var e = document.createEvent('WheelEvent');
        e.initWebKitWheelEvent(0, 1, window, -88, -88, mousePos[0], mousePos[1], false, false, false, false);
        target.dispatchEvent(e);
    }

    function zoomInFrame(mousePos, target){
        if (Date.now() - lastZoomTime < MINZOOMINTERVAL) return;
        lastZoomTime = Date.now();

        var event = document.createEvent('MouseEvents');
        event.initMouseEvent('dblclick', true, true, window, 2, 0, 0, mousePos[0], mousePos[1], false, false, false, false, 0, null);
        target.dispatchEvent(event);
    }

    function zoomOutWeb (mousePos, target) {
        if (Date.now() - lastZoomTime < MINZOOMINTERVAL) return;
        lastZoomTime = Date.now();
        // (-88, -88) is to pass through backdoor that the ScrollMaps event handler left open
        var e = document.createEvent('WheelEvent');
        e.initWebKitWheelEvent(0, -1, window, -88, -88, mousePos[0], mousePos[1], false, false, false, false);
        target.dispatchEvent(e);
    }

    function zoomOutFrame(mousePos, target){
        if (Date.now() - lastZoomTime < MINZOOMINTERVAL) return;
        lastZoomTime = Date.now();

        var firstRightClick = document.createEvent('MouseEvents');
        firstRightClick.initMouseEvent('contextmenu', true, true, window, 2, 0, 0, mousePos[0], mousePos[1], false, false, false, false, 2, null);
        target.dispatchEvent(firstRightClick);

        var secondRightClick = document.createEvent('MouseEvents');
        secondRightClick.initMouseEvent('contextmenu', true, true, window, 2, 0, 0, mousePos[0], mousePos[1], false, false, false, false, 2, null);
        target.dispatchEvent(secondRightClick);
    }

    var lastTarget;

    self.handleWheelEvent = function (e) {
        if (!pref('enabled') && !window.safari) return;
        if ((self.type == ScrollableMap.TYPE_IFRAME || self.type == ScrollableMap.TYPE_API) && !pref('enableForFrames') ) return;
        if (pref('frameRequireFocus') && mapRequiresActivation() && !mapClicked) {
            e.stopPropagation(); return;
        }
        if (e.screenX == -88 && e.screenY == -88) return; // backdoor for zooming

        var target = e.target || e.srcElement;
        var isAccelerating = (!pref('isolateZoomScroll') ||
            accelero.isAccelerating(e.wheelDeltaX, e.wheelDeltaY, e.timeStamp));

        if (hasScrollableParent(target, div)) {
            // something is scrollable, let's allow it to scroll
            return;
        }

        if (lastTarget && arrayContainsElement($(lastTarget).parents(), div))
            target = lastTarget;
        else
            lastTarget = target;


        var destinationState = (e.metaKey) ? States.zooming : States.scrolling;
        if (isAccelerating || state == destinationState) {
            state = destinationState;
            var mousePos = [e.clientX, e.clientY];

            switch (state) {
                case States.zooming:
                    var factor = (pref('invertZoom')) ? -1 : 1;
                    if (window.safari && e.webkitDirectionInvertedFromDevice) {
                        factor *= -1;
                    }
                    if (e.wheelDeltaY * factor > 3){
                        self.zoomIn(mousePos, target);
                    } else if (e.wheelDeltaY * factor < -3){
                        self.zoomOut(mousePos, target);
                    }
                    break;
                case States.scrolling:
                    setTimer('flushAverage', function () { averageX.flush(); averageY.flush(); }, 200);
                    averageX.push(e.wheelDeltaX); averageY.push(e.wheelDeltaY);

                    var speedFactor = ( pref('scrollSpeed') / 100 ) * ( pref('invertScroll') ? -1 : 1 );
                    var dx = averageX.getAverage() * speedFactor;
                    var dy = averageY.getAverage() * speedFactor;

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
    };

    self.init(div, type);

};

function arrayContainsElement (array, element) {
    if (!array) return false;
    for (var i in array) {
        if (element.isSameNode(array[i])) return true;
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
