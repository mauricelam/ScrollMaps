/*global $ chrome */

/**

  Uses chrome message passing mechanism to read preference values from the context of the extension. This class has a cache of its own to provide all required preference values instantly. 

**/

var PrefReader = {};

// convenience function
function pref(key){
    return PrefReader.getOption(key);
}

(function(){
    
    PrefReader.options = {};

    chrome.extension.onMessage.addListener(function(request, sender, sendResponse){
        switch(request.action){
            case 'preferenceChanged':
                PrefReader.options[request.key] = request.value;
                $(window).trigger('preferenceChanged', [{key: request.key, value: request.value}]);
                break;
            default:
                //console.log("Message not recognized: ", request.action);
        }
    });

    $(function(){
        chrome.extension.sendMessage({action: 'getAllPreferences'}, function(_options){
            $.extend(PrefReader.options, _options);
            document.prefs = PrefReader.options;
        });
    });

    PrefReader.getOption = function(key){
        return PrefReader.options[key];
    };

    PrefReader.onPreferenceChanged = function(key, func){
        $(window).bind('preferenceChanged', function(event, pair){
            if(pair.key == key)
                func(pair);
        });
    };
})();
