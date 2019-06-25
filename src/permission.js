let Permission = {};

Permission.getPermissions = function (urls) {
    return new Promise((resolve, reject) => {
        chrome.permissions.contains({'origins': urls}, resolve);
    });
}

Permission.loadSiteStatus = async function (url) {
    let [isSiteGranted, isAllGranted] = await Promise.all([
        Permission.getPermissions([url]),
        Permission.getPermissions(['<all_urls>'])
    ]);
    return {
        'tabUrl': url,
        'isSiteGranted': isSiteGranted || Permission.isMapsSite(url),
        'isAllGranted': isAllGranted
    };
}

Permission.isMapsSite = function (urlString) {
    let url = new URL(urlString);
    if (url.host === 'maps.google.com') {
        return true;
    }
    if (url.host === 'google.com' || url.host === 'www.google.com') {
        return url.pathname.indexOf('/maps/') === 0;
    }
    return false;
}
