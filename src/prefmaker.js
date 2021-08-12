/*global $ Pref pref */

/** Create views or widgets to toggle certain preference values. */

var PrefMaker = new (function _PrefMaker(){

    this.makePermissionCheckbox = function(key, origin, label, secondLine) {
        if(typeof secondLine == 'string'){
            label = createTwoLineBox(label, secondLine);
        }
        var div = $('<div class="PMcheckbox"></div>');
        var box = $('<input id="PMcheckbox_' + key + '" type="checkbox" />');
        label = $('<label for="PMcheckbox_' + key + '">' + label + '</label>');
        div.append(box).append(label);
        box.click(updateOption);
        label.click(updateOption);
        updateView();

        var prefChange = false;
        function updateOption(){
            if (box.prop('checked')) {
                chrome.permissions.request({origins: [origin]});
            } else {
                chrome.permissions.remove({origins: [origin]});
            }
        }
        async function updateView(){
            let permission = await Permission.getPermissions([origin]);
            box.attr('checked', permission);
        }
        chrome.permissions.onAdded.addListener(updateView);
        chrome.permissions.onRemoved.addListener(updateView);

        return div;
    };

    this.makeBooleanCheckbox = function(key, label, secondLine) {
        if(typeof secondLine == 'string'){
            label = createTwoLineBox(label, secondLine);
        }
        var div = $('<div class="PMcheckbox"></div>');
        var box = $('<input id="PMcheckbox_' + key + '" type="checkbox" />');
        label = $('<label for="PMcheckbox_' + key + '">' + label + '</label>');
        div.append(box).append(label);
        box.click(updateOption);
        label.click(updateOption);
        updateView();

        Pref.onPreferenceChanged(key, (key, value) => {
            if(!prefChange)
                updateView();
            prefChange = false;
        });

        var prefChange = false;
        function updateOption(){
            prefChange = true;
            Pref.setOption(key, box.prop('checked'));
        }
        function updateView(){
            box.attr('checked', pref(key)); // convert to string to comply with HTML (otherwise error thrown);
        }

        return div;
    };

    this.makeSlider = function(key, label, max, min, step) {
        step = step || 1;
        var div = $('<div class="PMslider"></div>');
        var slider = $(`<input type="range" id="PMslider_${key}" max="${max}" min="${min}" step="${step}" />`);
        var preview = $('<span id="PMsliderPreview_' + key + '" class="PMsliderPreview"></span>');
        var labelElement = $('<label for="PMslider_' + key + '">' + label + '</label>');
        div.append(labelElement).append(slider).append(preview);
        let prefChange = false;

        slider.change(() => {
            prefChange = true;
            Pref.setOption(key, slider.val());
            preview.text(pref(key));
        });
        slider.on('input', () => preview.text(slider.val()))
        updateView();

        Pref.onPreferenceChanged(key, (key, value) => {
            if(!prefChange) updateView();
            prefChange = false;
        });

        function updateView(){
            slider.val(pref(key));
            preview.text(pref(key));
        }

        return div;
    };

    function createTwoLineBox(label, secondLine) {
        var output = '<div class="PMcheckbox_labelwrap"><div class="PMcheckbox_labeltext">' + label + '</div><div class="PMcheckbox_smalltext">' + secondLine + '</div></div>';
        return output;
    }

})();
