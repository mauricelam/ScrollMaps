import PrefManager from "./pref";
import ScrollableMap, { MapType } from "./ScrollableMap";
import { DEBUG, sleep } from "./utils";

if ((window as any).SM_INJECT === undefined) {
  const SM_INJECT = { count: 0 };
  (window as any).SM_INJECT = SM_INJECT;

  function _matchAncestor(node: Element, predicate: (node: Element) => boolean) {
    if (predicate(node)) {
      return node;
    }
    if (node.parentNode instanceof Element && node.parentNode !== node) {
      return _matchAncestor(node.parentNode, predicate);
    }
    return null;
  }

  class AbstractMapFinder {
    static _querySrc(container: Element, tag: string, possible_substrings: string[]) {
      for (const elem of container.querySelectorAll(tag)) {
        for (const substring of possible_substrings) {
          if (elem['src']?.indexOf(substring) !== -1) {
            return true;
          }
        }
      }
      return false;
    }

    static _findTiledMap(finder: ElementFinder, selector: string, filter?: (node: Element) => boolean) {
      let foundImages = finder.querySelectorAll(selector);
      // To handle multiple maps on the same page, we make the threshold
      // number of images / 4. We consider the common ancestor to be found below
      // that threshold.
      let foundThreshold = Math.max(foundImages.length / 4, 1);
      for (let i = 0; i < 5; i++) {
        // Walk maximum 5 levels to find the common ancestor
        foundImages = foundImages.map(img => img.parentNode as Element);
        const foundSet = new Set(foundImages);
        if (foundSet.size <= foundThreshold) {
          return Array.from(foundSet)
            .map(container => _matchAncestor(container,
              elem => isVisible(elem)
                && elem['offsetHeight'] > 1
                && elem['offsetWidth'] > 1
                && (filter === undefined || filter(elem))
            ))
            .filter(n => n);
        }
      }
      return [];

      function isVisible(elem: Element): boolean {
        return window.getComputedStyle(elem).display !== "none";
      }
    }
  }

  class GoogleMapFinder extends AbstractMapFinder {
    static _findGmStyleMap(finder: ElementFinder): Node[] {
      return finder.querySelectorAll('.gm-style:has(img)')
        .filter(container =>
          this._querySrc(container, 'img',
            [
              '//maps.googleapis.com/maps/',
              '//www.google.com/maps/',
              '//maps.google.com/maps/',
              '//maps.gstatic.com/',
              '//mapsresources-pa.googleapis.com',
            ])
        )
        .map(container => container.parentNode);
    }

    static _findCanvasMap(finder: ElementFinder): Node[] {
      return finder.querySelectorAll('.gm-style:has(canvas)')
        .map(container => container.parentNode);
    }

    static _findFallbackMap(finder: ElementFinder): Node[] {
      return GoogleMapFinder._findTiledMap(finder, 'img[src*="//maps.googleapis.com/maps/"]');
    }

    static _findAriaMap(finder: ElementFinder): Node[] {
      if (new URL(location.href).host.indexOf('.google.') > -1) {
        return [...finder.querySelectorAll('[aria-label=Map]')];
      } else {
        return [];
      }
    }

    static findMaps(finder: ElementFinder): Node[] {
      let mapContainers = GoogleMapFinder._findCanvasMap(finder);
      if (mapContainers.length > 0) {
        return mapContainers;
      }

      mapContainers = GoogleMapFinder._findGmStyleMap(finder);
      if (mapContainers.length > 0) {
        return mapContainers;
      }

      mapContainers = GoogleMapFinder._findAriaMap(finder);
      if (mapContainers.length > 0) {
        return mapContainers;
      }

      mapContainers = GoogleMapFinder._findFallbackMap(finder);
      return mapContainers;
    }
  }

  // https://developers.arcgis.com/javascript/latest/
  // More examples at https://developers.arcgis.com/javascript/3/jssamples
  class ArcGisFinder extends AbstractMapFinder {
    static findMaps(finder: ElementFinder): Node[] {
      return [
        ...finder.querySelectorAll('.esri-view:has(.esri-view-surface > canvas)'),
        // Examples:
        // https://developers.arcgis.com/javascript/3/samples/analysis_connectoriginstodestinations/
        // https://www.tsunami.gov/
        ...ArcGisFinder._findTiledMap(
          finder,
          'img[src*=".arcgisonline.com/"]',
          (node) => node.classList.contains("esriMapContainer") && node.getAttribute("id").endsWith("_root")),
        ...finder.querySelectorAll('.esriMapContainer[id$="_root"]:has(canvas)'),
      ];
    }
  }

  // https://docs.mapbox.com/
  class MapBoxFinder extends AbstractMapFinder {
    static findMaps(finder: ElementFinder): Node[] {
      return finder.querySelectorAll('.mapboxgl-map:has(canvas.mapboxgl-canvas)')
        .map((elem) => elem.closest('.leaflet-container') || elem);
    }
  }

  // https://leafletjs.com/
  class LeafletFinder extends AbstractMapFinder {
    static findMaps(finder: ElementFinder): Node[] {
      // https://www.strava.com/activities
      return finder.querySelectorAll('.leaflet-container:has(.leaflet-tile-container)');
    }
  }

  // https://www.openstreetmap.org/
  class OpenStreetMapFinder extends AbstractMapFinder {
    static findMaps(finder: ElementFinder): Node[] {
      return OpenStreetMapFinder._findTiledMap(finder, 'img[src*="tile.openstreetmap.org"]');
    }
  }

  // https://developer.apple.com/documentation/mapkitjs/
  class AppleMapKitFinder extends AbstractMapFinder {
    static findMaps(finder: ElementFinder): Node[] {
      return finder.querySelectorAll('.mk-map-view:has(canvas)');
    }
  }

  // https://openlayers.org/
  class OpenLayersMapFinder extends AbstractMapFinder {
    static findMaps(finder: ElementFinder): Node[] {
      return finder.querySelectorAll('.ol-viewport:has(canvas)');
    }
  }

  // https://maplibre.org/maplibre-gl-js/docs/, including Azure Maps.
  class MapLibreFinder extends AbstractMapFinder {
    static findMaps(finder: ElementFinder): Node[] {
      return finder.querySelectorAll('.maplibregl-map:has(canvas.maplibregl-canvas)');
    }
  }

  // https://en.mapy.cz/
  class MapyCzFinder extends AbstractMapFinder {
    static findMaps(finder: ElementFinder): Node[] {
      return MapyCzFinder._findTiledMap(
        finder,
        'img[src*=".mapy.cz/"]',
        (node) => node.getAttribute("id") == "map")
    }
  }

  // https://www.bing.com/api/maps/sdk/mapcontrol/isdk/loadmapasync
  // https://www.costco.com/WarehouseLocatorDetailsView?catalogId=10701&storeId=10301
  // https://www.edinarealty.com/listing/listingsearch/properties
  class MicrosoftMapFinder extends AbstractMapFinder {
    static findMaps(finder: ElementFinder): Node[] {
      return finder.querySelectorAll('.MicrosoftMap:has(canvas)');
    }
  }

  function findAllShadowRoots(container: Document | HTMLElement | ShadowRoot = document): ShadowRoot[] {
    const allElements = container.querySelectorAll('*');
    const results = [];

    allElements.forEach(el => {
      if (el.shadowRoot) {
        results.push(el.shadowRoot);
        findAllShadowRoots(el.shadowRoot);
      }
    });

    return results;
  }

  class ElementFinder {
    shadowRoots: ShadowRoot[];
    container: Document | HTMLElement | ShadowRoot;

    constructor(container: Document | HTMLElement | ShadowRoot = document) {
      this.shadowRoots = findAllShadowRoots(container);
      this.container = container;
    }

    querySelectorAll(selector: string): Element[] {
      const results = [];
      results.push(...this.container.querySelectorAll(selector));
      for (const shadowRoot of this.shadowRoots) {
        results.push(...shadowRoot.querySelectorAll(selector));
      }
      return results;
    }
  }

  async function scrollifyExistingMaps(): Promise<boolean> {
    const finder = new ElementFinder();
    const maps = [
      ...GoogleMapFinder.findMaps(finder).map((m) => ({ map: m, type: MapType.TYPE_GOOGLE_MAPS_API })),
      ...ArcGisFinder.findMaps(finder).map((m) => ({ map: m, type: MapType.TYPE_ARCGIS })),
      ...MapBoxFinder.findMaps(finder).map((m) => ({ map: m, type: MapType.TYPE_MAPBOX })),
      ...OpenStreetMapFinder.findMaps(finder).map((m) => ({ map: m, type: MapType.TYPE_OPEN_STREET_MAP })),
      ...AppleMapKitFinder.findMaps(finder).map((m) => ({ map: m, type: MapType.TYPE_APPLE_MAPKIT })),
      ...LeafletFinder.findMaps(finder).map((m) => ({ map: m, type: MapType.TYPE_LEAFLET })),
      ...MapLibreFinder.findMaps(finder).map((m) => ({ map: m, type: MapType.TYPE_MAPLIBRE })),
      ...OpenLayersMapFinder.findMaps(finder).map((m) => ({ map: m, type: MapType.TYPE_MAPLIBRE })),
      ...MapyCzFinder.findMaps(finder).map((m) => ({ map: m, type: MapType.TYPE_MAPYCZ })),
      ...MicrosoftMapFinder.findMaps(finder).map((m) => ({ map: m, type: MapType.TYPE_MSMAP })),
    ];
    if (DEBUG) console.log('Found maps in page?', maps);
    if (maps.length <= 0) {
      return false;
    }
    const options = await PrefManager.getAllOptions();
    for (const { map, type } of maps) {
      if (map instanceof HTMLElement && !map.hasAttribute('data-scrollmaps')) {
        new ScrollableMap(map, type, SM_INJECT.count++, options);
      } else {
        if (DEBUG) console.log('Skipping already scrollified map');
      }
    }
    return true;
  }

  async function poll(func, timeout, count) {
    for (let i = 0; i < count; i++) {
      if (DEBUG) console.log('Poll scrollify maps', i);
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
      if (!_matchAncestor(e.target as Element, (e) => e.hasAttribute('data-scrollmaps'))) {
        await scrollifyExistingMaps();
      }
    }
  }, true);
  poll(scrollifyExistingMaps, 2000, 2);

  window.addEventListener('mapsFound', async function (event: CustomEvent) {
    new ScrollableMap(
      event.target as HTMLElement,
      event.detail.type,
      (window as any).SM_INJECT.count++,
      await PrefManager.getAllOptions()
    );
  }, true);
}
