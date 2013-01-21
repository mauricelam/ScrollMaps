/**

  Open the options page when necessary. Linked to the safari settings extension. 

**/

var OpenOptions = {};

(function(){
	var m = OpenOptions;

    $(function(){
        safari.extension.settings.clickOptions = false;
        safari.extension.settings.addEventListener("change", function(event){
            /*if(event.key == "slider"){
                if(event.newValue == 100){
                    safari.application.activeBrowserWindow.activate();
                    safari.application.activeBrowserWindow.openTab("foreground").url = safari.extension.baseURI + "options/options.html";
                }
                safari.extension.settings.slider = 0;
            }*/
            if(event.key == "clickOptions"){
                safari.application.activeBrowserWindow.activate();
                safari.application.activeBrowserWindow.openTab("foreground").url = safari.extension.baseURI + "options/options.html";
            }
        }, false);
    });
})();
