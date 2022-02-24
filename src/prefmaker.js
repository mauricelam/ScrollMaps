/** Create views or widgets to toggle certain preference values. */

class PrefMaker {

    static makePermissionCheckbox(key, origin, label, secondLine) {
        if (typeof secondLine === 'string') {
            label = this._createTwoLineBox(label, secondLine);
        } else if (typeof secondLine === 'object') {
            // secondLine can also be in the form
            // { true: 'string when enabled', false: 'string when disabled' }
            label = this._createTwoLineBox(label, secondLine[false]);
        }
        const div = document.createElement('div');
        div.classList.add('PMcheckbox');
        const box = document.createElement('input');
        box.id = 'PMcheckbox_' + key;
        box.type = 'checkbox';
        const labelElem = document.createElement('label');
        labelElem.htmlFor = 'PMcheckbox_' + key;
        labelElem.appendChild(label);
        div.appendChild(box);
        div.appendChild(labelElem);
        box.addEventListener('change', updateOption, false);
        updateView();

        function updateOption(){
            if (box.checked) {
                chrome.permissions.request({origins: [origin]});
            } else {
                chrome.permissions.remove({origins: [origin]});
            }
        }
        async function updateView() {
            const permission = await Permission.getPermissions([origin]);
            box.checked = permission;
            if (typeof secondLine === 'object') {
                label.querySelector('.PMcheckbox_smalltext').innerText = secondLine[permission];
            }
        }
        chrome.permissions.onAdded.addListener(updateView);
        chrome.permissions.onRemoved.addListener(updateView);

        return div;
    }

    static makeBooleanCheckbox(key, label, secondLine) {
        if (typeof secondLine === 'string') {
            label = this._createTwoLineBox(label, secondLine);
        } else if (typeof secondLine === 'object') {
            // secondLine can also be in the form
            // { true: 'string when enabled', false: 'string when disabled' }
            label = this._createTwoLineBox(label, secondLine[false]);
        }
        const div = document.createElement('div');
        div.classList.add('PMcheckbox');
        const box = document.createElement('input');
        box.id = 'PMcheckbox_' + key;
        box.type = 'checkbox';
        const labelElem = document.createElement('label');
        labelElem.htmlFor = box.id;
        labelElem.appendChild(label);
        div.appendChild(box);
        div.appendChild(labelElem);
        box.addEventListener('change', updateOption, false);
        updateView(false);

        let prefChange = false;
        Pref.onPreferenceChanged(key, async (key, value) => {
            await updateView(prefChange);
            prefChange = false;
        });

        function updateOption() {
            prefChange = true;
            Pref.setOption(key, box.checked);
        }
        async function updateView(prefChange) {
            const prefValue = await pref(key);
            if (!prefChange) {
                box.checked = prefValue;
            }
            if (typeof secondLine === 'object') {
                labelElem.querySelector('.PMcheckbox_smalltext').innerText = secondLine[prefValue];
            }
        }

        return div;
    }

    static makeSlider(key, label, max, min, step) {
        step = step || 1;
        const div = document.createElement('div');
        div.classList.add('PMslider');
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.id = `PMslider_${key}`;
        slider.max = max;
        slider.min = min;
        slider.step = step;
        const preview = document.createElement('span');
        preview.id = `PMsliderPreview_${key}`;
        preview.classList.add('PMsliderPreview');
        const labelElem = document.createElement('label');
        labelElem.htmlFor = slider.id;
        labelElem.innerText = label;
        div.appendChild(labelElem);
        div.appendChild(slider);
        div.appendChild(preview);
        let prefChange = false;

        slider.addEventListener('change', async () => {
            prefChange = true;
            await Pref.setOption(key, slider.value);
            preview.innerText = await pref(key);
        }, false);
        slider.addEventListener('input', () => { preview.innerText = slider.value; }, false)
        updateView();

        Pref.onPreferenceChanged(key, async (key, value) => {
            if(!prefChange) {
                await updateView(value);
            }
            prefChange = false;
        });

        async function updateView() {
            slider.value = await pref(key);
            preview.innerText =  await pref(key);
        }

        return div;
    }

    static _createTwoLineBox(label, secondLine) {
        const wrap = document.createElement('div');
        wrap.classList.add('PMcheckbox_labelwrap');
        const line1 = document.createElement('div');
        line1.classList.add('PMcheckbox_labeltext');
        line1.innerText = label;
        wrap.appendChild(line1);
        const line2 = document.createElement('div');
        line2.classList.add('PMcheckbox_smalltext');
        line2.innerText = secondLine;
        wrap.appendChild(line2);
        return wrap;
    }

}
