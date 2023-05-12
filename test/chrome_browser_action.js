#!/usr/bin/osascript -l JavaScript

// Applescript (JXA) to click on the browser action for ScrollMaps.
// Works on Macs only, obviously.

const app = Application.currentApplication();
app.includeStandardAdditions = true;

clickBrowserAction("ScrollMaps");

function clickBrowserAction(extensionName) {
    const systemEvents = Application("System Events");
    const pid = app.systemAttribute("TEST_PROCESS");
    const chromeProcess = systemEvents.processes.where({ unixId: pid })[0];
    chromeProcess.frontmost = true;
    const toolbar = chromeProcess.windows[0].groups[0].groups[0].groups[0].groups[0].toolbars[0];
    // Uncomment this line to find the extensions button (finding from the entire browser window is slow)
    // dump(findElement(chromeProcess.windows[0], "Extensions")[0]);
    const extensionButton = findInArray(toolbar.popUpButtons, x => x.accessibilityDescription() == "Extensions");
    extensionButton.actions['AXPress'].perform();
    let browserAction = findRecursive(chromeProcess.windows[0], e => e.description() == extensionName);
    browserAction.actions['AXPress'].perform();
}

function findInArray(arr, filter) {
    for (let i = 0; i < arr.length; i++) {
        if (filter(arr[i])) {
            return arr[i];
        }
    }
}

function findRecursive(e, predicate) {
    if (predicate(e)) {
        return e;
    }
    const children = e.uiElements();
    // A normal iteration through e.uiElements doesn't work because
    // the selector returned filters the process by name "Google Chrome"
    // not by the UID.
    const counts = {};
    for (const cls of e.uiElements.class()) {
        if (cls) {
            const i = counts[cls] || 0;
            counts[cls] = i + 1;
            const child = e[cls + 's'][i];
            const result = findRecursive(child, predicate);
            if (result) {
                return result;
            }
        }
    }
}

function findElement(windows, description) {
    for (let i = 0; i < windows.length; i++) {
        const win = windows[0];
        const entireContents = win.entireContents();
        for (const content of entireContents) {
            try {
                if (content.name() == description) {
                    return content;
                }
                if (content.accessibilityDescription() == description) {
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
