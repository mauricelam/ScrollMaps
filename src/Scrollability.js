if (window.Scrollability === undefined) {
    const DEBUG = chrome.runtime.getManifest().version === '10000';
    window.Scrollability = {};

    // Whether an element is scrollable
    Scrollability.isScrollable = function (element) {
        if (!element || !element.ownerDocument) return false;
        if (element.scrollHeight <= element.clientHeight) return false;
        // if (element.clientHeight === 0 || element.clientWidth === 0) return false;

        const overflow = window.getComputedStyle(element).getPropertyValue('overflow');
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
        let hasContentBelowFold = outerHeight(document.documentElement) +
                document.documentElement.offsetTop > window.innerHeight;
        hasContentBelowFold |= outerHeight(document.body) +
                document.body.offsetTop > window.innerHeight;
        const bodyStyle = window.getComputedStyle(document.body);
        const documentStyle = window.getComputedStyle(document.documentElement);
        return hasContentBelowFold && bodyStyle['overflow'] !== 'hidden' &&
                documentStyle['overflow'] !== 'hidden';
    };

    function outerHeight(el) {
        const styles = window.getComputedStyle(el);
        const margin = parseFloat(styles['marginTop']) + parseFloat(styles['marginBottom']);
        return Math.ceil(el.offsetHeight + margin);
    }

    Scrollability._monitorPotentialScrollabilityChange = function (element, callback) {
        if (DEBUG) {
            window.addEventListener('keydown', function (e) {
                if (e.keyCode === 192) {  // `
                    console.log('force refreshing scrollability');
                    callback();
                }
            });
        }

        window.addEventListener('resize', callback);
        document.addEventListener('load', callback);
    };

    // Monitor parent scrollability for given element across iframes
    Scrollability.monitorScrollabilitySuper = function (element, callback) {
        let overallScrollable = null;
        let ancestorScrollable = false;  // Scrollability of parent documents of this frame

        const updateScrollability = () => {
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

            window.addEventListener('message', (message) => {
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
        for (const iframe of document.getElementsByTagName('iframe')) {
            if (iframe.contentWindow === win) {
                return iframe;
            }
        }
    }


    // Init

    window.addEventListener('message', function(message) {
        if (message.data.action === 'monitorScroll') {
            const iframe = getIframeForWindow(message.source);
            if (!iframe) {
                console.warn('No matching iframe for message', message);
                return;
            }

            Scrollability.monitorScrollabilitySuper(iframe, function (scrollable) {
                message.source.postMessage({'action': 'pageNeedsScrolling', 'value': scrollable}, '*');
            });
        }
    });
}
