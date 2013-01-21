/*global $ console */

var PrefManager = {};
var Pref = PrefManager;

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
        Extension.forAllTabs(function (tab) {
            Message.tab.sendMessage(tab, {action: 'preferenceChanged', key: pair.key, value: pair.value});
        });
    });

    Message.extension.addListener(function(action, data, sender, sendResponse){
        switch(action){
            case 'getAllPreferences':
                var allOptions = $.extend(defaults, PrefManager.getAllOptions());
                sendResponse(allOptions);
                break;
        }
    });

})();
