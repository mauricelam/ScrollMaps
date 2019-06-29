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

Permission.isMapsSite = function (url) {
    for (let domain of SCROLLMAPS_DOMAINS) {
        if (_matchPattern(domain, url)) {
            return true;
        }
    }
    return false;
}

const MATCH_PATTERN = /^(\*|http|https|file|ftp):\/\/(\*|(?:\*\.)?[^*/]*)(?:\/(.*))?$/;

Permission.isRequiredPermission = function (url) {
    for (let domain of SCROLLMAPS_DOMAINS) {
        if (_matchDomainPattern(domain, url)) {
            return true;
        }
    }
    return false;
}

function _matchDomainPattern(pattern, url) {
    let regex = pattern.replace(MATCH_PATTERN, (match, scheme, host, path, offset, string) => {
        let result = '';
        if (scheme === '*') {
            result += '(http|https)';
        } else {
            result += scheme;
        }
        result += '://';
        result += host.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&').replace('\\*', '[^\./]*');
        result += '.*';
        return result;
    });
    return !!url.match(regex);
}

function _matchPattern(pattern, url) {
    let regex = pattern.replace(MATCH_PATTERN, (match, scheme, host, path, offset, string) => {
        let result = '';
        if (scheme === '*') {
            result += '(http|https)';
        } else {
            result += scheme;
        }
        result += '://';
        result += host.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&').replace('\\*', '[^\./]*');
        result += '(/';
        result += path.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&').replace('\\*', '.*');
        result += ')?';
        return result;
    });
    return !!url.match(regex);
}
