# ScrollMaps
Lets you scroll with two fingers on your trackpad within Google Maps

- [Chrome web store link](https://chrome.google.com/webstore/detail/scrollmaps/jifommjndpnefcfplgnbhabocomgdjjg)
- [Firefox Add-ons store link](https://addons.mozilla.org/en-US/firefox/addon/scrollmaps)
- [Microsoft Edge addon link](https://microsoftedge.microsoft.com/addons/detail/scrollmaps/mdhhlgkmnlaiofbbemcmigjleiiefmga)

## Building

After checking out the source, initialize the dependencies using `npm install`.

After making changes, build a development version using `gulp --<chrome/firefox/edge>`. This will create an unpacked extension under `gen/plugin-10000-<browser>` that can then be loaded into Chrome as an unpacked extension.

You can also use `gulp watch --<chrome/firefox/edge>` to watch for changes and build new dev versions automatically.

To build the current release version for all browsers, use `gulp release`.

## Unit testing

Unit tests can be run using `gulp unit` or `gulp watchunit`.

## Integration Testing

Tests can be run using `gulp test --<chrome/firefox/edge>`.

Individual test fails can be run using `mocha` directly:

```sh
BROWSER=chrome npx mocha test/auto/google_com_travel.js
```

# TODO:
- "Allow on this site" is wrong for Google domains
- Update injectScript to use chrome.scripting.executeScript with MAIN world