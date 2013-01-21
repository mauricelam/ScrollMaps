var ScrollMapsOptionsPanel = new (function _ScrollMapsOptionsPanel(){
    var self = this;

    self.createButton = function(){
        var bg = chrome.extension.getURL('button_active.png');
        console.log(bg);
        var div = $('<div id="SCROLLMAP_optionsbutton" style="display: block; height: 20px; position: absolute; bottom: 19px; right: 0px; background: #FFF; z-index: 999999; border: 1px solid #999; box-sizing: border-box;"></div>');
        var button = $('<a href="#" style="float: left; z-index: 999; position: relative; background-color: white; height: 18px;"><img src="'+bg+'" style="width: 18px; height: 18px;" /></a>');
        var optionsLink = chrome.extension.getURL('options/options.html');
        var content = $('<span id="SCROLLMAP_optionspanel" style="z-index: 888; display: none; float: left; position: relative; margin-right: -100px;"><span style="font-family: Century Gothic, Arial, sans-serif; margin: 0px 3px; color: #666; ">ScrollMaps</span><a style="margin: 0px 5px;" href="'+optionsLink+'" target="SCROLLMAPS_optionspage">options</a></span>');
        button.click(function(e){
            self.toggleOptions();
            e.stopPropagation();
            e.preventDefault();
        });
        div.append(content);
        div.append(button);
        $('body').append(div);
    };

    self.toggleOptions = function(){
        var panel = $('#SCROLLMAP_optionspanel');
        if(panel.is(':visible')){
            self.hideOptions();
        }else{
            self.showOptions();
        }
    };

    self.showOptions = function(){
        var panel = $('#SCROLLMAP_optionspanel');
        panel.show();
        panel.animate({'margin-right': '0'}, {duration: 100 });
    };

    self.hideOptions = function(){
        var panel = $('#SCROLLMAP_optionspanel');
        panel.animate({'margin-right': '-100px'}, {duration: 100, complete: function(){ panel.hide(); } });
    };

    $(function(){
        if($('#map').size() > 0) // make sure it's on a real map page
            self.createButton();
    });
})();
