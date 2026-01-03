import { DEBUG } from "./utils";

const Scrollability = {
  // Whether an element is scrollable
  isScrollable(element: Element | null): boolean {
    if (!element || !element.ownerDocument) return false;
    if (element.scrollHeight <= element.clientHeight) return false;
    // if (element.clientHeight === 0 || element.clientWidth === 0) return false;

    const overflow = window.getComputedStyle(element).getPropertyValue('overflow');
    if (overflow === 'hidden') return false;
    // Body and document element will scroll even if overflow is visible
    if (element === document.body || element === document.documentElement) return true;
    return overflow !== 'visible';
  },

  // hasScrollableParent(elem)  ==>  whether anything, including window scrolls
  // hasScrollableParent(elem, until) ==> whether any parent up to "until" scrolls
  hasScrollableParent(element: Element, until?: Node): boolean {
    // This short-circuiting fails if there is an element in between that has position:fixed
    // if (until === undefined && Scrollability.isWindowScrollable()) return true;
    return Scrollability._hasScrollableParentInner(element, until);
  },

  _hasScrollableParentInner(element: Element, until?: Node): boolean {
    if (element instanceof DocumentFragment) {
      return this._hasScrollableParentInner(element.getRootNode()['host'], until);
    }

    if (this.isScrollable(element)) return true;
    if (!element || !element.parentNode) return false;
    if (getComputedStyle(element).position === 'fixed') return false;
    if (until && (element === until || element.isSameNode(until))) return false;
    return this._hasScrollableParentInner(element.parentNode, until);
  },

  isWindowScrollable(): boolean {
    let hasContentBelowFold = outerHeight(document.documentElement) +
      document.documentElement.offsetTop > window.innerHeight;
    hasContentBelowFold ||= outerHeight(document.body) +
      document.body.offsetTop > window.innerHeight;
    const bodyStyle = window.getComputedStyle(document.body);
    const documentStyle = window.getComputedStyle(document.documentElement);
    return hasContentBelowFold &&
      bodyStyle['overflow'] !== 'hidden' &&
      documentStyle['overflow'] !== 'hidden';

    function outerHeight(el: HTMLElement): number {
      const styles = window.getComputedStyle(el);
      const margin = parseFloat(styles['marginTop']) + parseFloat(styles['marginBottom']);
      return Math.ceil(el.offsetHeight + margin);
    }
  },

  _monitorPotentialScrollabilityChange(_element: Element, callback: () => void) {
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
  },

  // Monitor parent scrollability for given element across iframes
  monitorScrollabilitySuper(element: Element, callback: (scrolls: boolean) => void) {
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
        window.parent.postMessage({ 'action': 'monitorScroll' }, '*');
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
  }
}

if ((window as any).Scrollability === undefined) {
  (window as any).Scrollability = Scrollability;

  function getIframeForWindow(win: MessageEventSource): HTMLIFrameElement | undefined {
    for (const iframe of document.getElementsByTagName('iframe')) {
      if (iframe.contentWindow === win) {
        return iframe;
      }
    }
  }

  // Init

  window.addEventListener('message', function (message) {
    if (message.data.action === 'monitorScroll') {
      const iframe = getIframeForWindow(message.source);
      if (!iframe) {
        console.warn('No matching iframe for message', message);
        return;
      }

      Scrollability.monitorScrollabilitySuper(iframe, function (scrollable) {
        message.source.postMessage({ 'action': 'pageNeedsScrolling', 'value': scrollable }, { targetOrigin: '*' });
      });
    }
  });
}

export default Scrollability;
