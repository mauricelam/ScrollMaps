/*global $ chrome console */

var PrefManager = {};

function pref(label){
    return PrefManager.getOption(label);
}

(function(){

	var defaults = {
        'enabled': true,
        'invertScroll': false,
        'invertZoom': false,
        'enableForFrames': true,
        'isolateZoomScroll': true,
        'frameRequireFocus': true,
        'scrollSpeed': 50
	};

	function getDefault(label){
		var output = defaults[label];
		return output;
	}

	function getOptions(){
		var opt = localStorage['options'];
		if(!opt) return false;
		var options = JSON.parse(opt);
		if(!options) return false;
		return options;
	}

    PrefManager.getAllOptions = function(){
        return getOptions();
    };

	PrefManager.setOption = function(key, value){
		var options = getOptions();
		if(!options) options = {};
		options[key] = value;
		localStorage['options'] = JSON.stringify(options);
        $(window).trigger('preferenceChanged', [{key: key, value: value}]);
		console.log('Options saved');
	};

	PrefManager.getOption = function(key){
		var options = getOptions();
		if(!options) return getDefault(key);
		var output = options[key];
		if(typeof output == 'undefined')
			return getDefault(key);
		return output;
	};

    PrefManager.onPreferenceChanged = function(key, func){
        $(window).bind('preferenceChanged', function(event, pair){
            if(pair.key == key)
                func(pair);
        });
    };

    // support for PrefReader which reads preferences from content scripts (which do not have access to localStorage of the extension)

    $(window).bind('preferenceChanged', function(event, pair){
        chrome.windows.getAll({populate: true}, function(windows){
            for(var i in windows){
                var tabs = windows[i].tabs;
                for(var j in tabs){
                    chrome.tabs.sendMessage(tabs[j].id, {action: 'preferenceChanged', key: pair.key, value: pair.value});
                }
            }
        });
    });

    chrome.extension.onMessage.addListener(function(request, sender, sendResponse){
        switch(request.action){
            case 'getAllPreferences':
                var allOptions = $.extend(defaults, PrefManager.getAllOptions());
                sendResponse(allOptions);
                break;
        }
    });

})();
