if (typeof globalThis.chrome === 'undefined') {
  (globalThis as any).chrome = {
    runtime: {
      id: 'jifommjndpnefcfplgnbhabocomgdjjg',
      getManifest: () => ({ version: '10000' }),
    },
  };
}

// JSDOM layout mock for scrollHeight / clientHeight
Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
  configurable: true,
  get() {
    if (this._clientHeight !== undefined) return this._clientHeight;
    if (this === document.documentElement || this === document.body) {
      return window.innerHeight || 768;
    }
    const heightStr = this.style.height;
    if (heightStr && heightStr.endsWith('px')) {
      return parseFloat(heightStr);
    }
    return 0;
  },
  set(val) {
    this._clientHeight = val;
  }
});

Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
  configurable: true,
  get() {
    if (this._scrollHeight !== undefined) return this._scrollHeight;
    let maxChildHeight = this.clientHeight;
    for (const child of this.children) {
      if (child instanceof HTMLElement) {
        maxChildHeight = Math.max(maxChildHeight, child.clientHeight, child.scrollHeight);
      }
    }
    return maxChildHeight;
  },
  set(val) {
    this._scrollHeight = val;
  }
});
