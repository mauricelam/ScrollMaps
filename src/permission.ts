import SCROLLMAPS_DOMAINS from "domains"

interface SiteStatus {
    tabUrl: string, isSiteGranted: boolean, isAllGranted: boolean,
}

const Permission = {
    getPermissions(urls: string[]): Promise<boolean> {
        return new Promise((resolve, _reject) => {
            chrome.permissions.contains({ 'origins': urls }, resolve);
        });
    },
    async loadSiteStatus(urlString: string): Promise<SiteStatus> {
        const url = new URL(urlString);
        let [isSiteGrantedResult, isAllGrantedResult] = await Promise.allSettled([
            Permission.getPermissions([`${url.protocol}//${url.host}/`]),
            Permission.getPermissions(['<all_urls>'])
        ]);
        console.log('Site status: ', url, isSiteGrantedResult, isAllGrantedResult)
        const isSiteGranted = isSiteGrantedResult.status === 'fulfilled' && isSiteGrantedResult.value;
        const isAllGranted = isAllGrantedResult.status === 'fulfilled' && isAllGrantedResult.value;
        return {
            'tabUrl': urlString,
            'isSiteGranted': isSiteGranted,
            'isAllGranted': isAllGranted
        };
    },

    canInjectIntoPage(url: string): boolean {
        let protocol = new URL(url).protocol;
        return Permission.isOwnExtensionPage(url) ||
            (protocol !== 'chrome:'
                && protocol !== 'chrome-extension:'
                && protocol !== 'about:'
                && protocol !== 'moz-extension:');
    },

    isOwnExtensionPage(url: string): boolean {
        return url.indexOf(`chrome-extension://${chrome.runtime.id}`) === 0
            || url.indexOf(`moz-extension://${chrome.runtime.id}`) === 0;
    },

    isMapsSite(url: string): boolean {
        for (const domain of SCROLLMAPS_DOMAINS) {
            if (_matchPattern(domain, url)) {
                return true;
            }
        }
        return false;
    },

    async requestFramePermission(): Promise<boolean> {
        return await chrome.permissions.request({ origins: ['*://www.google.com/maps/embed'] });
    },
};

export default Permission;

const MATCH_PATTERN = /^(\*|http|https|file|ftp):\/\/(\*|(?:\*\.)?[^*/]*)(?:\/(.*))?$/;

function _matchPattern(pattern: string, url: string): boolean {
    let regex = pattern.replace(MATCH_PATTERN, (_match, scheme, host, path, _offset, _string) => {
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
