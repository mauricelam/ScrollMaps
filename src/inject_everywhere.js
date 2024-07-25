if (window.SM_INJECT === undefined) {
    const DEBUG = chrome.runtime.getManifest().version === '10000';
    window.SM_INJECT = { count: 0 };

    class AbstractMapFinder {
        static _matchAncestor(node, predicate) {
            if (predicate(node)) {
                return node;
            }
            if (node.parentNode instanceof Element && node.parentNode !== node) {
                return this._matchAncestor(node.parentNode, predicate);
            }
            return null;
        }

        static _querySrc(container, tag, possible_substrings) {
            for (let elem of container.querySelectorAll(tag)) {
                for (let substring of possible_substrings) {
                    if (elem.src.indexOf(substring) !== -1) {
                        return true;
                    }
                }
            }
            return false;
        }

        static _findTiledMap(selector, filter) {
            let foundImages = Array.from(
                document.querySelectorAll(selector));
            // To handle multiple maps on the same page, we make the threshold
            // number of images / 4. We consider the common ancestor to be found below
            // that threshold.
            let foundThreshold = Math.max(foundImages.length / 4, 1);
            for (let i = 0; i < 5; i++) {
                // Walk maximum 5 levels to find the common ancestor
                foundImages = foundImages.map(img => img.parentNode);
                const foundSet = new Set(foundImages);
                if (foundSet.size <= foundThreshold) {
                    return Array.from(foundSet)
                        .map(container => this._matchAncestor(container,
                            node => isVisible(node)
                                && node.offsetHeight > 1
                                && node.offsetWidth > 1
                                && (filter === undefined || filter(node))
                        ))
                        .filter(n => n);
                }
            }
            return [];

            function isVisible(node) {
                return window.getComputedStyle(node).display !== "none";
            }
        }
    }

    class GoogleMapFinder extends AbstractMapFinder {
        static _findGmStyleMap() {
            return Array.from(document.querySelectorAll('.gm-style:has(img)'))
                .filter(container =>
                    this._querySrc(container, 'img',
                        [
                            '//maps.googleapis.com/maps/',
                            '//www.google.com/maps/',
                            '//maps.google.com/maps/'
                        ])
                )
                .map(container => container.parentNode);
        }

        static _findCanvasMap() {
            return Array.from(document.querySelectorAll('.gm-style:has(canvas)'))
                .map(container => container.parentNode);
        }

        static _findFallbackMap() {
            return GoogleMapFinder._findTiledMap('img[src*="//maps.googleapis.com/maps/"]');
        }

        static findMaps() {
            let mapContainers = GoogleMapFinder._findCanvasMap();
            if (mapContainers.length > 0) {
                return mapContainers;
            }

            mapContainers = GoogleMapFinder._findGmStyleMap();
            if (mapContainers.length > 0) {
                return mapContainers;
            }

            mapContainers = GoogleMapFinder._findFallbackMap();
            return mapContainers;
        }
    }

    // https://developers.arcgis.com/javascript/latest/
    class ArcGisFinder extends AbstractMapFinder {
        static findMaps() {
            return [
                ...document.querySelectorAll('.esri-view:has(.esri-view-surface > canvas)'),
                ...ArcGisFinder._findTiledMap(
                    'img[src*=".arcgisonline.com/"]',
                    (node) => node.getAttribute("id") == "map_layers")
            ];
        }
    }

    // https://docs.mapbox.com/
    class MapBoxFinder extends AbstractMapFinder {
        static findMaps() {
            return [
                ...document.querySelectorAll('.mapboxgl-map:has(canvas.mapboxgl-canvas)'),
            ]
                .map((elem) => elem.closest('.leaflet-container') || elem);
        }
    }

    // https://leafletjs.com/
    class LeafletFinder extends AbstractMapFinder {
        static findMaps() {
            return [
                // https://www.strava.com/activities
                ...document.querySelectorAll('.leaflet-container:has(.leaflet-tile-container)')
            ];
        }
    }

    // https://www.openstreetmap.org/
    class OpenStreetMapFinder extends AbstractMapFinder {
        static findMaps() {
            return OpenStreetMapFinder._findTiledMap('img[src*="tile.openstreetmap.org"]');
        }
    }

    // https://developer.apple.com/documentation/mapkitjs/
    class AppleMapKitFinder extends AbstractMapFinder {
        static findMaps() {
            return Array.from(document.querySelectorAll('.mk-map-view:has(canvas)'));
        }
    }

    // https://openlayers.org/
    class OpenLayersMapFinder extends AbstractMapFinder {
        static findMaps() {
            return Array.from(document.querySelectorAll('.ol-viewport:has(canvas)'));
        }
    }

    // https://maplibre.org/maplibre-gl-js/docs/, including Azure Maps.
    class MapLibreFinder extends AbstractMapFinder {
        static findMaps() {
            return Array.from(document.querySelectorAll('.maplibregl-map:has(canvas.maplibregl-canvas)'));
        }
    }

    async function scrollifyExistingMaps() {
        const maps = [
            ...GoogleMapFinder.findMaps().map((m) => { return { map: m, type: ScrollableMap.TYPE_GOOGLE_MAPS_API } }),
            ...ArcGisFinder.findMaps().map((m) => { return { map: m, type: ScrollableMap.TYPE_ARCGIS } }),
            ...MapBoxFinder.findMaps().map((m) => { return { map: m, type: ScrollableMap.TYPE_MAPBOX } }),
            ...OpenStreetMapFinder.findMaps().map((m) => { return { map: m, type: ScrollableMap.TYPE_OPEN_STREET_MAP } }),
            ...AppleMapKitFinder.findMaps().map((m) => { return { map: m, type: ScrollableMap.TYPE_APPLE_MAPKIT } }),
            ...LeafletFinder.findMaps().map((m) => { return { map: m, type: ScrollableMap.TYPE_LEAFLET } }),
            ...MapLibreFinder.findMaps().map((m) => { return { map: m, type: ScrollableMap.TYPE_MAPLIBRE } }),
            ...OpenLayersMapFinder.findMaps().map((m) => { return { map: m, type: ScrollableMap.TYPE_MAPLIBRE } }),
        ];
        if (DEBUG) console.log('Found maps in page?', maps);
        if (maps.length <= 0) {
            return false;
        }
        const options = await Pref.getAllOptions();
        for (const { map, type } of maps) {
            if (!map.hasAttribute('data-scrollmaps')) {
                new ScrollableMap(map, type, SM_INJECT.count++, options);
            } else {
                if (DEBUG) console.log('Skipping already scrollified map');
            }
        }
        return true;
    }

    function sleep(timeout) {
        return new Promise((accept, _) => { setTimeout(accept, timeout); });
    }

    async function poll(func, timeout, count) {
        for (let i = 0; i < count; i++) {
            console.log('poll scrollify maps', i);
            func();
            await sleep(timeout * Math.pow(2, i));
        }
    }

    // Init
    let lastEventTime = 0;
    const THROTTLE_TIME_MS = 2000;
    window.addEventListener('wheel', async (e) => {
        if (e.timeStamp - lastEventTime > THROTTLE_TIME_MS) {
            lastEventTime = e.timeStamp;
            await scrollifyExistingMaps();
        }
    }, true);
    poll(scrollifyExistingMaps, 2000, 3);

    window.addEventListener('mapsFound', async function (event) {
        let map = event.target;
        new ScrollableMap(map, event.detail.type, SM_INJECT.count++, await Pref.getAllOptions());
    }, true);
}
