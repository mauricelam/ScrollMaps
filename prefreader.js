/*global $ */

/**
 * Uses message passing mechanism to read preference values from the context of the extension. This
 * class has a cache of its own to provide all required preference values instantly.
 */

var PrefReader = {};
var Pref = PrefReader;

// convenience function
function pref(key){
    return PrefReader.getOption(key);
}

(function(){
    
    PrefReader.options = {};

    Message.extension.addListener(function (action, data, sender, sendResponse) {
        switch (action) {
            case 'preferenceChanged':
                PrefReader.options[data.key] = data.value;
                $(window).trigger('preferenceChanged', [{ key: data.key, value: data.value }]);
                break;
        }
    });

    $(function(){
        Message.extension.sendMessage('getAllPreferences', {}, function(_options){
            $.extend(PrefReader.options, _options);
            for (var key in _options) {
                $(window).trigger('preferenceChanged', [{ key: key, value: _options[key] }]);
            }
        });
    });

    PrefReader.setOption = function(key, value){
        PrefReader.options[key] = value;
        Message.extension.sendMessage('setPreference', {key: key, value: value});
    };

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
