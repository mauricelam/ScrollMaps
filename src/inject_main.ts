// Code injected into the "MAIN" execution world. (See chrome.scripting.ExecutionWorld)

if ((window as any).SM_INJECT_MAIN === undefined) {
    (window as any).SM_INJECT_MAIN = true;

    const origSetPointerCapture = Element.prototype.setPointerCapture;
    Element.prototype.setPointerCapture = function (pointerId) {
        if (pointerId !== 10088) {
            origSetPointerCapture.apply(this, arguments as any);
        }
    };

    const origReleasePointerCapture = Element.prototype.releasePointerCapture;
    Element.prototype.releasePointerCapture = function (pointerId) {
        if (pointerId !== 10088) {
            origReleasePointerCapture.apply(this, arguments as any);
        }
    };
}
