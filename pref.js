/*global $ safari */

var PrefManager = {};

function pref(label){
    return PrefManager.getOption(label);
}

(function(){

    // Warning: will fail if not in sync with Safari's defaults
    var defaults = {
        'enabled': true,
        'invertScroll': false,
        'invertZoom': false,
        'enableForFrames': true,
        'isolateZoomScroll': true,
        'frameRequireFocus': true,
        'scrollSpeed': 50
    };

    PrefManager.getAllOptions = function(){
        return $.extend({}, defaults, safari.extension.settings);
    };

    PrefManager.setOption = function(key, value){
        safari.extension.settings[key] = value;
    };

    PrefManager.getOption = function(key){
        return safari.extension.settings[key];
    };

    PrefManager.onPreferenceChanged = function(key, func){
        $(window).bind('preferenceChanged', function(event, pair){
            if(pair.key == key)
                func(pair);
        });
    };

    // support for PrefProxy which reads preferences from content scripts (which do not have access to localStorage of the extension)

    safari.extension.settings.addEventListener('change', function(event){
        var windows = safari.application.browserWindows;
        for(var i in windows){
            var tabs = windows[i].tabs;
            for(var j in tabs){
                if(tabs[j].page)
                    tabs[j].page.dispatchMessage('preferenceChanged', {key: event.key, value: event.newValue});
            }
        }
    }, false);

    // if in global background page instead of options page
    safari.application.addEventListener('message', function(msgEvent){
        var request = msgEvent.message;
        switch(msgEvent.name){
            case 'setPreference':
                PrefManager.setOption(request.key, request.value);
                break;
            case 'getAllPreferences':
                var allOptions = PrefManager.getAllOptions();
                msgEvent.target.page.dispatchMessage(request.returnName, allOptions);
                break;
        }
    }, false);

})();
