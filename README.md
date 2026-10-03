# ScrollMaps
Lets you scroll with two fingers on your trackpad within online maps

- [Chrome web store link](https://chrome.google.com/webstore/detail/scrollmaps/jifommjndpnefcfplgnbhabocomgdjjg)
- [Firefox Add-ons store link](https://addons.mozilla.org/en-US/firefox/addon/scrollmaps)
- [Microsoft Edge addon link](https://microsoftedge.microsoft.com/addons/detail/scrollmaps/mdhhlgkmnlaiofbbemcmigjleiiefmga)

## Supported map providers

- Google Maps
- MapBox
- Esri ArcGIS
- Apple MapKit JS
- OpenStreetMap
- and a few others

## Building

After checking out the source, initialize the dependencies using `npm install`.

After making changes, build a development version using `npm run build:<chrome|firefox|edge>` (e.g. `npm run build:chrome`). This will create an unpacked extension under `gen/plugin-10000-<browser>` that can then be loaded into Chrome as an unpacked extension. Alternatively, run `npm run build` to build for all browsers.

You can also use `npm run watch` to watch for changes and build new dev versions automatically.

To build the current release version for all browsers, use `npm run release`.

## Unit testing

Unit tests can be run using `npm test` (or `npm run test:unit`).

Watch mode can be started with `npm run test:watch`.

A filter can be applied using Vitest arguments, for example: `npx vitest -t 'Scrollability'`.

## Integration Testing

Integration tests can be run using `npm run test:auto`.

Individual tests can be run using `mocha` directly:

```sh
BROWSER=chrome npx mocha test/auto/google_com_travel.mjs
```
