(function(){

    let siteStatus = loadSiteStatus();
    const REQUIRED_PERMISSION_ORIGINS = [
        'www.google.com',
        'maps.google.com'
    ];

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

    async function loadSiteStatus() {
        let url = await getTabUrl();
        return await Permission.loadSiteStatus(url);
    }

    $('#site_granted').change(function() {
        siteStatus.then((status) => {
            if (REQUIRED_PERMISSION_ORIGINS.includes(
                    new URL(status.tabUrl).host)) {
                return;
            }
            if ($(this).prop('checked')) {
                chrome.permissions.request({origins: [status.tabUrl]});
            } else {
                chrome.permissions.remove({origins: [status.tabUrl]});
            }
        });
    });
    $('#all_granted').change(function() {
        let allGranted = $(this).prop('checked');
        if (allGranted) {
            chrome.permissions.request({origins: ['<all_urls>']});
        } else {
            chrome.permissions.remove({origins: ['<all_urls>']})
        }
        refreshCheckboxEnabledStates(allGranted);
    });

    function refreshCheckboxEnabledStates(allGranted) {
        $('#site_granted').prop('disabled', allGranted);
        $('label[for=site_granted]').toggleClass('disabled', allGranted);
    }

    $(function(){
        siteStatus.then(status => {
            if (Permission.isMapsSite(status.tabUrl)) {
                $(document.body).addClass('disable-options');
                $('#permissionExplanation').text(
                    'ScrollMaps is enabled on this Google Maps page.');
                return;
            }
            if (status.tabUrl.indexOf('chrome://') === 0) {
                $(document.body).addClass('disable-options');
                $('#permissionExplanation').text(
                    'ScrollMaps cannot be enabled on chrome:// pages');
                return;
            }
            let host = new URL(status.tabUrl).host;
            if (REQUIRED_PERMISSION_ORIGINS.includes(host)) {
                $(document.body).addClass('disable-options');
                $('#permissionExplanation').text(
                    `ScrollMaps is enabled on ${host}`);
                return;
            }

            $('label[for=site_granted] .PMradio_smalltext')
                .text(`Enable ScrollMaps on ${host} without having to click on the extension icon`);

            $('#all_granted').prop('checked', status.isAllGranted);
            $('#site_granted').prop('checked', status.isSiteGranted);
            refreshCheckboxEnabledStates(status.isAllGranted);
        });
    });
})();
