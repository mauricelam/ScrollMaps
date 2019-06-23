(function(){

    let siteStatus = loadSiteStatus();

    function getTabUrl() {
        return new Promise((resolve, reject) => {
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                if (tabs) {
                    resolve(tabs[0].url);
                } else {
                    reject('No active tab but browser action received');
                }
            });
        });
    }

    function loadSiteStatus() {
        return getTabUrl().then(url => 
            new Promise((resolve, reject) => {
                chrome.permissions.contains({'origins': [url]},
                    (isSiteGranted) => {
                        chrome.permissions.contains({'origins': ['<all_urls>']},
                            (isAllGranted) => {
                                resolve({
                                    'tabUrl': url,
                                    'isSiteGranted': isSiteGranted,
                                    'isAllGranted': isAllGranted
                                })
                            });
                    });
            }));
    }

    $('input[type=radio][name=permission]').change(function() {
        if (this.value === 'site_granted') {
            siteStatus.then((status) =>
                chrome.permissions.request(
                    {origins: [status.tabUrl]},
                    () => {
                        // Remove only after we have granted the current site
                        chrome.permissions.remove({origins: ['<all_urls>']});
                    }));
        } else if (this.value === 'all_granted') {
            chrome.permissions.request({origins: ['<all_urls>']});
        } else if (this.value === 'not_granted') {
            siteStatus.then((status) =>
                chrome.permissions.remove({
                    origins: [status.tabUrl, '<all_urls>']
                }));
        }
    });

    $(function(){
        siteStatus.then(status => {
            if (status.isAllGranted) {
                $('#all_granted').prop('checked', true);
            } else if (status.isSiteGranted) {
                $('#site_granted').prop('checked', true);
            } else {
                $('#not_granted').prop('checked', true);
            }

            let host = new URL(status.tabUrl).host;
            $('label[for=site_granted] .PMradio_smalltext')
                .text(`Allow ScrollMaps to access ${host}`);
        });
    });
})();
