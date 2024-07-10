if (window.SM_INJECT_MAIN === undefined) {
    window.SM_INJECT_MAIN = true;

    const origSetPointerCapture = Element.prototype.setPointerCapture;
    Element.prototype.setPointerCapture = function (pointerId) {
        if (pointerId !== 10088) {
            origSetPointerCapture.apply(this, arguments);
        }
    };

    const origReleasePointerCapture = Element.prototype.releasePointerCapture;
    Element.prototype.releasePointerCapture = function (pointerId) {
        if (pointerId !== 10088) {
            origReleasePointerCapture.apply(this, arguments);
        }
    };
}
