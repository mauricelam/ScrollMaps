(function(){

    const DEBUG = chrome.runtime.getManifest().version === '10000';
    const siteStatus = loadSiteStatus();

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
        return await Permission.loadSiteStatus(await getTabUrl());
    }

    $('#reload').on('click', () => {
        chrome.runtime.reload();
    });
    $('#reload').toggle(DEBUG);

    $('#options').on('click', () => {
        chrome.runtime.openOptionsPage();
        window.close();
        return false;
    });

    $('#site_granted').change(function() {
        siteStatus.then((status) => {
            if (Permission.isRequiredPermission(status.tabUrl)) {
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
        $('#site_granted').prop('checked', allGranted);
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

    $(async () => {
        const status = await siteStatus;
        if (Permission.isMapsSite(status.tabUrl)) {
            $(document.body).addClass('disable-options');
            $('#permissionExplanation').text(
                'ScrollMaps is enabled on this Google Maps page.');
            return;
        }
        let protocol = new URL(status.tabUrl).protocol;
        if (protocol === 'chrome:' || protocol === 'chrome-extension:'
            || protocol === 'about:' || protocol === 'moz-extension:') {
            $(document.body).addClass('disable-options');
            $('#permissionExplanation').text(
                `ScrollMaps cannot be enabled on "${protocol}" pages`);
            return;
        }
        let host = new URL(status.tabUrl).host;
        if (Permission.isRequiredPermission(status.tabUrl)) {
            $(document.body).addClass('disable-options');
            $('#permissionExplanation').text(
                `ScrollMaps is enabled on ${host}`);
            return;
        }

        $('label[for=site_granted] .PMcheckbox_smalltext')
            .text(`Enable ScrollMaps on ${host} without having to click on the extension icon`);

        $('#all_granted').prop('checked', status.isAllGranted);
        $('#site_granted').prop('checked', status.isSiteGranted);
        refreshCheckboxEnabledStates(status.isAllGranted);
    });
})();
