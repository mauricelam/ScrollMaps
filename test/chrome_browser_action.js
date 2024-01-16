#!/usr/bin/osascript -l JavaScript

// Applescript (JXA) to click on the browser action for ScrollMaps.
// Works on Macs only, obviously.

const app = Application.currentApplication();
app.includeStandardAdditions = true;

clickBrowserAction("ScrollMaps");

function clickBrowserAction(extensionName) {
    const systemEvents = Application("System Events");
    const pid = app.systemAttribute("TEST_PROCESS");
    const browser = app.systemAttribute("BROWSER");
    const chromeProcess = systemEvents.processes.where({ unixId: pid })[0];
    chromeProcess.frontmost = true;
    let extensionButton;
    if (browser === 'chrome') {
        const toolbar = chromeProcess.windows[0].groups[0].groups[0].groups[0].groups[0].toolbars[0];
        // Uncomment this line to find the extensions button (finding from the entire browser window is slow)
        // dump(findElement(chromeProcess.windows[0], "Extensions")[0]);
        extensionButton = findInArray(toolbar.popUpButtons, x => x.accessibilityDescription() == "Extensions");
    } else if (browser === 'edge') {
        const toolbar = chromeProcess.windows[0].groups[0].groups[0].groups[0].groups[0].toolbars[0];
        // Uncomment this line to find the extensions button (finding from the entire browser window is slow)
        // dump(findElement(chromeProcess.windows[0], "Extensions")[0]);
        extensionButton = findInArray(flatMap(toolbar.groups, (g) => g.buttons), x => x.accessibilityDescription() == "Extensions");
    }
    if (typeof extensionButton !== 'function') {
        console.log('Cannot find extension button');
    }
    extensionButton.actions['AXPress'].perform();
    let browserAction = findRecursive(chromeProcess.windows[0], e => e.description() == extensionName, "button");
    if (typeof browserAction !== 'function') {
        console.log('Cannot find browser action button');
    }
    browserAction.actions['AXPress'].perform();
}

function flatMap(arr, mapFn) {
    const result = [];
    for (let i = 0; i < arr.length; i++) {
        let mapResult = mapFn(arr[i]) || [];
        for (let j = 0; j < mapResult.length; j++) {
            result.push(mapResult[j]);
        }
    }
    return result;
}

function findInArray(arr, filter) {
    for (let i = 0; i < arr.length; i++) {
        if (filter(arr[i])) {
            return arr[i];
        }
    }
}

function findRecursive(e, predicate, predicateclass, eclass) {
    try {
        if (predicateclass && eclass && eclass === predicateclass && predicate(e)) {
            return e;
        }
    } catch (e) {
        console.log('Failed to run predicate', e);
        return undefined;
    }
    // A normal iteration through e.uiElements doesn't work because
    // the selector returned filters the process by name "Google Chrome"
    // not by the UID.
    const counts = {};
    for (const cls of e.uiElements.class()) {
        if (cls) {
            const i = counts[cls] || 0;
            counts[cls] = i + 1;
            const child = e[pluralize(cls)][i];
            const result = findRecursive(child, predicate, predicateclass, cls);
            if (result) {
                return result;
            }
        }
    }
}

function pluralize(cls) {
    if (cls === 'checkbox') return 'checkboxes';
    return cls + 's';
}

function findElement(windows, description) {
    for (let i = 0; i < windows.length; i++) {
        const win = windows[i];
        const entireContents = win.entireContents();
        for (const content of entireContents) {
            try {
                if (content.name() === description) {
                    return content;
                }
                if (content.accessibilityDescription() === description) {
                    return content;
                }
            } catch (e) {
                console.log('Error getting description of UI element', e, "for", Automation.getDisplayString(content));
            }
        }
    }
}

function dumpcontents(obj) {
    for (const x of obj.entireContents()) {
        console.log("================");
        dumpprops(x)
        console.log(">>>>>>>>>>>>>>>>");
    }
}

function dumpprops(obj) {
    if (!('properties' in obj)) return;
    const props = obj.properties();
    for (const k in props) {
        console.log(k, " = ", props[k]);
    }
}

function dump(obj) {
    const str = Automation.getDisplayString(obj);
    const replaced = str.replace(/"\w+":/g, (g) => "\n" + g)
    console.log(replaced);
}
