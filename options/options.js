var Options = {};

(function(){
    var m = Options;

    m.createOptions = function(){
        var box = $("#checkboxes");

        var enabledCheckbox = PrefMaker.makeBooleanCheckbox("enabled", "Enable on this computer", "Enable this extension individually on different machines");
        box.append(enabledCheckbox);

        var enableForFramesCheckbox = PrefMaker.makeBooleanCheckbox("enableForFrames", "Enable in embedded maps", "Scroll in Google Maps embedded in third-party web pages");
        box.append(enableForFramesCheckbox);

        var slider = PrefMaker.makeSlider("scrollSpeed", "Scrolling speed", 100, 1);
        box.append(slider);

        var invertScrollCheckbox = PrefMaker.makeBooleanCheckbox("invertScroll", "Invert Scroll", "Use the opposite scrolling direction as you do in your system preferences");
        box.append(invertScrollCheckbox);

        var invertZoomCheckbox = PrefMaker.makeBooleanCheckbox("invertZoom", "Invert Zoom", "Pull fingers down to zoom in instead");
        box.append(invertZoomCheckbox);

        var frameRequireFocusCheckbox = PrefMaker.makeBooleanCheckbox("frameRequireFocus", "Embedded maps require activation", "Disable maps scrolling by default until map is clicked");
        box.append(frameRequireFocusCheckbox);

        var isolateZoomScrollCheckbox = PrefMaker.makeBooleanCheckbox("isolateZoomScroll", "Detect Finger Lift", "To isolate scrolling gestures from zooming");
        box.append(isolateZoomScrollCheckbox);

        box.append('<div id="zoomhint">Cmd-scroll to zoom</div>');
    }

    $(function(){
        m.createOptions();
    });
})();
