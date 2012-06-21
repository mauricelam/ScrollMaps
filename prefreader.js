/**

  Uses chrome message passing mechanism to read preference values from the context of the extension. This class has a cache of its own to provide all required preference values instantly. 

**/

var PrefReader = {};

// convenience function
function pref(key){
    return PrefReader.getOption(key);
}

(function(){
	var m = PrefReader;

    m.options = {};

    chrome.extension.onRequest.addListener(function(request, sender, sendResponse){
        switch(request.action){
            case "preferenceChanged":
                m.options[request.key] = request.value;
                $(window).trigger("preferenceChanged", [{key: request.key, value: request.value}]);
                sendResponse({});
                break;
            default: 
                //console.log("Message not recognized: ", request.action);
        }
    });

    $(function(){
        chrome.extension.sendRequest({action: "getAllPreferences"}, function(_options){
            $.extend(m.options, _options);
            document.prefs = m.options;
        });
    });

    m.getOption = function(key){
        return m.options[key];
    }

    m.onPreferenceChanged = function(key, func){
        $(window).bind("preferenceChanged", function(event, pair){
            if(pair.key == key)
                func(pair);
        })
    }
})();
