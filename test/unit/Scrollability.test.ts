import { describe, it, expect, beforeEach } from 'vitest';
import Scrollability from "../../src/Scrollability";

describe('Scrollability tests', () => {

    it('isScrollable null element', () => {
        expect(Scrollability.isScrollable(null)).toBe(false);
    });

    it('isScrollable elem', () => {
        const elem = document.createElement('div');
        expect(Scrollability.isScrollable(elem)).toBe(false);
    });

    let elem: HTMLDivElement;
    let child: HTMLDivElement;

    beforeEach(() => {
        elem = document.createElement('div');
        elem.style.overflow = 'scroll';
        elem.style.width = '50px';
        elem.style.height = '50px';
        child = document.createElement('div');
        child.style.width = '100px';
        child.style.height = '100px';
        document.body.appendChild(elem);
        elem.appendChild(child);
    });

    it('isScrollable elem', () => {
        expect(Scrollability.isScrollable(elem)).toBe(true);
        expect(Scrollability.isScrollable(child)).toBe(false);
    });

    it('hasScrollableParent', () => {
        expect(Scrollability.hasScrollableParent(elem)).toBe(true);
        expect(Scrollability.hasScrollableParent(child)).toBe(true);
        expect(Scrollability.hasScrollableParent(document.documentElement)).toBe(false);
    });

    it('hasScrollableParent fixed position', () => {
        child.style.position = 'fixed';
        expect(Scrollability.hasScrollableParent(child)).toBe(false);
    });
});
