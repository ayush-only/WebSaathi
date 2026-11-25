# Roadmap

**Before the ideathon (26–27 Nov)**
- Run Live AI mode against real AWS Bedrock; tune the planning prompt on the demo form and IRCTC search page.
- Test ElevenLabs spoken guidance in English and Hindi; choose a voice.
- Manually verify microphone input (`en-IN`, `hi-IN`, `kn-IN`) in Chrome.
- Native-speaker review of Hindi and Kannada strings.
- Record the video pitch from the demo guide.

**Next**
- Playbooks currently rely on the user pressing *Done — next step*; detect progress (results page, passenger page, payment page) per site, and test the label finder on the live travel pages (custom widgets differ per site). Chooser for sites opened without a task is implemented but has no browser test yet.
- Travel: safe *search-form assist* (from / to / date / travellers) on travel sites behind the existing confirm step, with adapters for their autocomplete and date-picker widgets; plain-language explanations of fare types, baggage, cancellation rules and pre-ticked add-ons; payment always handed to the user. Needs hands-on testing on the live sites and a check of each site's terms before any automation.
- Banking: **not started on purpose.** Guide-only explanations and look-alike-site / scam warnings first, activated only on the user's click, after a dedicated security and privacy review.
- Manual check of the Goibibo, Yatra and redBus origins; add more airlines and state bus corporations.
- Kannada voice (input/output) once verified.
- Portal adapters for custom widgets (IRCTC date picker and station autocomplete — guide only).
- More verified portals: National Scholarship Portal, DigiLocker, bank grievance portals, state e-governance services.
- In-browser WASM image/PDF resizer for strict upload limits (e.g. 200KB).
- Accessibility study with senior citizens; larger text presets; slower speech.
- Mobile path (Chrome on Android does not run extensions): companion app / accessibility-service approach.
