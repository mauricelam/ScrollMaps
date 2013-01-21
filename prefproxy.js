/**

  Uses safari message passing mechanism to read / write preference values from the context of the extension. This class has a cache of its own to provide all required preference values instantly. 

**/

var PrefProxy = {};

// convenience function
function pref(key){
    return PrefProxy.getOption(key);
}

(function(){

    PrefProxy.options = {};

    safari.self.addEventListener('message', function(msgEvent){
        var request = msgEvent.message;
        switch(msgEvent.name){
            case 'preferenceChanged':
                PrefProxy.options[request.key] = request.value;
                $(window).trigger('preferenceChanged', [{key: request.key, value: request.value}]);
                break;
            case 'returnGetAllPreferences':
                for(var i in request){
                    $(window).trigger('preferenceChanged', [{key: i, value: request[i]}]);
                }
                $.extend(PrefProxy.options, request);
                break;
            default:
                //console.log("Message not recognized: ", request.action);
        }
    }, false);

    $(function(){
        safari.self.tab.dispatchMessage('getAllPreferences', {returnName: 'returnGetAllPreferences'});
    });

    PrefProxy.getOption = function(key){
        return PrefProxy.options[key];
    };

    PrefProxy.setOption = function(key, value){
        PrefProxy.options[key] = value;
        safari.self.tab.dispatchMessage('setPreference', {key: key, value: value});
    };

    PrefProxy.onPreferenceChanged = function(key, func){
        $(window).bind('preferenceChanged', function(event, pair){
            if(pair.key == key)
                func(pair);
        });
    };
})();
