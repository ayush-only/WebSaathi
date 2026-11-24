# Security and privacy design

## Threats considered

| Threat | Mitigation |
|---|---|
| Phishing / look-alike sites | Navigation only to exact registry origins over HTTPS; domain shown before opening; warning when the user leaves a verified origin. The AI can only ever propose element ids, never URLs. |
| AI makes a harmful action | The model proposes one structured action; `schema.js` drops unknown keys and rejects unknown types; `safety.js` blocks/handoffs/downgrades; there is no click/submit/navigate action at all. |
| Prompt injection from webpage text | Page text is sent to the model only as `<untrusted_page_data>`; validation is deterministic and ignores page text; a field whose label mentions OTP/password is treated as sensitive. Tested in `tests/browser/content-script.test.js`. |
| Secrets leaving the browser | Scanner never reads values; `redact.js` removes Aadhaar-, card-, OTP-/PIN-like numbers and password phrases before any request; backend redacts again and does not log bodies; answers that look like secrets are never sent or filled. |
| Model fabricating personal data | A model-proposed `FILL_FIELD` becomes `ASK_QUESTION`; values come only from the user and are shown for confirmation. |
| Acting on the wrong page | Every action carries `expectedOrigin`; the content script re-checks the live origin, re-reads the element, and checks visibility right before executing. |
| Web page talking to the content script | Messages are accepted only from this extension's own pages (`sender.id` + `chrome-extension://<id>/` URL). Content script is inactive on non-registry origins. |
| Key exposure | AWS/ElevenLabs keys only in backend env (`.env` git-ignored); extension contains no secrets; `scripts/check.js` scans for common key patterns. |
| Extension attack surface | MV3, strict CSP (`script-src 'self'`), no `eval`/remote code, permissions `sidePanel`, `storage`, `scripting`; host access limited to registry sites and localhost. |

## Data handling

- Stored: language and read-aloud preference in `chrome.storage.local`. Nothing else.
- In memory only: the last scan (labels, no values) in the side panel; the previous value of the last filled field in the page (for Undo).
- Sent to the backend (only if you run it): redacted labels/kinds/options/errors of visible controls, the mode, language, and — for answer interpretation — the user's answer to a non-sensitive question.
- Sent to AWS Bedrock / ElevenLabs: the above, from the backend, under your own AWS/ElevenLabs accounts and their terms.

## Not production-ready yet

Needed before real users: authenticated backend (per-install tokens), HTTPS deployment, persistent rate limiting and abuse monitoring, Bedrock guardrails, a formal privacy review/policy, native-speaker review of Hindi/Kannada, accessibility audit with real users (screen readers, low vision), and Chrome Web Store review.
