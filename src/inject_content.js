(function () {

    var TYPE_WEB = 0;
    var TYPE_IFRAME = 1;
    var TYPE_API = 2;
    var TYPE_NEWWEB = 3;
    var TYPE_STREETVIEW_API = 4;

    function init() {
        function newMapNotifier (parent, propname, Map) {
            if (typeof Map !== 'function') return;
            if (Map['..ScrollMaps']) return;

            var newMap = function (container, opts) {
                if (opts) {
                    opts.scrollwheel = true; // force mousewheel
                    if (opts.gestureHandling != 'none') {
                        // Force greedy gesture handling to allow us to pan the map. The "require
                        // click to scroll embedded maps" options handles the "cooperative" gesture
                        // handling mode in Maps API.
                        // The behavior of the API values are described here:
                        // https://developers.google.com/maps/documentation/javascript/interaction
                        //
                        // If the gesture handling is 'none', maybe the developer has a good reason
                        // to not allow pannign
                        opts.gestureHandling = 'greedy';
                    }
                }
                var uid = Math.floor(Math.random() * 100000);
                container.setAttribute('data-scrollmaps', uid);
                dispatchEventWhenAttached(container, 'mapsFound', {'id': uid, 'type': TYPE_API});
                Map.call(this, container, opts);

                if (typeof this.enableScrollWheelZoom === 'function') {
                    this.enableScrollWheelZoom();
                    this.disableScrollWheelZoom = function () {
                        console.log('ScrollMaps locked scroll wheel to enabled');
                    };
                }

                return this;
            };
            newMap['..ScrollMaps'] = true;
            newMap.prototype = Map.prototype;
            parent[propname] = newMap;
        }

        onChainedPropertySet('GMap', newMapNotifier);
        onChainedPropertySet('GMap2', newMapNotifier);
        onChainedPropertySet('google.maps.Map2', newMapNotifier);
        onChainedPropertySet('google.maps.Map', newMapNotifier);

        function newStreetViewNotifier(parent, propname, StreetView) {
            if (StreetView['..ScrollMaps']) return;

            var newStreetView = function (container, opts) {
                if (opts) {
                    opts.scrollwheel = true; // force mousewheel
                }
                var uid = Math.floor(Math.random() * 100000);
                dispatchEventWhenAttached(container, 'mapsFound',
                    {'id': uid, 'type': TYPE_STREETVIEW_API});
                container.setAttribute('data-scrollmaps', uid);
                StreetView.call(this, container, opts);

                return this;
            };
            newStreetView['..ScrollMaps'] = true;
            newStreetView.prototype = StreetView.prototype;
            parent[propname] = newStreetView;
        }
        onChainedPropertySet('google.maps.StreetViewPanorama', newStreetViewNotifier);
    }

    function dispatchEventWhenAttached(elem, type, detail) {
        var e = new CustomEvent(type, { 'detail': detail });
        if (document.documentElement.contains(elem)) {
            elem.dispatchEvent(e);
        } else {
            var mutationObserver = new MutationObserver(function (records, observer) {
                if (document.documentElement.contains(elem)) {
                    elem.dispatchEvent(e);
                    mutationObserver.disconnect();
                }
            });
            mutationObserver.observe(document, { childList: true, subtree: true });
        }
    }

    // Monitor a chain of properties (foo.bar.baz.quuz). The callback will be called immediately
    // with the value if the entire chain is already set.
    function onChainedPropertySet(chain, fn) {
        if (typeof chain === 'string') chain = chain.split('.');
        if (chain[0] === 'window') chain.shift();
        recursive(window);

        function recursive(object) {
            if (typeof object[chain[0]] == 'undefined') {
                // Add monitor for property set if not defined yet
                onPropertySet(object, chain, fn);
            } else {
                if (chain.length > 1) {
                    // Expand the chain and listen for the next property down the chain
                    recursive(object[chain.shift()]);
                } else {
                    // Last item in the chain is set, simply call the callback function
                    fn(object, chain[0], object[chain[0]]);
                    console.log('Failed to inject script before Google Maps JS is loaded');
                }
            }
        }
    }

    // Registers a callback when the given chain of properties is set. This does not call the
    // callback immediately if there is already a value.
    function onPropertySet (object, properties, fn) {
        createFunction(0)(undefined, undefined, object);

        function createFunction (i){
            if (i >= properties.length) return fn;
            return function (parent, propname, value) {
                ListeningPropertyDescriptor.attach(value, properties[i], createFunction(i+1));
            };
        }
    }

    var ListeningPropertyDescriptor = function (parent, propertyName, realDescriptor) {
        this.propertyName = propertyName;
        this.configurable = true;
        // Should this be enumerable only when real value is set?
        this.enumerable = true;
        this.listeners = [];
        this.realDescriptor = Object.getOwnPropertyDescriptor(parent, propertyName);
        if (!this.realDescriptor) this.realValue = parent[propertyName];
        this.parent = parent;
    };

    ListeningPropertyDescriptor.prototype.set = function(realValue) {
        if (this.realDescriptor) {
            this.realDescriptor.set(realValue);
            return;
        }
        this.realValue = realValue;

        for (var i = 0; i < this.listeners.length; i++) {
            this.listeners[i](this.parent, this.propertyName, realValue);
        }
    };

    ListeningPropertyDescriptor.prototype.get = function() {
        if (this.realDescriptor) {
            return this.realDescriptor.get();
        }
        return this.realValue;
    };

    ListeningPropertyDescriptor.prototype.addListener = function(listener) {
        this.listeners.push(listener);
    };

    ListeningPropertyDescriptor.prototype.getDescriptor = function() {
        return {
            set: this.set.bind(this),
            get: this.get.bind(this),
            configurable: this.configurable,
            enumerable: this.enumerable
        };
    };

    // Listen to "property" in the given "object", calling "fn" when the property is set.
    ListeningPropertyDescriptor.attach = function (object, property, fn) {
        if (typeof object !== 'object') return;
        var listeningDescriptor = object['..' + property];
        if (!listeningDescriptor) {
            listeningDescriptor = new ListeningPropertyDescriptor(object, property);
            Object.defineProperty(object, property, listeningDescriptor.getDescriptor());
            // Store the descriptor in the object, since native descriptors will remove its type
            // and extra properties.
            object['..' + property] = listeningDescriptor;
        }
        listeningDescriptor.addListener(fn);
        return listeningDescriptor;
    };

    if (document.documentElement.innerHTML.indexOf('maps.googleapis.com') !== -1 ||
        /.*:\/\/www\.google\.com\/maps\/(.+\/)?viewer[^a-zA-Z]/.test(document.URL)) {
        // Avoid injecting into pages not using maps
        init();
    }

})();
