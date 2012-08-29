var ScrollableMap = function (div, type) {
    var self = this;

    var mapClicked; // whether the map has ever been clicked (to activate the map)
    var bodyScrolls = false;
    setTimeout( function () {
        chrome.extension.sendRequest({action: 'getBodyScrolls'}, function (response) { setBodyScrolls(response); });
    }, 500);
    chrome.extension.onRequest.addListener(function(request, sender, sendResponse){
        if (request.action == 'setBodyScrolls') {
            setBodyScrolls(request.value);
        }
    });
    function setBodyScrolls (scrolls) { bodyScrolls = scrolls; (bodyScrolls) ? hideControls() : showControls(); }
    function mapRequiresActivation () { return bodyScrolls; };

    var States = { idle: 0, scrolling: 1, zooming: 2 };
    var state = States.idle;

    var averageX = new SMMovingAverage(3);
    var averageY = new SMMovingAverage(3);

    var accelero = new SM2DAccelerationDetector();
    
    self.init = function (div, type) {
        self.type = type;
        div.addEventListener("mousewheel", function (event) { self.handleWheelEvent(event); }, true);
        initFrame(div);
        document.body.style.overflow = "scroll";
        document.getElementsByTagName('html')[0].style.overflow = "scroll";
    }

    self.init(div, type);

    function initFrame (div) {
        mapClicked = false;
        PrefReader.onPreferenceChanged("frameRequireFocus", function(pair){
            (pair.value) ? hideControls() : showControls();
        });
        div.addEventListener('click', showControls, true);
        $(div).mouseleave(hideControls);
        if(mapRequiresActivation()){
            setTimeout(hideControls, 500);
        }
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

    self.move = function (point, dx, dy, target) {
        var diffX = Math.abs(dx), diffY = Math.abs(dy);
        if (diffX < 3 && diffY < 3) {
            // scale to make sure at least one of them is > 3
            // this ensures it's treated as a drag, not a click
            var scale = 3.2 / Math.max(diffX, diffY); 
            dx *= scale;
            dy *= scale;
        }

        var downEvent = document.createEvent("MouseEvents");
        downEvent.initMouseEvent("mousedown", true, true, window, 1, 0, 0, point[0], point[1], false, false, false, false, 0, null);
        target.dispatchEvent(downEvent);

        var moveEvent = document.createEvent("MouseEvents");
        moveEvent.initMouseEvent("mousemove", true, true, window, 1, 0, 0, point[0]+dx, point[1]+dy, false, false, false, false, 0, null);
        target.dispatchEvent(moveEvent);

        var upEvent = document.createEvent("MouseEvents");
        upEvent.initMouseEvent("mouseup", true, true, window, 1, 0, 0, point[0]+dx, point[1]+dy, false, false, false, false, 0, null);
        target.dispatchEvent(upEvent);
    }

    self.zoomIn = function (mousePos, target) {
        if (self.type == ScrollableMap.TYPE_IFRAME) {
            zoomInFrame(mousePos, target);
        } else {
            zoomInWeb(mousePos, target);
        }
    }

    self.zoomOut = function (mousePos, target) {
        if (self.type == ScrollableMap.TYPE_IFRAME) {
            zoomOutFrame(mousePos, target);
        } else {
            zoomOutWeb(mousePos, target);
        }
    }

    var lastZoomTime = 0;
    var MINZOOMINTERVAL = 200;

    function zoomInWeb (mousePos, target) {
        if(new Date().getTime() - lastZoomTime < MINZOOMINTERVAL) return;
        lastZoomTime = new Date().getTime();
        // (-88, -88) is to pass through backdoor that the ScrollMaps event handler left open
        var e = document.createEvent("WheelEvent");
        e.initWebKitWheelEvent(0, 1, window, -88, -88, mousePos[0], mousePos[1], false, false, false, false);
        target.dispatchEvent(e);
    }

    function zoomInFrame(mousePos, target){
        if(new Date().getTime() - lastZoomTime < MINZOOMINTERVAL) return;
        lastZoomTime = new Date().getTime();

        var event = document.createEvent("MouseEvents");
        event.initMouseEvent("dblclick", true, true, window, 2, 0, 0, mousePos[0], mousePos[1], false, false, false, false, 0, null);
        target.dispatchEvent(event);
    }

    function zoomOutWeb (mousePos, target) {
        if(new Date().getTime() - lastZoomTime < MINZOOMINTERVAL) return;
        lastZoomTime = new Date().getTime();
        // (-88, -88) is to pass through backdoor that the ScrollMaps event handler left open
        var e = document.createEvent("WheelEvent");
        e.initWebKitWheelEvent(0, -1, window, -88, -88, mousePos[0], mousePos[1], false, false, false, false);
        target.dispatchEvent(e);
    }

    function zoomOutFrame(mousePos, target){
        if(new Date().getTime() - lastZoomTime < MINZOOMINTERVAL) return;
        lastZoomTime = new Date().getTime();

        var event = document.createEvent("MouseEvents");
        event.initMouseEvent("contextmenu", true, true, window, 2, 0, 0, mousePos[0], mousePos[1], false, false, false, false, 2, null);
        target.dispatchEvent(event);

        var event = document.createEvent("MouseEvents");
        event.initMouseEvent("contextmenu", true, true, window, 2, 0, 0, mousePos[0], mousePos[1], false, false, false, false, 2, null);
        target.dispatchEvent(event);
    }

    var lastTarget;

    self.handleWheelEvent = function (e) {
        if (!pref("enabled")) return;
        if ((self.type == ScrollableMap.TYPE_IFRAME || self.type == ScrollableMap.TYPE_API) && !pref('enableForFrames') ) return;
        if (pref('frameRequireFocus') && mapRequiresActivation() && !mapClicked) { e.stopPropagation(); return; }
        if (e.screenX == -88 && e.screenY == -88) return; // backdoor for zooming

        var target = e.target || e.srcElement;
        var isAccelerating = (!pref("isolateZoomScroll") || accelero.isAccelerating(e.wheelDeltaX, e.wheelDeltaY, e.timeStamp));

        if (lastTarget && arrayContainsElement($(lastTarget).parents(), div)) target = lastTarget;
        else lastTarget = target;


        var destinationState = (e.metaKey) ? States.zooming : States.scrolling;
        if (isAccelerating || state == destinationState) {
            state = destinationState;
            var mousePos = [e.clientX, e.clientY];

            switch (state) {
                case States.zooming: 
                    var factor = (pref("invertZoom")) ? -1 : 1;
                    if (e.webkitDirectionInvertedFromDevice) {
                        factor *= -1;
                    }
                    if(e.wheelDeltaY * factor > 3){
                        self.zoomIn(mousePos, target);
                    }else if(e.wheelDeltaY * factor < -3){
                        self.zoomOut(mousePos, target);
                    }
                    break;
                case States.scrolling: 
                    setTimer('flushAverage', function () { averageX.flush(); averageY.flush(); }, 200);
                    averageX.push(e.wheelDeltaX); averageY.push(e.wheelDeltaY);

                    var speedFactor = ( pref("scrollSpeed") / 100 ) * ( pref('invertScroll') ? -1 : 1 );
                    var dx = averageX.getAverage() * speedFactor;
                    var dy = averageY.getAverage() * speedFactor;

                    if (dx != 0 || dy != 0) {
                        self.move(mousePos, dx, dy, target);
                    }
                    break;
            }
        } else {
            state = States.idle;
        }
        e.stopPropagation();
        e.preventDefault();
    }

}

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

var SMMovingAverage = function(max){
    var self = this;
    var data = [];

    this.push = function(item){
        data.push(item);
        if(data.length > max)
            data.splice(0, 1); // remove oldest value
    }

    this.flush = function(){
        data = [];
    }

    this.getAverage = function(){
        if(data.length < max){
            // return newest item if not fully populated
            return data[data.length-1];
        }
        var sum = 0;
        for(var i=0, count=data.length; i<count; i++){
            sum += data[i];
        }
        return sum / data.length;
    }

    this.length = function(){
        return data.length;
    }
}

var SMAccelerationDetector = function(){
    var max = 0, maxTime = 0;
    var lastDelta = 0;
    var lastTime = new Date().getTime();

    this.isAccelerating = function(delta, time){
        var delta = delta / (time - lastTime);
        setTimer('stateChangeTimer', newScrollAction, 200);

        var output = false;

        if(Math.abs(delta) > Math.abs(max)){
            max = delta;
            maxTime = time;
            output = true;
            // true
        }
        var t = time - maxTime;
        var prediction = max * Math.exp(-0.0038*t);

        var difference = (Math.abs(delta) - Math.abs(prediction));

        if(difference / Math.abs(prediction) > 1.2 && difference > 0.5){
            // true
            newScrollAction();
            output = true;
        }
        return output;
    }

    function newScrollAction(){
        max = 0;
        maxTime = 0;
        lastDelta = 0;
    }
}

var SM2DAccelerationDetector = function () {
    var yAccelerationDetector = new SMAccelerationDetector();
    var xAccelerationDetector = new SMAccelerationDetector();

    this.isAccelerating = function (deltaX, deltaY, time) {
        var x = xAccelerationDetector.isAccelerating(deltaX, time);
        var y = yAccelerationDetector.isAccelerating(deltaY, time);
        return x || y;
    }
}

