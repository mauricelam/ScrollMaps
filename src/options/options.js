document.addEventListener('DOMContentLoaded', () => {
    const box = document.getElementById('checkboxes');

    const enabledCheckbox = PrefMaker.makeBooleanCheckbox(
        'enabled',
        'Activate automatically',
        {
            true: 'Activate automatically on sites you have already granted permissions',
            false: 'Click on the extension icon to activate ScrollMaps manually'
        }
    );
    box.appendChild(enabledCheckbox);

    const scrollSpeedSlider = PrefMaker.makeSlider('scrollSpeed', 'Scrolling speed', 500, 10, 10);
    box.appendChild(scrollSpeedSlider);

    const zoomSpeedSlider = PrefMaker.makeSlider('zoomSpeed', 'Zoom speed', 500, 10, 10);
    box.appendChild(zoomSpeedSlider);

    const invertScrollCheckbox = PrefMaker.makeBooleanCheckbox('invertScroll',
        'Invert Scroll',
        'Use the opposite direction as you do in your system preferences'
    );
    box.appendChild(invertScrollCheckbox);

    const invertZoomDescription = 'Invert the direction for zooming';
    const invertZoomCheckbox = PrefMaker.makeBooleanCheckbox(
        'invertZoom',
        'Invert Zoom',
        invertZoomDescription
    );
    box.appendChild(invertZoomCheckbox);

    const frameRequireFocusCheckbox = PrefMaker.makeBooleanCheckbox(
        'frameRequireFocus',
        'Require click to scroll embedded maps',
        'Prioritize page scrolling until embedded map is clicked'
    );
    box.appendChild(frameRequireFocusCheckbox);

    const allowAccessToAllSites = PrefMaker.makePermissionCheckbox(
        'allowAccessToAllSites',
        '<all_urls>',
        'Allow ScrollMaps on all sites',
        {
            true: 'ScrollMaps will enable on embedded Google Maps automatically',
            false: 'Click on the extension icon to activate ScrollMaps manually'
        }
    );
    box.appendChild(allowAccessToAllSites);

    const zoomHint = document.createElement('div');
    zoomHint.id = "zoomhint";
    zoomHint.innerText = "Pinch to zoom in or out";
    box.appendChild(zoomHint);
}, false);
