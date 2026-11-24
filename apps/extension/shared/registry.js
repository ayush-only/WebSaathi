/**
 * WebSaathi — Verified Portal Registry (Scam Shield)
 *
 * A curated, hard-coded list of official destinations. The AI is never allowed
 * to produce a URL: at most it may pick a portal *id* from this list, and every
 * navigation is checked against `origins` here.
 *
 * URLs verified on 2026-11-24 against official government / IRCTC pages.
 * Shared by the extension (browser global `WebSaathi.registry`), the backend
 * and the tests (CommonJS).
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  root.WebSaathi = root.WebSaathi || {};
  root.WebSaathi.registry = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /** Port used by the local demo portal (apps/demo-portal). */
  const DEMO_PORT = 5500;

  /**
   * policy:
   *  - 'assist'     → Guide Mode and Assist Mode (form filling after confirmation)
   *  - 'guide-only' → highlight + explain only. Never fills, clicks or submits.
   * Every real portal is guide-only in this prototype: we never send fake
   * grievances to real services and IRCTC's terms prohibit automation.
   */
  const PORTALS = [
    {
      id: 'irctc',
      name: { en: 'IRCTC — Train tickets', hi: 'IRCTC — ट्रेन टिकट', kn: 'IRCTC — ರೈಲು ಟಿಕೆಟ್' },
      purpose: {
        en: 'Official Indian Railways site to search trains and book tickets.',
        hi: 'ट्रेन खोजने और टिकट बुक करने की भारतीय रेल की आधिकारिक वेबसाइट।',
        kn: 'ರೈಲು ಹುಡುಕಲು ಮತ್ತು ಟಿಕೆಟ್ ಬುಕ್ ಮಾಡಲು ಭಾರತೀಯ ರೈಲ್ವೆಯ ಅಧಿಕೃತ ತಾಣ.'
      },
      url: 'https://www.irctc.co.in/nget/train-search',
      origins: ['https://www.irctc.co.in'],
      policy: 'guide-only',
      keywords: { train: 2, ticket: 2, book: 2, booking: 2, irctc: 5, tatkal: 3, pnr: 2, berth: 2, railway: 1, rail: 1,
        'ट्रेन': 2, 'टिकट': 2, 'बुक': 2, 'रेल': 1, 'ರೈಲು': 2, 'ಟಿಕೆಟ್': 2, 'ಬುಕ್': 2 }
    },
    {
      id: 'railmadad',
      name: { en: 'RailMadad — Railway complaints', hi: 'रेल मदद — रेलवे शिकायत', kn: 'ರೈಲ್ ಮದದ್ — ರೈಲ್ವೆ ದೂರು' },
      purpose: {
        en: 'Official Indian Railways portal to file complaints about trains and stations.',
        hi: 'ट्रेन और स्टेशन की शिकायत दर्ज करने का भारतीय रेल का आधिकारिक पोर्टल।',
        kn: 'ರೈಲು ಮತ್ತು ನಿಲ್ದಾಣದ ಬಗ್ಗೆ ದೂರು ಸಲ್ಲಿಸಲು ಭಾರತೀಯ ರೈಲ್ವೆಯ ಅಧಿಕೃತ ಪೋರ್ಟಲ್.'
      },
      url: 'https://railmadad.indianrailways.gov.in/',
      origins: ['https://railmadad.indianrailways.gov.in'],
      policy: 'guide-only',
      keywords: { railmadad: 6, 'rail madad': 6, complaint: 2, complain: 2, coach: 2, station: 1, toilet: 2, dirty: 2,
        railway: 2, rail: 2, train: 1,
        'शिकायत': 2, 'रेलवे': 2, 'रेल': 2, 'ट्रेन': 1, 'ದೂರು': 2, 'ರೈಲ್ವೆ': 2, 'ರೈಲು': 1 }
    },
    {
      id: 'nch',
      name: { en: 'National Consumer Helpline', hi: 'राष्ट्रीय उपभोक्ता हेल्पलाइन', kn: 'ರಾಷ್ಟ್ರೀಯ ಗ್ರಾಹಕ ಸಹಾಯವಾಣಿ' },
      purpose: {
        en: 'Official Government of India portal for consumer complaints (refunds, defective products, services).',
        hi: 'उपभोक्ता शिकायतों (रिफंड, खराब सामान, सेवाएँ) के लिए भारत सरकार का आधिकारिक पोर्टल।',
        kn: 'ಗ್ರಾಹಕ ದೂರುಗಳಿಗೆ (ಮರುಪಾವತಿ, ದೋಷಪೂರಿತ ವಸ್ತು, ಸೇವೆ) ಭಾರತ ಸರ್ಕಾರದ ಅಧಿಕೃತ ಪೋರ್ಟಲ್.'
      },
      url: 'https://consumerhelpline.gov.in/',
      origins: ['https://consumerhelpline.gov.in', 'https://www.consumerhelpline.gov.in'],
      policy: 'guide-only',
      keywords: { consumer: 4, refund: 4, refunded: 4, product: 3, defective: 3, company: 2, seller: 2, shop: 2,
        order: 2, delivery: 2, warranty: 3, complaint: 1, complain: 1,
        'उपभोक्ता': 4, 'कंज्यूमर': 4, 'रिफंड': 4, 'सामान': 2, 'कंपनी': 2, 'शिकायत': 1,
        'ಗ್ರಾಹಕ': 4, 'ಮರುಪಾವತಿ': 4, 'ರಿಫಂಡ್': 4, 'ವಸ್ತು': 2, 'ದೂರು': 1 }
    },
    {
      id: 'cpgrams',
      name: { en: 'CPGRAMS — Public grievances', hi: 'CPGRAMS — लोक शिकायत', kn: 'CPGRAMS — ಸಾರ್ವಜನಿಕ ಕುಂದುಕೊರತೆ' },
      purpose: {
        en: 'Official Government of India portal for grievances about government services and departments.',
        hi: 'सरकारी सेवाओं और विभागों से जुड़ी शिकायतों के लिए भारत सरकार का आधिकारिक पोर्टल।',
        kn: 'ಸರ್ಕಾರಿ ಸೇವೆಗಳು ಮತ್ತು ಇಲಾಖೆಗಳ ಬಗ್ಗೆ ಕುಂದುಕೊರತೆಗೆ ಭಾರತ ಸರ್ಕಾರದ ಅಧಿಕೃತ ಪೋರ್ಟಲ್.'
      },
      url: 'https://pgportal.gov.in/',
      origins: ['https://pgportal.gov.in', 'https://www.pgportal.gov.in'],
      policy: 'guide-only',
      keywords: { cpgrams: 6, government: 3, ministry: 3, department: 3, pension: 3, grievance: 2, 'public grievance': 4,
        office: 1, officer: 2, complaint: 1,
        'सरकारी': 3, 'सरकार': 3, 'विभाग': 3, 'पेंशन': 3, 'शिकायत': 1,
        'ಸರ್ಕಾರ': 3, 'ಸರ್ಕಾರಿ': 3, 'ಇಲಾಖೆ': 3, 'ಪಿಂಚಣಿ': 3, 'ದೂರು': 1 }
    },
    {
      id: 'demo',
      demo: true,
      name: { en: 'WebSaathi Grievance Demo (practice)', hi: 'WebSaathi शिकायत डेमो (अभ्यास)', kn: 'WebSaathi ದೂರು ಡೆಮೊ (ಅಭ್ಯಾಸ)' },
      purpose: {
        en: 'A practice form that runs on your own computer. Not a government website; nothing is sent anywhere.',
        hi: 'आपके कंप्यूटर पर चलने वाला अभ्यास फ़ॉर्म। यह सरकारी वेबसाइट नहीं है; कुछ भी कहीं नहीं भेजा जाता।',
        kn: 'ನಿಮ್ಮ ಕಂಪ್ಯೂಟರ್‌ನಲ್ಲೇ ನಡೆಯುವ ಅಭ್ಯಾಸ ಫಾರ್ಮ್. ಇದು ಸರ್ಕಾರಿ ತಾಣವಲ್ಲ; ಏನನ್ನೂ ಎಲ್ಲಿಗೂ ಕಳುಹಿಸುವುದಿಲ್ಲ.'
      },
      url: 'http://localhost:' + DEMO_PORT + '/',
      origins: ['http://localhost:' + DEMO_PORT, 'http://127.0.0.1:' + DEMO_PORT],
      policy: 'assist',
      keywords: { demo: 6, practice: 5, test: 3, try: 2, 'डेमो': 6, 'अभ्यास': 5, 'ಡೆಮೊ': 6, 'ಅಭ್ಯಾಸ': 5 }
    }
  ];

  const LATIN = /^[a-z0-9 ]+$/;

  function normalise(text) {
    return String(text || '').toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  }

  /** Keyword match. Latin keywords match at a word start ("train" matches "trains", not "restraint"). */
  function hasKeyword(text, kw) {
    if (LATIN.test(kw)) return new RegExp('(^|\\s)' + kw.replace(/ /g, '\\s'), 'u').test(text);
    return text.includes(kw);
  }

  /**
   * Route a free-text goal ("I want to book a train", "mujhe consumer complaint karni hai")
   * to a registry portal. Deterministic; returns null when nothing matches well.
   * @returns {{portal: object, score: number, alternatives: object[]} | null}
   */
  function routeIntent(text) {
    const t = normalise(text);
    if (!t) return null;
    const scored = PORTALS.map((p) => {
      let score = 0;
      for (const [kw, w] of Object.entries(p.keywords)) if (hasKeyword(t, kw)) score += w;
      return { portal: p, score };
    }).filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
    if (!scored.length || scored[0].score < 2) return null;
    return { portal: scored[0].portal, score: scored[0].score, alternatives: scored.slice(1, 3).map((s) => s.portal) };
  }

  function getPortal(id) {
    return PORTALS.find((p) => p.id === id) || null;
  }

  /** Exact-origin lookup. "https://www.irctc.co.in.evil.com" or "http://www.irctc.co.in" do NOT match. */
  function portalForOrigin(origin) {
    if (!origin) return null;
    return PORTALS.find((p) => p.origins.includes(origin)) || null;
  }

  function portalForUrl(url) {
    try { return portalForOrigin(new URL(url).origin); } catch (_) { return null; }
  }

  /**
   * Check a URL before WebSaathi opens it. Only exact registry origins are allowed;
   * real portals must be https.
   */
  function checkNavigation(url) {
    let u;
    try { u = new URL(url); } catch (_) { return { ok: false, reason: 'INVALID_URL' }; }
    const portal = portalForOrigin(u.origin);
    if (!portal) return { ok: false, reason: 'NOT_IN_REGISTRY' };
    if (!portal.demo && u.protocol !== 'https:') return { ok: false, reason: 'NOT_HTTPS' };
    if (u.username || u.password) return { ok: false, reason: 'CREDENTIALS_IN_URL' };
    return { ok: true, portal };
  }

  function displayDomain(portal) {
    return new URL(portal.url).host;
  }

  return { PORTALS, DEMO_PORT, routeIntent, getPortal, portalForOrigin, portalForUrl, checkNavigation, displayDomain, normalise };
});
