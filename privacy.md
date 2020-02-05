# Privacy Policy

As required by [Chrome webstore's policy](https://developer.chrome.com/webstore/user_data), this is a policy about how this extension handles user data. This is intended to make it easier for regular users to better understand how the data is handled; for complete understanding, look into the source code for details.

## Data sharing and transmission

All of ScrollMaps runs inside your browser and it does not send data to outside of the extension. The only external components ScrollMaps interacts with is the Chrome browser, the page you are using ScrollMaps on, and Google Maps.

## Data collection and handling

ScrollMaps functions by listening to scroll events on any Google Maps canvases and injecting a corresponding event to simulate panning the map. In order to get the available Google Maps canvases on a given page, ScrollMaps looks through the content on a web page and identifies potential map tiles that are provided by Google Maps. Additionally, ScrollMaps also listens to whether the page is making any web requests to use Google Maps APIs, in order to determine whether the developer is using the maps canvas. To determine that, ScrollMaps makes use of the URLs of the tab making the request and matches that against the tabs that you currently have open. These URLs are requested from Chrome and is never shared outside of the ScrollMaps browser extension, and are not stored persistently.
