# Safari Packaging

ScrollMaps can produce a Safari Web Extension source package from the same TypeScript and Manifest V3 files used for Chrome, Firefox, and Edge.

## Build the Safari WebExtension assets

```sh
npm install
npx gulp --safari
```

This writes:

- `gen/plugin-10000-safari/` for local Safari packaging.
- `gen/scrollmaps-10000-safari.zip` for upload/packaging workflows that accept a ZIP.

## Package and test on macOS

Apple packages Safari Web Extensions through Xcode or App Store Connect. On a Mac with current Xcode command line tools, package the generated extension directory:

```sh
xcrun safari-web-extension-packager gen/plugin-10000-safari --project-location gen/safari-package
```

Then open the generated Xcode project, select the macOS app target, choose a signing team, run the app, and enable ScrollMaps in Safari's Extensions settings.

Apple's current documentation:

- [Packaging a web extension for Safari](https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari)
- [Packaging and distributing Safari Web Extensions with App Store Connect](https://developer.apple.com/documentation/safariservices/packaging-and-distributing-safari-web-extensions-with-app-store-connect)

If the packager reports unsupported manifest keys or API usage, treat that output as the source of truth and adjust `manifest_chrome_template.json` or the affected extension code before submitting to App Store Connect.

## Validation limits

The `--safari` build proves that ScrollMaps can generate Safari WebExtension source assets and a ZIP from this repository. Final validation still requires macOS, Safari, Xcode signing, and App Store Connect packaging because those tools are platform-gated by Apple.
