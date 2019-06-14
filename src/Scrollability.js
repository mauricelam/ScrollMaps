/*global Scrollability */

var Scrollability = {};

// Whether an element is scrollable
Scrollability.isScrollable = function (element) {
    if (!element || !element.ownerDocument) return false;
    if (element.scrollHeight <= element.clientHeight) return false;
    // if (element.clientHeight === 0 || element.clientWidth === 0) return false;
 
    var overflow = window.getComputedStyle(element).getPropertyValue('overflow');
    if (overflow === 'hidden') return false;
    // Body and document element will scroll even if overflow is visible
    if (element === document.body || element === document.documentElement) return true;
    return overflow !== 'visible';
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
    var ancestorScrollable = false;  // Scrollability of parent documents of this frame

    var updateScrollability = function () {
        // Maybe not all cases need to calculate hasScrollableParent?
        var newOverallScrollable = ancestorScrollable || Scrollability.hasScrollableParent(element);
        if (overallScrollable !== newOverallScrollable) {
            overallScrollable = newOverallScrollable;
            callback(newOverallScrollable);
        }
    };

    if (window !== window.parent) {
        let parentScrollabilityBackoff = 500;
        let parentResultReceived = false;

        let askParentFrameForScrollability = () => {
            if (parentResultReceived || parentScrollabilityBackoff >= 10000) {
                return;
            }
            parentScrollabilityBackoff *= 2;
            // Register cross-iframe scroll monitoring
            window.parent.postMessage({'action': 'monitorScroll'}, '*');
            window.setTimeout(askParentFrameForScrollability, parentScrollabilityBackoff);
        }

        askParentFrameForScrollability();

        window.addEventListener('message', function (message) {
            parentResultReceived = true;
            if (message.data.action === 'pageNeedsScrolling') {
                ancestorScrollable = Boolean(message.data.value);
                updateScrollability();
            }
        });
    } else {
        ancestorScrollable = false;
        updateScrollability();
    }

    Scrollability._monitorPotentialScrollabilityChange(element, updateScrollability);
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

window.addEventListener('message', function(message) {
    if (message.data.action === 'monitorScroll') {
        var iframe = getIframeForWindow(message.source);

        if (!iframe) {
            console.warn('No matching iframe for message', message);
            return;
        }

        Scrollability.monitorScrollabilitySuper(iframe, function (scrollable) {
            message.source.postMessage({'action': 'pageNeedsScrolling', 'value': scrollable}, '*');
        });
    }
});
