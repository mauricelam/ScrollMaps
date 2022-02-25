# ScrollMaps
Lets you scroll with two fingers on your trackpad within Google Maps

- [Chrome web store link](https://chrome.google.com/webstore/detail/scrollmaps/jifommjndpnefcfplgnbhabocomgdjjg)
- [Firefox Add-ons store link](https://addons.mozilla.org/en-US/firefox/addon/scrollmaps)
- [Microsoft Edge addon link](https://microsoftedge.microsoft.com/addons/detail/scrollmaps/mdhhlgkmnlaiofbbemcmigjleiiefmga)

## Building

After checking out the source, initialize the dependencies using `npm install`.

After making changes, build a development version using `grunt dev`. This will create an unpacked extension under `gen/plugin-10000` that can then be loaded into Chrome as an unpacked extension.

You can also use `grunt watch` to watch for changes and build new dev versions automatically.

To build the current release version, use `grunt release`.

## Testing

Tests can be run using `grunt test:<browser>:<suite>`, where `browser` can be either `chrome` or `firefox`, and `suite` can be
`auto`, `semimanual`, or `manual`.

Individual test fails can be run using `mocha` directly:

```sh
BROWSER=chrome ./node_modules/mocha/bin/mocha test/auto/google_com_travel.js
```
