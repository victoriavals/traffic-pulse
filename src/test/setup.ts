import "@testing-library/jest-dom";

// ── matchMedia polyfill (jsdom does not implement this API) ──────────────────
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// ── localStorage polyfill ────────────────────────────────────────────────────
// jsdom's built-in localStorage can be absent or incomplete in some Vitest
// configurations. A plain-object implementation guarantees consistent
// behaviour (getItem / setItem / removeItem / clear) across all tests.
const _localStorageStore: Record<string, string> = {};
const localStorageMock: Storage = {
  getItem: (key: string) => _localStorageStore[key] ?? null,
  setItem: (key: string, value: string) => { _localStorageStore[key] = String(value); },
  removeItem: (key: string) => { delete _localStorageStore[key]; },
  clear: () => { Object.keys(_localStorageStore).forEach((k) => delete _localStorageStore[k]); },
  get length() { return Object.keys(_localStorageStore).length; },
  key: (index: number) => Object.keys(_localStorageStore)[index] ?? null,
};

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  writable: true,
});
