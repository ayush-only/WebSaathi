# extension/ — Person 1 (browser agent)
See `AGENTS.md` and `contract/`. Chrome can't load files outside this folder, so the case code is copied in:
`npm run sync:case` → `extension/vendor/case/*.js` (generated; do not edit). Use `WebSaathiCase.createFakeStore()`
until the real store (`createStore()`) lands; the API is identical.
