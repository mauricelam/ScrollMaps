// @ts-nocheck
'use strict';

window.SM_INJECT_MAIN = true;
window.SM_INJECT_MAIN = true;

var scrollData = {};

function handleWheelEvent(event) {
  var isVertical = Math.abs(event.deltaY) > Math.abs(event.deltaX);
  var scrollAmount = isVertical ? event.deltaY : event.deltaX;
  if (event.shiftKey) {
    chrome.runtime.sendMessage({
      message: 'scroll',
      direction: 'zoom',
      amount: scrollAmount,
      point: { x: event.clientX, y: event.clientY },
    });
  } else {
    chrome.runtime.sendMessage({
      message: 'scroll',
      direction: isVertical ? 'y' : 'x',
      amount: scrollAmount,
      point: { x: event.clientX, y: event.clientY },
    });
  }
}

function init() {
  chrome.runtime.sendMessage({ message: 'get-scroll-data' }, function (response) {
    scrollData = response.scrollData;
    var pref = response.pref;
    if (pref.enabled) {
      window.addEventListener('wheel', handleWheelEvent, { passive: false, capture: true });
    }
  });
}

init();
