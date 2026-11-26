# extension/ — Person 1 (browser agent)
See `AGENTS.md` and `contract/`. Use `case/fake-store.js` until the real store lands; load it in the side panel with
`<script src="../case/fake-store.js">` is not possible from outside the extension folder, so **copy** `case/*.js` into
`extension/case/` with the script `npm run sync:case` (Person 2 will add it), or for now copy by hand.
