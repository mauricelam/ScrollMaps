const Permission = {
    getPermissions(urls) {
        return new Promise((resolve, reject) => {
            chrome.permissions.contains({ 'origins': urls }, resolve);
        });
    },
    async loadSiteStatus(urlString) {
        const url = new URL(urlString);
        let [isSiteGrantedResult, isAllGrantedResult] = await Promise.allSettled([
            Permission.getPermissions([`${url.protocol}//${url.host}/`]),
            Permission.getPermissions(['<all_urls>'])
        ]);
        console.log('Site status: ', url, isSiteGrantedResult, isAllGrantedResult)
        isSiteGranted = isSiteGrantedResult.status === 'fulfilled' && isSiteGrantedResult.value;
        isAllGranted = isAllGrantedResult.status === 'fulfilled' && isAllGrantedResult.value;
        return {
            'tabUrl': urlString,
            'isSiteGranted': isSiteGranted,
            'isAllGranted': isAllGranted
        };
    },

    canInjectIntoPage(url) {
        let protocol = new URL(url).protocol;
        return Permission.isOwnExtensionPage(url) ||
            (protocol !== 'chrome:'
                && protocol !== 'chrome-extension:'
                && protocol !== 'about:'
                && protocol !== 'moz-extension:');
    },

    isOwnExtensionPage(url) {
        return url.indexOf(`chrome-extension://${chrome.runtime.id}`) === 0
            || url.indexOf(`moz-extension://${chrome.runtime.id}`) === 0;
    },

    isMapsSite(url) {
        for (let domain of SCROLLMAPS_DOMAINS) {
            if (_matchPattern(domain, url)) {
                return true;
            }
        }
        return false;
    },

    async requestFramePermission() {
        return await chrome.permissions.request({ origins: ['*://www.google.com/maps/embed'] });
    },
};

const MATCH_PATTERN = /^(\*|http|https|file|ftp):\/\/(\*|(?:\*\.)?[^*/]*)(?:\/(.*))?$/;

function _matchDomainPattern(pattern, url) {
    let regex = pattern.replace(MATCH_PATTERN, (match, scheme, host, path, offset, string) => {
        let result = '';
        if (scheme === '*') {
            result += '(http|https)';
        } else {
            result += scheme;
        }
        result += '://';
        result += host.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&').replace('\\*', '[^\\./]*');
        result += '($|/.*)';
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
        result += host.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&').replace('\\*', '[^\\./]*');
        result += '(/';
        result += path.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&').replace('\\*', '.*');
        result += '|$)';
        return result;
    });
    return !!url.match(regex);
}
