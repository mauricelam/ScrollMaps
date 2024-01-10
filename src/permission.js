const Permission = {
    getPermissions(urls) {
        return new Promise((resolve, reject) => {
            chrome.permissions.contains({'origins': urls}, resolve);
        });
    },
    async loadSiteStatus(url) {
        let [isSiteGrantedResult, isAllGrantedResult] = await Promise.allSettled([
            Permission.getPermissions([url]),
            Permission.getPermissions(['<all_urls>'])
        ]);
        isSiteGranted = isSiteGrantedResult.status === 'fulfilled' && isSiteGrantedResult.value;
        isAllGranted = isAllGrantedResult.status === 'fulfilled' && isAllGrantedResult.value;
        return {
            'tabUrl': url,
            'isSiteGranted': isSiteGranted || Permission.isRequiredPermission(url),
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

    /**
     * Whether permission to the given URL is required (i.e. not user revokable)
     */
    isRequiredPermission(url) {
        // Always false since in Manifest V3 all host permissions are optional.
        // TODO: Refactor this away.
        return false;
    }
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
