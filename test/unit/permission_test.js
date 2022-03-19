const assert = chai.assert;

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
            assert.isTrue(Permission.isMapsSite(site));
        })
    }

    const isMapsSite_falseTests = [
        'https://www.apple.com/',
        'https://www.google.com.example.com/',
        'https://maps.google.com.example.com/',
        'https://www.google.com/travel',
    ];
    for (const site of isMapsSite_falseTests) {
        it(`isMapsSite ${site}`, () => {
            assert.isFalse(Permission.isMapsSite(site));
        });
    }

    /* global */ chrome = { runtime: { id: 'jifommjndpnefcfplgnbhabocomgdjjg' } };
    it('isOwnExtensionPage options page', () => {
        assert.isTrue(Permission.isOwnExtensionPage(
            'chrome-extension://jifommjndpnefcfplgnbhabocomgdjjg/src/options/options.html',
        ))
    });

    const isOwnExtensionPage_falseTests = [
        'chrome-extension://gighmmpiobklfepjocnamgkkbiglidom/options.html#general',  // AdBlock options
        'chrome://newtab',
        'chrome://version',
    ];
    for (const site of isOwnExtensionPage_falseTests) {
        it(`isOwnExtensionPage ${site}`, () => {
            assert.isFalse(Permission.isOwnExtensionPage(site));
        });
    }

    const isRequiredPermission_trueTests = [
        'https://www.google.com/maps',
        'https://www.google.com/maps/place/1600+Amphitheatre+Pkwy,+Mountain+View,+CA+94043/',
        'http://www.google.com/maps',
        'https://www.google.com.hk/maps',
        'https://www.google.co.uk/maps',
        'https://maps.google.com/',
        // /travel is not a maps site, but we get the permission because it's under google.com domain
        'https://www.google.com/travel',
    ];
    for (const site of isRequiredPermission_trueTests) {
        it(`isRequiredPermission ${site}`, () => {
            assert.isTrue(Permission.isRequiredPermission(site));
        })
    }

    const isRequiredPermission_falseTests = [
        'https://www.apple.com/',
        'https://www.google.com.example.com/',
        'https://maps.google.com.example.com/',
    ];
    for (const site of isRequiredPermission_falseTests) {
        it(`isRequiredPermission ${site}`, () => {
            assert.isFalse(Permission.isRequiredPermission(site));
        });
    }
});
