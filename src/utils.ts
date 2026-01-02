export const DEBUG = chrome.runtime.getManifest().version === '10000';

export function sleep(timeout: number): Promise<void> {
  return new Promise((accept, _) => { setTimeout(accept, timeout); });
}