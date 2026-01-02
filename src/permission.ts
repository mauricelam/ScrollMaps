// @ts-nocheck
'use strict';

function getGrantedUrls(callback) {
  chrome.permissions.getAll(function (permissions) {
    callback(permissions.origins);
  });
}

// given a url, find a matching url in a list of granted urls
function findMatchingGrantedUrl(url, grantedUrls) {
  var urlHostname = new URL(url).hostname;
  return grantedUrls.find(function (grantedUrl) {
    var grantedHostname = new URL(grantedUrl.replace('*://', 'http://')).hostname.replace('*.', '');
    return urlHostname.endsWith(grantedHostname);
  });
}

var isSiteGranted = false;
var isAllGranted = false;
getGrantedUrls(function (urls) {
  isSiteGranted = findMatchingGrantedUrl(window.location.href, urls) !== undefined;
  isAllGranted = urls.findIndex(url => url === '*://*/*') !== -1;
});

chrome.permissions.onAdded.addListener(function (permissions) {
  isSiteGranted = isSiteGranted || findMatchingGrantedUrl(window.location.href, permissions.origins) !== undefined;
  isAllGranted = isAllGranted || permissions.origins.findIndex(url => url === '*://*/*') !== -1;
});
chrome.permissions.onRemoved.addListener(function (permissions) {
  isSiteGranted = isSiteGranted && findMatchingGrantedUrl(window.location.href, permissions.origins) === undefined;
  isAllGranted = isAllGranted && permissions.origins.findIndex(url => url === '*://*/*') === -1;
});

function isSiteOnPermissionList(url, callback) {
  getGrantedUrls(function (urls) {
    if (urls.findIndex(u => u === '<all_urls>') !== -1 ||
      urls.findIndex(u => u === '*://*/*') !== -1) {
      callback(true);
      return;
    }
    var matching = findMatchingGrantedUrl(url, urls);
    callback(matching !== undefined);
  });
}

function removeUrlFromPermissionList(url, callback) {
  getGrantedUrls(function (grantedUrls) {
    var matchingUrl = findMatchingGrantedUrl(url, grantedUrls);
    if (matchingUrl) {
      chrome.permissions.remove({ origins: [matchingUrl] }, function (removed) {
        callback(removed);
      });
    }
  });
}

function addUrlToPermissionList(url, callback) {
  var suggestedPermission = getSuggestedPermission(url);
  chrome.permissions.request({ origins: [suggestedPermission] }, function (granted) {
    callback(granted);
  });
}

function getSuggestedPermission(url) {
  var domains = SCROLLMAPS_DOMAINS.map(domain => domain.replace(/.*:\/\//, ''));
  var matchingDomain = domains.find(domain => urlUrlMatchesPermission(domain, url));
  if (matchingDomain) {
    return `*://${matchingDomain}*`;
  }
  return `*://${new URL(url).hostname}/*`;
}

function urlMatchesPermission(permission, url) {
  if (permission === '<all_urls>') {
    return true;
  }
  return new RegExp(permission.replace(/\*/g, '.*')).test(url);
}

// A more robust way to check if a url matches a permission.
// The manifest match pattern spec is here:
// https://developer.chrome.com/docs/extensions/mv3/match_patterns/
function urlUrlMatchesPermission(pattern, url) {
  // scheme://host/path
  var patternMatch = pattern.match(/(.*):\/\/(.*?)(\/.*)/);
  var urlMatch = url.match(/(.*):\/\/(.*?)\/(.*)/);

  if (!urlMatch) {
    return false;
  }
  if (patternMatch[1] !== '*' && patternMatch[1] !== urlMatch[1]) {
    return false;
  }
  if (patternMatch[2] !== '*' && patternMatch[2] !== urlMatch[2]) {
    if (patternMatch[2].startsWith('*.')) {
      if (!urlMatch[2].endsWith(patternMatch[2].substring(1))) {
        return false;
      }
    } else {
      return false;
    }
  }
  if (patternMatch[3] !== '/*' && patternMatch[3] !== ('/' + urlMatch[3])) {
    return false;
  }
  return true;
}
