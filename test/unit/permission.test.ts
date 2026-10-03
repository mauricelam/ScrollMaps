import { describe, it, expect } from 'vitest';
import Permission from "../../src/permission";

describe('Permission tests', function() {

    const isMapsSite_trueTests = [
        'https://www.google.com/maps',
        'https://www.google.com/maps/place/1600+Amphitheatre+Pkwy,+Mountain+View,+CA+94043/',
        'http://www.google.com/maps',
        'https://www.google.com.hk/maps',
        'https://www.google.co.uk/maps',
        'https://maps.google.com/',
    ];
    for (const site of isMapsSite_trueTests) {
        it(`isMapsSite ${site}`, () => {
            expect(Permission.isMapsSite(site)).toBe(true);
        });
    }

    const isMapsSite_falseTests = [
        'https://www.apple.com/',
        'https://www.google.com.example.com/',
        'https://maps.google.com.example.com/',
        'https://www.google.com/travel',
    ];
    for (const site of isMapsSite_falseTests) {
        it(`isMapsSite ${site}`, () => {
            expect(Permission.isMapsSite(site)).toBe(false);
        });
    }

    (window as any).chrome = { runtime: { id: 'jifommjndpnefcfplgnbhabocomgdjjg' } };
    it('isOwnExtensionPage options page', () => {
        expect(Permission.isOwnExtensionPage(
            'chrome-extension://jifommjndpnefcfplgnbhabocomgdjjg/src/options/options.html',
        )).toBe(true);
    });

    const isOwnExtensionPage_falseTests = [
        'chrome-extension://gighmmpiobklfepjocnamgkkbiglidom/options.html#general',  // AdBlock options
        'chrome://newtab',
        'chrome://version',
    ];
    for (const site of isOwnExtensionPage_falseTests) {
        it(`isOwnExtensionPage ${site}`, () => {
            expect(Permission.isOwnExtensionPage(site)).toBe(false);
        });
    }
});
