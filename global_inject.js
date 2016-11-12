/*global $ Message ScrollableMap */

var SM = SM || { count: 0 };

SM.updateBodyScrolls = function () {
    var bodyScrolls = Scrollability.isScrollable(document.body);
    if (SM.bodyScrolls !== bodyScrolls) {
        SM.bodyScrolls = bodyScrolls;
        // Message.extension.sendMessage('setBodyScrolls', { scrolls: bodyScrolls });
    }
};

SM.injectScript = function(host, src) {
    var script = document.createElement('script');
    script.setAttribute('id', '..scrollmaps_inject');
    script.src = Extension.getURL(src);
    host.insertBefore(script, host.firstChild);
};



var Scrollability = {};

// Whether an element is scrollable
Scrollability.isScrollable = function (element) {
    if (!element || !element.ownerDocument) return false;
    if (element.scrollHeight <= element.clientHeight) return false;
    // if (element.clientHeight === 0 || element.clientWidth === 0) return false;
 
    var overflow = window.getComputedStyle(element).getPropertyValue('overflow');
    return overflow !== 'hidden' && overflow !== 'visible';
};

// hasScrollableParent(elem)  ==>  whether anything, including window scrolls
// hasScrollableParent(elem, until) ==> whether any parent up to "until" scrolls
Scrollability.hasScrollableParent = function (element, until) {
    if (until === undefined && Scrollability.isWindowScrollable()) return true;
    return Scrollability._hasScrollableParentInner(element, until);
};

Scrollability._hasScrollableParentInner = function (element, until) {
    if (Scrollability.isScrollable(element)) return true;
    if (!element || !element.parentNode) return false;
    if (until && (element === until || element.isSameNode(until))) return false;
    return Scrollability._hasScrollableParentInner(element.parentNode, until);
};

Scrollability.isWindowScrollable = function () {
    var hasContentBelowFold = $(document.documentElement).outerHeight(true /* includeMargin */) +
            $(document.documentElement).position().top > $(window).height();
    hasContentBelowFold |= $(document.body).outerHeight(true /* includeMargin */) +
            $(document.body).position().top > $(window).height();
    return hasContentBelowFold && $(document.body).css('overflow') !== 'hidden' &&
            $(document.documentElement).css('overflow') !== 'hidden';
};

Scrollability._monitorPotentialScrollabilityChange = function (element, callback) {
    window.addEventListener('keydown', function (e) {
        if (e.keyCode === 192) {  // `
            console.log('force refreshing scrollability');
            callback();
        }
    });

    window.addEventListener('resize', callback);
    document.addEventListener('load', callback);
};

// Monitor parent scrollability for given element across iframes
Scrollability.monitorScrollabilitySuper = function (element, callback) {
    var overallScrollable = null;
    var ancestorScrollable = false;

    var updateScrollability = function (_ancestor) {
        // Maybe not all cases need to calculate hasScrollableParent?
        var newOverallScrollable = _ancestor || Scrollability.hasScrollableParent(element);
        if (overallScrollable !== newOverallScrollable) {
            overallScrollable = newOverallScrollable;
            callback(newOverallScrollable);
        }
    };
    var updateScrollabilityNoAncestorChange = function () {
        updateScrollability(ancestorScrollable);
    };

    if (window !== window.parent) {
        // Register cross-iframe scroll monitoring
        window.parent.postMessage({'action': 'monitorScroll'}, '*');

        window.addEventListener('message', function (message) {
            if (message.data.action === 'pageNeedsScrolling') {
                updateScrollability(Boolean(message.data.value));
            }
        });
    } else {
        updateScrollability(false);
    }

    Scrollability._monitorPotentialScrollabilityChange(element, updateScrollabilityNoAncestorChange);
};

function getIframeForWindow(win) {
    var iframes = document.getElementsByTagName('iframe');

    for (var i = 0; i < iframes.length; i++) {
        if (iframes[i].contentWindow === win) {
            return iframes[i];
        }
    }
}


// Init


if (document.URL.split('.').pop(0).toLowerCase() != 'pdf') {
    SM.injectScript(document.documentElement, 'inject_content.js');

    window.addEventListener('mapsFound', function (event) {
        var map = event.target;
        new ScrollableMap(map, ScrollableMap.TYPE_API, SM.count++);
    }, false);

    window.addEventListener('message', function(message) {
        if (message.data.action === 'monitorScroll') {
            var iframe = getIframeForWindow(message.source);

            if (!iframe) {
                console.warn('No matching iframe for message', message);
                return;
            }

            Scrollability.monitorScrollabilitySuper(iframe, function (scrollable) {
                if (scrollable) {
                    message.source.postMessage({'action': 'pageNeedsScrolling', 'value': true}, '*');
                } else {
                    message.source.postMessage({'action': 'pageNeedsScrolling', 'value': false}, '*');
                }
            });
        }
    });

} else {
    // Don't run on PDF files. There seems to be a conflict between the built-in Chrome PDF plugin
    // and how the script tag is injected.
    console.log('ScrollMaps: Skipping PDF file');
}
