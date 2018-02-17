var Options = {};

(function(){

    Options.createOptions = function(){
        var box = $('#checkboxes');

        var enabledCheckbox = PrefMaker.makeBooleanCheckbox(
            'enabled',
            'Enable on this computer',
            'Enable this extension individually on different machines'
        );
        box.append(enabledCheckbox);

        var enableForFramesCheckbox = PrefMaker.makeBooleanCheckbox('enableForFrames',
            'Enable in embedded maps',
            'Scroll in Google Maps embedded in third-party web pages'
        );
        box.append(enableForFramesCheckbox);

        var scrollSpeedSlider = PrefMaker.makeSlider('scrollSpeed', 'Scrolling speed', 100, 5, 5);
        box.append(scrollSpeedSlider);

        var zoomSpeedSlider = PrefMaker.makeSlider('zoomSpeed', 'Zoom speed', 500, 10, 10);
        box.append(zoomSpeedSlider);

        var invertScrollCheckbox = PrefMaker.makeBooleanCheckbox('invertScroll',
            'Invert Scroll',
            'Use the opposite direction as you do in your system preferences'
        );
        box.append(invertScrollCheckbox);

        var invertZoomDescription = window.safari ?
            'Invert the direction for zooming' :
            'Recommended for "natural" scrolling direction users';
        var invertZoomCheckbox = PrefMaker.makeBooleanCheckbox(
            'invertZoom',
            'Invert Zoom',
            invertZoomDescription
        );
        box.append(invertZoomCheckbox);

        var frameRequireFocusCheckbox = PrefMaker.makeBooleanCheckbox(
            'frameRequireFocus',
            'Require click to scroll embedded maps',
            'Prioritize page scrolling until embedded map is clicked'
        );
        box.append(frameRequireFocusCheckbox);

        var isolateZoomScrollCheckbox = PrefMaker.makeBooleanCheckbox(
            'isolateZoomScroll',
            'Detect Finger Lift',
            'To isolate scrolling gestures from zooming'
        );
        box.append(isolateZoomScrollCheckbox);

        box.append('<div id="zoomhint">Pinch to zoom in or out</div>');
    };

    $(function(){
        Options.createOptions();
    });
})();
