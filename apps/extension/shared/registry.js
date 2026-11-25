/**
 * WebSaathi — Verified Portal Registry (Scam Shield)
 *
 * A curated, hard-coded list of official destinations. The AI is never allowed
 * to produce a URL: at most it may pick a portal *id* from this list, and every
 * navigation is checked against `origins` here.
 *
 * Origins checked against official sources on 2026-11-24/25: IRCTC, RailMadad, National Consumer
 * Helpline, CPGRAMS, AirSewa (linked from civilaviation.gov.in), NTES (enquiry.indianrail.gov.in),
 * MakeMyTrip and ixigo. Goibibo, Yatra and redBus use their well-known brand domains and still need
 * one manual check before a public release.
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
   * Government and railway portals are guide-only: we never send fake grievances to real
   * services and IRCTC's terms prohibit automation. Private travel sites (kind 'travel') are
   * 'assist': the user confirms each fill or click, and payment, OTP, passwords, cards and UPI
   * are never touched (see safety.js).
   */
  const PORTALS = [
    {
      id: 'irctc',
      kind: 'railway',
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
      kind: 'railway',
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
      kind: 'gov',
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
      kind: 'gov',
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
      id: 'airsewa',
      kind: 'gov',
      name: { en: 'AirSewa — Flight complaints', hi: 'एयरसेवा — उड़ान शिकायत', kn: 'ಏರ್‌ಸೇವಾ — ವಿಮಾನ ದೂರು' },
      purpose: {
        en: 'Ministry of Civil Aviation portal to file and track complaints about airlines and airports.',
        hi: 'एयरलाइन और हवाई अड्डे की शिकायत दर्ज करने और ट्रैक करने का नागर विमानन मंत्रालय का पोर्टल।',
        kn: 'ವಿಮಾನಯಾನ ಸಂಸ್ಥೆ ಮತ್ತು ವಿಮಾನ ನಿಲ್ದಾಣದ ದೂರು ಸಲ್ಲಿಸಲು ಮತ್ತು ಟ್ರ್ಯಾಕ್ ಮಾಡಲು ನಾಗರಿಕ ವಿಮಾನಯಾನ ಸಚಿವಾಲಯದ ಪೋರ್ಟಲ್.'
      },
      url: 'https://airsewa.gov.in/',
      origins: ['https://airsewa.gov.in'],
      policy: 'guide-only',
      keywords: { airsewa: 6, flight: 3, airline: 3, airport: 3, baggage: 3, luggage: 3, delayed: 1, cancelled: 1,
        indigo: 3, 'air india': 3, spicejet: 3, akasa: 3,
        'उड़ान': 3, 'फ्लाइट': 3, 'विमान': 3, 'एयरलाइन': 3, 'हवाई अड्डा': 3, 'सामान': 1,
        'ವಿಮಾನ': 3, 'ಫ್ಲೈಟ್': 3, 'ಏರ್‌ಲೈನ್': 3, 'ವಿಮಾನ ನಿಲ್ದಾಣ': 3 }
    },
    {
      id: 'ntes',
      kind: 'railway',
      name: { en: 'NTES — Live train status', hi: 'NTES — ट्रेन की लाइव स्थिति', kn: 'NTES — ರೈಲಿನ ಲೈವ್ ಸ್ಥಿತಿ' },
      purpose: {
        en: 'Indian Railways National Train Enquiry System: where is my train, schedules, trains between stations.',
        hi: 'भारतीय रेल की राष्ट्रीय ट्रेन पूछताछ प्रणाली: मेरी ट्रेन कहाँ है, समय-सारणी, दो स्टेशनों के बीच की ट्रेनें।',
        kn: 'ಭಾರತೀಯ ರೈಲ್ವೆಯ ರಾಷ್ಟ್ರೀಯ ರೈಲು ವಿಚಾರಣಾ ವ್ಯವಸ್ಥೆ: ನನ್ನ ರೈಲು ಎಲ್ಲಿದೆ, ವೇಳಾಪಟ್ಟಿ, ಎರಡು ನಿಲ್ದಾಣಗಳ ನಡುವಿನ ರೈಲುಗಳು.'
      },
      url: 'https://enquiry.indianrail.gov.in/ntes/',
      origins: ['https://enquiry.indianrail.gov.in'],
      policy: 'guide-only',
      keywords: { ntes: 6, running: 3, live: 2, 'spot your train': 5, delayed: 1, late: 1, 'where is my train': 5, schedule: 2,
        timetable: 2, train: 1, 'ट्रेन कहाँ': 4, 'लाइव': 2, 'ರೈಲು ಎಲ್ಲಿ': 4, 'ಲೈವ್': 2 }
    },
    {
      id: 'makemytrip',
      kind: 'travel',
      name: { en: 'MakeMyTrip — Flights, hotels, buses', hi: 'MakeMyTrip — फ्लाइट, होटल, बस', kn: 'MakeMyTrip — ವಿಮಾನ, ಹೋಟೆಲ್, ಬಸ್' },
      purpose: {
        en: 'Private travel company website to book flights, hotels, buses and trains.',
        hi: 'फ्लाइट, होटल, बस और ट्रेन बुक करने की निजी ट्रैवल कंपनी की वेबसाइट।',
        kn: 'ವಿಮಾನ, ಹೋಟೆಲ್, ಬಸ್ ಮತ್ತು ರೈಲು ಬುಕ್ ಮಾಡಲು ಖಾಸಗಿ ಪ್ರಯಾಣ ಕಂಪನಿಯ ತಾಣ.'
      },
      url: 'https://www.makemytrip.com/',
      origins: ['https://www.makemytrip.com'],
      policy: 'assist',
      keywords: { makemytrip: 6, mmt: 5 }
    },
    {
      id: 'goibibo',
      kind: 'travel',
      name: { en: 'Goibibo — Flights, hotels, buses', hi: 'Goibibo — फ्लाइट, होटल, बस', kn: 'Goibibo — ವಿಮಾನ, ಹೋಟೆಲ್, ಬಸ್' },
      purpose: {
        en: 'Private travel company website to book flights, hotels, buses and trains.',
        hi: 'फ्लाइट, होटल, बस और ट्रेन बुक करने की निजी ट्रैवल कंपनी की वेबसाइट।',
        kn: 'ವಿಮಾನ, ಹೋಟೆಲ್, ಬಸ್ ಮತ್ತು ರೈಲು ಬುಕ್ ಮಾಡಲು ಖಾಸಗಿ ಪ್ರಯಾಣ ಕಂಪನಿಯ ತಾಣ.'
      },
      url: 'https://www.goibibo.com/',
      origins: ['https://www.goibibo.com'],
      policy: 'assist',
      keywords: { goibibo: 6 }
    },
    {
      id: 'yatra',
      kind: 'travel',
      name: { en: 'Yatra — Flights, hotels, buses', hi: 'Yatra — फ्लाइट, होटल, बस', kn: 'Yatra — ವಿಮಾನ, ಹೋಟೆಲ್, ಬಸ್' },
      purpose: {
        en: 'Private travel company website to book flights, hotels, buses and trains.',
        hi: 'फ्लाइट, होटल, बस और ट्रेन बुक करने की निजी ट्रैवल कंपनी की वेबसाइट।',
        kn: 'ವಿಮಾನ, ಹೋಟೆಲ್, ಬಸ್ ಮತ್ತು ರೈಲು ಬುಕ್ ಮಾಡಲು ಖಾಸಗಿ ಪ್ರಯಾಣ ಕಂಪನಿಯ ತಾಣ.'
      },
      url: 'https://www.yatra.com/',
      origins: ['https://www.yatra.com'],
      policy: 'assist',
      keywords: { yatra: 6 }
    },
    {
      id: 'ixigo',
      kind: 'travel',
      name: { en: 'ixigo — Flights, trains, buses, hotels', hi: 'ixigo — फ्लाइट, ट्रेन, बस, होटल', kn: 'ixigo — ವಿಮಾನ, ರೈಲು, ಬಸ್, ಹೋಟೆಲ್' },
      purpose: {
        en: 'Private travel company website for flights, trains, buses and hotels, with PNR and train running status.',
        hi: 'फ्लाइट, ट्रेन, बस और होटल के लिए निजी ट्रैवल कंपनी की वेबसाइट; PNR और ट्रेन की लाइव स्थिति भी।',
        kn: 'ವಿಮಾನ, ರೈಲು, ಬಸ್ ಮತ್ತು ಹೋಟೆಲ್‌ಗಾಗಿ ಖಾಸಗಿ ಪ್ರಯಾಣ ಕಂಪನಿಯ ತಾಣ; PNR ಮತ್ತು ರೈಲಿನ ಲೈವ್ ಸ್ಥಿತಿಯೂ ಇದೆ.'
      },
      url: 'https://www.ixigo.com/',
      origins: ['https://www.ixigo.com'],
      policy: 'assist',
      keywords: { ixigo: 6 }
    },
    {
      id: 'redbus',
      kind: 'travel',
      name: { en: 'redBus — Bus tickets', hi: 'redBus — बस टिकट', kn: 'redBus — ಬಸ್ ಟಿಕೆಟ್' },
      purpose: {
        en: 'Private website to book intercity bus tickets.',
        hi: 'शहरों के बीच बस टिकट बुक करने की निजी वेबसाइट।',
        kn: 'ನಗರಗಳ ನಡುವಿನ ಬಸ್ ಟಿಕೆಟ್ ಬುಕ್ ಮಾಡಲು ಖಾಸಗಿ ತಾಣ.'
      },
      url: 'https://www.redbus.in/',
      origins: ['https://www.redbus.in'],
      policy: 'assist',
      keywords: { redbus: 6, 'red bus': 6 }
    },
    {
      id: 'demo',
      kind: 'demo',
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
