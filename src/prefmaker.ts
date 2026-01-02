/** Create views or widgets to toggle certain preference values. */

import Permission from "./permission";
import PrefManager, { pref } from "./pref";

type SecondLine = string | { enabled: string, disabled: string };

export class PrefMaker {

    static makePermissionCheckbox(key: string, origin: string, label: string, secondLine: SecondLine): HTMLDivElement {
        let labelDiv: HTMLDivElement;
        if (typeof secondLine === 'string') {
            labelDiv = this._createTwoLineBox(label, secondLine);
        } else if (typeof secondLine === 'object') {
            labelDiv = this._createTwoLineBox(label, secondLine.disabled);
        }
        const div = document.createElement('div');
        div.classList.add('PMcheckbox');
        const box = document.createElement('input');
        box.id = 'PMcheckbox_' + key;
        box.type = 'checkbox';
        const labelElem = document.createElement('label');
        labelElem.htmlFor = 'PMcheckbox_' + key;
        labelElem.appendChild(labelDiv);
        div.appendChild(box);
        div.appendChild(labelElem);
        box.addEventListener('change', updateOption, false);
        updateView();

        function updateOption() {
            if (box.checked) {
                chrome.permissions.request({ origins: [origin] }, () => updateView());
            } else {
                chrome.permissions.remove({ origins: [origin] }, () => updateView());
            }
        }
        async function updateView(): Promise<void> {
            const permission = await Permission.getPermissions([origin]);
            box.checked = permission;
            if (typeof secondLine === 'object') {
                const elem = labelDiv.querySelector('.PMcheckbox_smalltext') as HTMLElement
                elem.innerText = permission ? secondLine.enabled : secondLine.disabled
            }
        }
        chrome.permissions.onAdded.addListener(updateView);
        chrome.permissions.onRemoved.addListener(updateView);

        return div;
    }

    static makeBooleanCheckbox(key: string, label: string, secondLine: SecondLine): HTMLDivElement {
        let labelDiv: HTMLDivElement;
        if (typeof secondLine === 'string') {
            labelDiv = this._createTwoLineBox(label, secondLine);
        } else if (typeof secondLine === 'object') {
            labelDiv = this._createTwoLineBox(label, secondLine.disabled);
        }
        const div = document.createElement('div');
        div.classList.add('PMcheckbox');
        const box = document.createElement('input');
        box.id = 'PMcheckbox_' + key;
        box.type = 'checkbox';
        const labelElem = document.createElement('label');
        labelElem.htmlFor = box.id;
        labelElem.appendChild(labelDiv);
        div.appendChild(box);
        div.appendChild(labelElem);
        box.addEventListener('change', updateOption, false);
        updateView(false);

        let prefChange = false;
        PrefManager.onPreferenceChanged(key, async (_key, _value) => {
            await updateView(prefChange);
            prefChange = false;
        });

        function updateOption() {
            prefChange = true;
            PrefManager.setOption(key, box.checked);
        }
        async function updateView(prefChange: boolean) {
            const prefValue = await pref(key);
            if (!prefChange) {
                box.checked = prefValue;
            }
            if (typeof secondLine === 'object') {
                (labelElem.querySelector('.PMcheckbox_smalltext') as HTMLElement).innerText =
                    prefValue ? secondLine.enabled : secondLine.disabled;
            }
        }

        return div;
    }

    static makeSlider(key: string, label: string, max: string, min: string, step: string): HTMLDivElement {
        step = step || '1';
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
            await PrefManager.setOption(key, slider.value);
            preview.innerText = await pref(key);
        }, false);
        slider.addEventListener('input', () => { preview.innerText = slider.value; }, false)
        updateView();

        PrefManager.onPreferenceChanged(key, async (_key, _value) => {
            if (!prefChange) {
                await updateView();
            }
            prefChange = false;
        });

        async function updateView() {
            slider.value = await pref(key);
            preview.innerText = await pref(key);
        }

        return div;
    }

    static _createTwoLineBox(label: string, secondLine: string): HTMLDivElement {
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
