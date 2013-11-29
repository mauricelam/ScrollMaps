(function (){
    init();

    function init() {
        function newMapNotifier (Map) {
            var newMap = function (container, opts) {
                if (opts) opts.scrollwheel = true; // force mousewheel
                var uid = Math.floor(Math.random() * 100000);
                container.dispatchEvent(createEvent('mapsFound', uid));
                container.setAttribute('data-scrollmaps', uid);
                var mapobj = new Map(container, opts);

                if (typeof mapobj.enableScrollWheelZoom == 'function') {
                    mapobj.enableScrollWheelZoom();
                    mapobj.disableScrollWheelZoom = function () { console.log('cannot disable scroll wheel'); };
                }
                return mapobj;
            };
            newMap.prototype = Map.prototype;
            return newMap;
        }
        swapFunctions ('GMap', newMapNotifier);
        swapFunctions ('GMap2', newMapNotifier);
        swapFunctions ('google.maps.Map2', newMapNotifier);
        swapFunctions ('google.maps.Map', newMapNotifier);
    }

    function swapFunctions (chain, fn) {
        if (typeof chain === 'string') chain = chain.split('.');
        if (chain[0] === 'window') chain.shift();
        swapFunctionsRecursive(window, chain, fn);
    }

    function swapFunctionsRecursive (object, chain, fn) {
        if (typeof object[chain[0]] == 'undefined') {
            onPropertySet (object, chain, fn);
        } else {
            if (chain.length > 1) {
                swapFunctionsRecursive (object[chain.shift()], chain, fn);
            } else {
                object[chain[0]] = fn(object[chain[0]]);
            }
        }
    }

    function onPropertySet (object, properties, fn) {
        createFunction(0)(object);

        function createFunction (i){
            if (i >= properties.length) return fn;
            return function (obj) {
                onImmediatePropertySet(obj, properties[i], createFunction(i+1));
                return obj;
            };
        }
    }

    function onImmediatePropertySet (object, property, fn) {
        var descriptor = Object.getOwnPropertyDescriptor(object, property);
        var setter = (descriptor) ? 
              function (value) { descriptor.set(value); this['..' + property] = fn(value); }
            : function (value) { this['..' + property] = fn(value); };
        Object.defineProperty(object, property, {
            get: function () { return this['..' + property]; },
            set: setter,
            configurable: true,
            enumerable: true
        });
    }

    function createEvent(type, detail) {
        var event = document.createEvent('CustomEvent');
        event.initCustomEvent(type, true, false, detail);
        return event;
    }
})();
