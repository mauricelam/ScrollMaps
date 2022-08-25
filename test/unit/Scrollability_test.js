describe('Scrollability tests', function() {

    it('isScrollable null element', () => {
        assert.isFalse(Scrollability.isScrollable(null));
    });

    it('isScrollable elem', () => {
        const elem = document.createElement('div');
        assert.isFalse(Scrollability.isScrollable(elem));
    });

    const elem = document.createElement('div');
    elem.style.overflow = 'scroll';
    elem.style.width = '50px';
    elem.style.height = '50px';
    const child = document.createElement('div')
    child.style.width = '100px';
    child.style.height = '100px';
    document.body.appendChild(elem)
    elem.appendChild(child)

    it('isScrollable elem', () => {
        assert.isTrue(Scrollability.isScrollable(elem));
        assert.isFalse(Scrollability.isScrollable(child));
    });

    it('hasScrollableParent', () => {
        assert.isTrue(Scrollability.hasScrollableParent(elem));
        assert.isTrue(Scrollability.hasScrollableParent(child));
        assert.isFalse(Scrollability.hasScrollableParent(document.documentElement));
    });

    it('hasScrollableParent fixed position', () => {
        child.style.position = 'fixed';
        assert.isFalse(Scrollability.hasScrollableParent(child));
    });
});