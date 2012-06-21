var PrefManager = {};

function pref(label){
    return PrefManager.getOption(label);
}

(function(){
	var m = PrefManager;
	var defaults = {
        "enabled": true,
        "invertScroll": false,
        "invertZoom": false,
        "enableForFrames": true,
        "isolateZoomScroll": true,
        "frameRequireFocus": true,
        "scrollSpeed": 50
	};

	function getDefault(label){
		var output = defaults[label];
		return output;
	}

	function getOptions(){
		var opt = localStorage["options"];
		if(!opt) return false;
		var options = JSON.parse(opt);
		if(!options) return false;
		return options;
	}

    m.getAllOptions = function(){
        return getOptions();
    }

	m.setOption = function(key, value){
		var options = getOptions();
		if(!options) options = {};
		options[key] = value;
		localStorage["options"] = JSON.stringify(options);
        $(window).trigger("preferenceChanged", [{key: key, value: value}])
		console.log("Options saved");
	}

	m.getOption = function(key){
		var options = getOptions();
		if(!options) return getDefault(key);
		var output = options[key];
		if(typeof output == "undefined")
			return getDefault(key);
		return output;
	}

    m.onPreferenceChanged = function(key, func){
        $(window).bind("preferenceChanged", function(event, pair){
            if(pair.key == key)
                func(pair);
        })
    }

    // support for PrefReader which reads preferences from content scripts (which do not have access to localStorage of the extension)

    $(window).bind("preferenceChanged", function(event, pair){
        chrome.windows.getAll({populate: true}, function(windows){
            for(var i in windows){
                var tabs = windows[i].tabs;
                for(var j in tabs){
                    chrome.tabs.sendRequest(tabs[j].id, {action: "preferenceChanged", key: pair.key, value: pair.value});
                }
            }
        });
    });

    chrome.extension.onRequest.addListener(function(request, sender, sendResponse){
        switch(request.action){
            case "getAllPreferences":
                var allOptions = $.extend(defaults, m.getAllOptions());
                sendResponse(allOptions);
                break;
        }
    });

})();
