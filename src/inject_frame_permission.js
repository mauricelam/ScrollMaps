if (window.SM_FRAME_INJECT === undefined) {
    const DEBUG = chrome.runtime.getManifest().version === '10000';
    window.SM_FRAME_INJECT = { count: 0 };

    class GoogleMapIframeFinder {
        static findIframeMap() {
            const iframes = document.querySelectorAll('iframe[src^="https://www.google.com/maps/embed"]');
            return iframes;
        }
    }

    async function checkIFramePermissions() {
        const iframes = GoogleMapIframeFinder.findIframeMap();
        for (const frame of iframes) {
            if (!frame.hasAttribute('data-scrollmaps-frame')) {
                const container = document.createElement('div');
                container.style.position = 'relative';
                const shadow = container.attachShadow({ mode: "open" });
                const btn = document.createElement('div');
                btn.classList.add('sm-perm-btn');
                btn.style.backgroundImage = 'url("' + chrome.runtime.getURL('images/permission_icon.png') + '")';
                shadow.appendChild(btn);
                frame.insertAdjacentElement('beforebegin', container);

                const styleSheet = new CSSStyleSheet();
                styleSheet.replaceSync(`
                .sm-perm-btn {
                    position: absolute; top: 0px; right: 0px;
                    width: 24px; height: 24px;
                    margin: 8px;
                    cursor: pointer;
                    background-size: 24px 24px;
                    filter: drop-shadow(0px 2px 8px rgba(0, 0, 0, 0.5));
                }
                .sm-perm-btn:hover:after {
                    content: 'ScrollMaps extension need additional permission to work in this embedded Google Maps';
                    position: absolute; top: 0px; right: 105%;
                    font-size: 16px;
                    width: 250px;
                    padding: 4px;
                    background: rgba(255, 255, 255, 0.9);
                    border: 1px solid #ccc;
                    border-radius: 5px;
                }
                `);
                shadow.adoptedStyleSheets = [styleSheet];

                btn.onclick = () => {
                    chrome.runtime.sendMessage(
                        { action: 'requestIframePermission' },
                        () => btn.remove()
                    );
                };
                frame.setAttribute('data-scrollmaps-frame', '1');
            }
        }
    }

    function poll(func, timeout, count) {
        if (count <= 0) {
            return;
        }
        window.setTimeout(() => {
            if (!func()) {
                poll(func, timeout, count - 1);
            }
        }, timeout);
    }

    // Init
    let lastEventTime = 0;
    const THROTTLE_TIME_MS = 2000;
    window.addEventListener('wheel', async (e) => {
        if (e.timeStamp - lastEventTime > THROTTLE_TIME_MS) {
            await checkIFramePermissions();
            lastEventTime = e.timeStamp;
        }
    }, true);
    poll(checkIFramePermissions, 2000, 3);
}
