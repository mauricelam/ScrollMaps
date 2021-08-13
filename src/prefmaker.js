/*global $ Pref pref */

/** Create views or widgets to toggle certain preference values. */

var PrefMaker = new (function _PrefMaker(){

    this.makePermissionCheckbox = function(key, origin, label, secondLine) {
        if (typeof secondLine === 'string') {
            label = createTwoLineBox(label, secondLine);
        } else if (typeof secondLine === 'object') {
            // secondLine can also be in the form
            // { true: 'string when enabled', false: 'string when disabled' }
            label = createTwoLineBox(label, secondLine[false]);
        }
        var div = $('<div class="PMcheckbox"></div>');
        var box = $('<input id="PMcheckbox_' + key + '" type="checkbox" />');
        label = $('<label for="PMcheckbox_' + key + '">' + label + '</label>');
        div.append(box).append(label);
        box.on('click', updateOption);
        label.on('click', updateOption);
        updateView();

        function updateOption(){
            if (box.prop('checked')) {
                chrome.permissions.request({origins: [origin]});
            } else {
                chrome.permissions.remove({origins: [origin]});
            }
        }
        async function updateView() {
            const permission = await Permission.getPermissions([origin]);
            box.attr('checked', permission);
            if (typeof secondLine === 'object') {
                label.find('.PMcheckbox_smalltext').text(secondLine[permission]);
            }
        }
        chrome.permissions.onAdded.addListener(updateView);
        chrome.permissions.onRemoved.addListener(updateView);

        return div;
    };

    this.makeBooleanCheckbox = function(key, label, secondLine) {
        if (typeof secondLine === 'string') {
            label = createTwoLineBox(label, secondLine);
        } else if (typeof secondLine === 'object') {
            // secondLine can also be in the form
            // { true: 'string when enabled', false: 'string when disabled' }
            label = createTwoLineBox(label, secondLine[false]);
        }
        const div = $('<div class="PMcheckbox"></div>');
        const box = $('<input id="PMcheckbox_' + key + '" type="checkbox" />');
        const labelElem = $('<label for="PMcheckbox_' + key + '">' + label + '</label>');
        div.append(box).append(labelElem);
        box.on('click', updateOption);
        labelElem.on('click', updateOption);
        updateView(false);

        let prefChange = false;
        Pref.onPreferenceChanged(key, (key, value) => {
            updateView(prefChange);
            prefChange = false;
        });

        function updateOption() {
            prefChange = true;
            Pref.setOption(key, box.prop('checked'));
        }
        function updateView(prefChange) {
            const prefValue = pref(key);
            if (!prefChange) {
                box.attr('checked', prefValue); // convert to string to comply with HTML (otherwise error thrown);
            }
            if (typeof secondLine === 'object') {
                labelElem.find('.PMcheckbox_smalltext').text(secondLine[prefValue]);
            }
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
