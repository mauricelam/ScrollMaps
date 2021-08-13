var Options = {};

(function(){

    Options.createOptions = function(){
        var box = $('#checkboxes');

        var enabledCheckbox = PrefMaker.makeBooleanCheckbox(
            'enabled',
            'Activate automatically',
            'Activate automatically on sites you have already granted permissions'
        );
        box.append(enabledCheckbox);

        var scrollSpeedSlider = PrefMaker.makeSlider('scrollSpeed', 'Scrolling speed', 500, 10, 10);
        box.append(scrollSpeedSlider);

        var zoomSpeedSlider = PrefMaker.makeSlider('zoomSpeed', 'Zoom speed', 500, 10, 10);
        box.append(zoomSpeedSlider);

        var invertScrollCheckbox = PrefMaker.makeBooleanCheckbox('invertScroll',
            'Invert Scroll',
            'Use the opposite direction as you do in your system preferences'
        );
        box.append(invertScrollCheckbox);

        var invertZoomDescription = 'Invert the direction for zooming';
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

        var allowAccessToAllSites = PrefMaker.makePermissionCheckbox(
            'allowAccessToAllSites',
            '<all_urls>',
            'Allow ScrollMaps on all sites',
            'Any sites that embed Google Maps will enable scrolling automatically'
        );
        box.append(allowAccessToAllSites);

        box.append('<div id="zoomhint">Pinch to zoom in or out</div>');
    };

    $(function(){
        Options.createOptions();
    });
})();
