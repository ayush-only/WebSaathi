/*
 * Kept for compatibility: the fake store is now the real store on an in-memory adapter.
 * Use WebSaathiCase.createFakeStore() (tests) or WebSaathiCase.createStore() (extension, chrome.storage.local).
 */
(function (root) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = require('./case-store.js');
  else if (!root.WebSaathiCase || !root.WebSaathiCase.createFakeStore) {
    throw new Error('Load case-store.js before fake-store.js');
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
