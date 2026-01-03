import Scrollability from "../../src/Scrollability"
import { sleep } from "../../src/utils";

describe('Scrollability tests', () => {

    it('isScrollable null element', () => {
        expect(Scrollability.isScrollable(null)).toBeFalse();
    });

    it('isScrollable elem', () => {
        const elem = document.createElement('div');
        expect(Scrollability.isScrollable(elem)).toBeFalse();
    });

    let elem: HTMLDivElement;
    let child: HTMLDivElement;

    beforeEach(() => {
        elem = document.createElement('div');
        elem.style.overflow = 'scroll';
        elem.style.width = '50px';
        elem.style.height = '50px';
        child = document.createElement('div')
        child.style.width = '100px';
        child.style.height = '100px';
        document.body.appendChild(elem)
        elem.appendChild(child)
    })

    it('isScrollable elem', () => {
        expect(Scrollability.isScrollable(elem)).toBeTrue();
        expect(Scrollability.isScrollable(child)).toBeFalse();
    });

    it('hasScrollableParent', () => {
        expect(Scrollability.hasScrollableParent(elem)).withContext("elem").toBeTrue();
        expect(Scrollability.hasScrollableParent(child)).withContext("child").toBeTrue();
        expect(Scrollability.hasScrollableParent(document.documentElement)).withContext("document").toBeFalse();
    });

    it('hasScrollableParent fixed position', () => {
        child.style.position = 'fixed';
        expect(Scrollability.hasScrollableParent(child)).toBeFalse();
    });
});