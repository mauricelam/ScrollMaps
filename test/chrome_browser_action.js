#!/usr/bin/osascript -l JavaScript

// Applescript (JXA) to click on the browser action for ScrollMaps.
// Works on Macs only, obviously.

const app = Application.currentApplication();
app.includeStandardAdditions = true;

clickBrowserAction("ScrollMaps");

function clickBrowserAction(buttonName) {
    const systemEvents = Application("System Events");
    const pid = parseInt(app.systemAttribute("TEST_PROCESS"), 10);
    const childPid = app.doShellScript('pgrep -P ' + pid);
    const chromeProcess = systemEvents.processes.where({ unixId: childPid })[0];
    chromeProcess.frontmost = true;
    const firstGroup = chromeProcess.windows[0].groups[0];
    const extensionsButton = firstGroup.toolbars[0].popUpButtons.byName('Extensions');
    extensionsButton.actions['AXPress'].perform();
    firstGroup.buttons.byName('ScrollMaps').actions['AXPress'].perform();
}

function dump(obj) {
    const str = Automation.getDisplayString(obj);
    const replaced = str.replace(/"\w+":/g, (g) => "\n" + g)
    console.log(replaced);
}
