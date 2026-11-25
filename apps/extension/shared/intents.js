/**
 * WebSaathi — Task catalogue and intent matcher (the "what do you want to do?" launcher).
 *
 * Maps what the user says or taps ("book a flight", "mera PNR status", "railway complaint")
 * to a task, and each task to the verified portals WebSaathi can guide on. It never produces a
 * URL: it only returns registry portal ids. Deterministic, no network, no AI.
 *
 * Hindi and Kannada labels and checklists are drafts pending native-speaker review.
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const deps = { registry: isNode ? require('./registry.js') : root.WebSaathi.registry };
  const mod = factory(deps);
  if (isNode) module.exports = mod;
  root.WebSaathi = root.WebSaathi || {};
  root.WebSaathi.intents = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (deps) {
  'use strict';
  const registry = deps.registry;

  const CATEGORIES = [
    { id: 'book', icon: '🎫', label: { en: 'Book a ticket or stay', hi: 'टिकट या ठहरना बुक करें', kn: 'ಟಿಕೆಟ್ ಅಥವಾ ವಾಸ್ತವ್ಯ ಬುಕ್ ಮಾಡಿ' } },
    { id: 'complaint', icon: '📝', label: { en: 'Make a complaint', hi: 'शिकायत दर्ज करें', kn: 'ದೂರು ನೀಡಿ' } },
    { id: 'status', icon: '🔎', label: { en: 'Check status', hi: 'स्थिति देखें', kn: 'ಸ್ಥಿತಿ ನೋಡಿ' } },
    { id: 'cancel', icon: '↩️', label: { en: 'Cancel or refund', hi: 'रद्द करें या रिफंड', kn: 'ರದ್ದು ಅಥವಾ ಮರುಪಾವತಿ' } }
  ];

  /**
   * Verbs: words that say WHAT KIND of job it is (book / complain / check / cancel).
   * Each task also has its own noun keywords (train, flight, pnr ...).
   */
  const VERBS = {
    book: { book: 3, booking: 3, reserve: 3, reservation: 3, buy: 2, ticket: 1, tickets: 1, tatkal: 2, travel: 1,
      'बुक': 3, 'बुकिंग': 3, 'आरक्षण': 3, 'टिकट': 1, 'ಬುಕ್': 3, 'ಬುಕಿಂಗ್': 3, 'ಟಿಕೆಟ್': 1, 'ಕಾಯ್ದಿರಿಸ': 3 },
    complaint: { complaint: 3, complain: 3, grievance: 3, harassed: 2, rude: 2, dirty: 2, 'not refunded': 3, 'not received': 2,
      'charged twice': 3, 'double charged': 3, shikayat: 3,
      'शिकायत': 3, 'ದೂರು': 3, 'ಕುಂದುಕೊರತೆ': 3 },
    status: { status: 3, track: 3, 'where is': 3, 'check my': 2, confirmed: 2, waiting: 2, rac: 2, 'kya hua': 2,
      'स्थिति': 3, 'स्टेटस': 3, 'ट्रैक': 3, 'ಸ್ಥಿತಿ': 3, 'ಸ್ಟೇಟಸ್': 3 },
    cancel: { cancel: 3, cancellation: 3, refund: 3, 'money back': 2, 'रद्द': 3, 'कैंसल': 3, 'रिफंड': 2, 'ರದ್ದು': 3, 'ಕ್ಯಾನ್ಸಲ್': 3, 'ಮರುಪಾವತಿ': 2 }
  };

  const TASKS = [
    {
      id: 'book_train', category: 'book', icon: '🚆',
      label: { en: 'Train ticket', hi: 'ट्रेन टिकट', kn: 'ರೈಲು ಟಿಕೆಟ್' },
      keywords: { train: 3, rail: 2, railway: 2, irctc: 4, tatkal: 3, berth: 2, 'ट्रेन': 3, 'रेल': 2, 'ರೈಲು': 3 },
      portals: ['irctc', 'ixigo', 'makemytrip', 'goibibo', 'yatra'],
      ready: {
        en: ['Passenger names exactly as on their ID', 'From and to stations, and the travel date', 'Your IRCTC login — you will type it yourself'],
        hi: ['यात्रियों के नाम, ठीक वैसे जैसे पहचान-पत्र पर हैं', 'कहाँ से कहाँ तक, और यात्रा की तारीख', 'आपका IRCTC लॉगिन — आप खुद टाइप करेंगे'],
        kn: ['ಪ್ರಯಾಣಿಕರ ಹೆಸರು, ಗುರುತಿನ ಚೀಟಿಯಲ್ಲಿರುವಂತೆಯೇ', 'ಎಲ್ಲಿಂದ ಎಲ್ಲಿಗೆ, ಮತ್ತು ಪ್ರಯಾಣದ ದಿನಾಂಕ', 'ನಿಮ್ಮ IRCTC ಲಾಗಿನ್ — ನೀವೇ ಟೈಪ್ ಮಾಡುತ್ತೀರಿ']
      }
    },
    {
      id: 'book_flight', category: 'book', icon: '✈️',
      label: { en: 'Flight ticket', hi: 'फ्लाइट टिकट', kn: 'ವಿಮಾನ ಟಿಕೆಟ್' },
      keywords: { flight: 3, flights: 3, plane: 3, airline: 2, aeroplane: 3, airplane: 3, 'फ्लाइट': 3, 'हवाई जहाज': 3, 'उड़ान': 2, 'ವಿಮಾನ': 3, 'ಫ್ಲೈಟ್': 3 },
      portals: ['makemytrip', 'goibibo', 'yatra', 'ixigo'],
      ready: {
        en: ['Passenger names exactly as on their ID', 'From, to and travel dates', 'A mobile number and email for the ticket'],
        hi: ['यात्रियों के नाम, ठीक वैसे जैसे पहचान-पत्र पर हैं', 'कहाँ से कहाँ तक, और यात्रा की तारीखें', 'टिकट के लिए मोबाइल नंबर और ईमेल'],
        kn: ['ಪ್ರಯಾಣಿಕರ ಹೆಸರು, ಗುರುತಿನ ಚೀಟಿಯಲ್ಲಿರುವಂತೆಯೇ', 'ಎಲ್ಲಿಂದ ಎಲ್ಲಿಗೆ, ಮತ್ತು ಪ್ರಯಾಣದ ದಿನಾಂಕಗಳು', 'ಟಿಕೆಟ್‌ಗಾಗಿ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ ಮತ್ತು ಇಮೇಲ್']
      }
    },
    {
      id: 'book_bus', category: 'book', icon: '🚌',
      label: { en: 'Bus ticket', hi: 'बस टिकट', kn: 'ಬಸ್ ಟಿಕೆಟ್' },
      keywords: { bus: 3, buses: 3, redbus: 4, 'बस टिकट': 3, 'बस बुक': 3, 'बस': 2, 'ಬಸ್': 3 },
      portals: ['redbus', 'makemytrip', 'goibibo', 'ixigo'],
      ready: {
        en: ['From, to and the travel date', 'The boarding point you prefer', 'Passenger names and ages'],
        hi: ['कहाँ से कहाँ तक, और यात्रा की तारीख', 'आप किस जगह से बस पकड़ना चाहते हैं', 'यात्रियों के नाम और उम्र'],
        kn: ['ಎಲ್ಲಿಂದ ಎಲ್ಲಿಗೆ, ಮತ್ತು ಪ್ರಯಾಣದ ದಿನಾಂಕ', 'ನೀವು ಬಸ್ ಹತ್ತಲು ಬಯಸುವ ಸ್ಥಳ', 'ಪ್ರಯಾಣಿಕರ ಹೆಸರು ಮತ್ತು ವಯಸ್ಸು']
      }
    },
    {
      id: 'book_hotel', category: 'book', icon: '🏨',
      label: { en: 'Hotel or stay', hi: 'होटल या ठहरना', kn: 'ಹೋಟೆಲ್ ಅಥವಾ ವಾಸ್ತವ್ಯ' },
      keywords: { hotel: 3, hotels: 3, room: 2, stay: 2, resort: 2, homestay: 3, lodge: 2, 'होटल': 3, 'कमरा': 2, 'ಹೋಟೆಲ್': 3, 'ರೂಮ್': 2, 'ಕೋಣೆ': 2 },
      portals: ['makemytrip', 'goibibo', 'yatra', 'ixigo'],
      ready: {
        en: ['The city, and your check-in and check-out dates', 'Number of guests and rooms', 'Guest name exactly as on their ID'],
        hi: ['शहर, और आने व जाने की तारीख', 'मेहमानों और कमरों की संख्या', 'मेहमान का नाम, ठीक वैसे जैसे पहचान-पत्र पर है'],
        kn: ['ನಗರ, ಮತ್ತು ಬರುವ ಹಾಗೂ ಹೋಗುವ ದಿನಾಂಕ', 'ಅತಿಥಿಗಳು ಮತ್ತು ಕೋಣೆಗಳ ಸಂಖ್ಯೆ', 'ಅತಿಥಿಯ ಹೆಸರು, ಗುರುತಿನ ಚೀಟಿಯಲ್ಲಿರುವಂತೆಯೇ']
      }
    },
    {
      id: 'status_pnr', category: 'status', icon: '🎟️',
      label: { en: 'PNR or ticket status', hi: 'PNR या टिकट की स्थिति', kn: 'PNR ಅಥವಾ ಟಿಕೆಟ್ ಸ್ಥಿತಿ' },
      keywords: { pnr: 5, 'ticket status': 4, 'seat status': 3, 'पीएनआर': 5, 'ಪಿಎನ್‌ಆರ್': 5 },
      portals: ['irctc', 'ixigo'],
      ready: {
        en: ['Your 10-digit PNR number from the ticket'],
        hi: ['टिकट पर लिखा आपका 10 अंकों का PNR नंबर'],
        kn: ['ಟಿಕೆಟ್‌ನಲ್ಲಿರುವ ನಿಮ್ಮ 10 ಅಂಕಿಯ PNR ಸಂಖ್ಯೆ']
      }
    },
    {
      id: 'status_train', category: 'status', icon: '📍',
      label: { en: 'Where is my train?', hi: 'मेरी ट्रेन कहाँ है?', kn: 'ನನ್ನ ರೈಲು ಎಲ್ಲಿದೆ?' },
      keywords: { running: 3, 'where is my train': 6, 'train status': 4, live: 2, delayed: 2, late: 1, spot: 2, ntes: 5,
        'ट्रेन कहाँ': 5, 'ट्रेन की स्थिति': 4, 'लाइव': 2, 'ರೈಲು ಎಲ್ಲಿ': 5, 'ಲೈವ್': 2 },
      portals: ['ntes', 'ixigo'],
      ready: {
        en: ['The train number or name', 'The date you are travelling'],
        hi: ['ट्रेन का नंबर या नाम', 'आपकी यात्रा की तारीख'],
        kn: ['ರೈಲಿನ ಸಂಖ್ಯೆ ಅಥವಾ ಹೆಸರು', 'ನೀವು ಪ್ರಯಾಣಿಸುವ ದಿನಾಂಕ']
      }
    },
    {
      id: 'status_complaint', category: 'status', icon: '📬',
      label: { en: 'Status of my complaint', hi: 'मेरी शिकायत की स्थिति', kn: 'ನನ್ನ ದೂರಿನ ಸ್ಥಿತಿ' },
      keywords: { 'complaint status': 6, 'grievance status': 6, 'track complaint': 6, 'track my complaint': 6, 'my complaint': 2, 'registration number': 2,
        'शिकायत की स्थिति': 6, 'शिकायत स्टेटस': 6, 'ದೂರಿನ ಸ್ಥಿತಿ': 6 },
      portals: ['railmadad', 'airsewa', 'nch', 'cpgrams'],
      ready: {
        en: ['Your complaint or registration number', 'Use the website where you first filed it'],
        hi: ['आपकी शिकायत या पंजीकरण संख्या', 'उसी वेबसाइट पर जाएँ जहाँ आपने शिकायत की थी'],
        kn: ['ನಿಮ್ಮ ದೂರು ಅಥವಾ ನೋಂದಣಿ ಸಂಖ್ಯೆ', 'ನೀವು ಮೊದಲು ದೂರು ನೀಡಿದ ತಾಣಕ್ಕೇ ಹೋಗಿ']
      }
    },
    {
      id: 'complaint_train', category: 'complaint', icon: '🛎️',
      label: { en: 'Railway complaint', hi: 'रेलवे शिकायत', kn: 'ರೈಲ್ವೆ ದೂರು' },
      keywords: { railmadad: 6, 'rail madad': 6, railway: 3, rail: 2, train: 2, coach: 3, toilet: 3, station: 2, berth: 1,
        'रेलवे': 3, 'रेल': 2, 'ट्रेन': 2, 'ರೈಲ್ವೆ': 3, 'ರೈಲು': 2 },
      portals: ['railmadad'],
      ready: {
        en: ['PNR or ticket details, train number and date', 'Coach and seat number, and what went wrong', 'A mobile number for updates'],
        hi: ['PNR या टिकट की जानकारी, ट्रेन नंबर और तारीख', 'कोच और सीट नंबर, और क्या गड़बड़ हुई', 'अपडेट के लिए मोबाइल नंबर'],
        kn: ['PNR ಅಥವಾ ಟಿಕೆಟ್ ವಿವರ, ರೈಲು ಸಂಖ್ಯೆ ಮತ್ತು ದಿನಾಂಕ', 'ಕೋಚ್ ಮತ್ತು ಸೀಟ್ ಸಂಖ್ಯೆ, ಹಾಗೂ ಏನು ತಪ್ಪಾಯಿತು', 'ಮಾಹಿತಿಗಾಗಿ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ']
      }
    },
    {
      id: 'complaint_flight', category: 'complaint', icon: '🧳',
      label: { en: 'Flight or airport complaint', hi: 'फ्लाइट या हवाई अड्डे की शिकायत', kn: 'ವಿಮಾನ ಅಥವಾ ನಿಲ್ದಾಣ ದೂರು' },
      keywords: { airsewa: 6, flight: 3, airline: 3, airport: 3, baggage: 3, luggage: 3, indigo: 3, 'air india': 3, spicejet: 3, akasa: 3,
        'फ्लाइट': 3, 'विमान': 3, 'एयरलाइन': 3, 'हवाई अड्डा': 3, 'ವಿಮಾನ': 3, 'ಫ್ಲೈಟ್': 3, 'ಏರ್‌ಲೈನ್': 3 },
      portals: ['airsewa'],
      ready: {
        en: ['Airline, flight number, date and PNR', 'What went wrong', 'The airline’s own customer care is usually tried first; AirSewa is the government route'],
        hi: ['एयरलाइन, फ्लाइट नंबर, तारीख और PNR', 'क्या गड़बड़ हुई', 'आम तौर पर पहले एयरलाइन के कस्टमर केयर से कोशिश की जाती है; एयरसेवा सरकारी रास्ता है'],
        kn: ['ಏರ್‌ಲೈನ್, ಫ್ಲೈಟ್ ಸಂಖ್ಯೆ, ದಿನಾಂಕ ಮತ್ತು PNR', 'ಏನು ತಪ್ಪಾಯಿತು', 'ಸಾಮಾನ್ಯವಾಗಿ ಮೊದಲು ಏರ್‌ಲೈನ್‌ನ ಗ್ರಾಹಕ ಸೇವೆಯನ್ನು ಸಂಪರ್ಕಿಸಲಾಗುತ್ತದೆ; ಏರ್‌ಸೇವಾ ಸರ್ಕಾರಿ ಮಾರ್ಗ']
      }
    },
    {
      id: 'complaint_consumer', category: 'complaint', icon: '🧾',
      label: { en: 'Refund, online booking or product complaint', hi: 'रिफंड, ऑनलाइन बुकिंग या सामान की शिकायत', kn: 'ಮರುಪಾವತಿ, ಆನ್‌ಲೈನ್ ಬುಕಿಂಗ್ ಅಥವಾ ವಸ್ತು ದೂರು' },
      keywords: { consumer: 4, refund: 3, refunded: 3, product: 3, defective: 3, seller: 2, shop: 2, company: 2, warranty: 3,
        order: 2, delivery: 2, 'online booking': 3, 'charged twice': 3, 'double charged': 3,
        'उपभोक्ता': 4, 'कंज्यूमर': 4, 'रिफंड': 3, 'सामान': 2, 'कंपनी': 2, 'ಗ್ರಾಹಕ': 4, 'ಮರುಪಾವತಿ': 3, 'ರಿಫಂಡ್': 3, 'ವಸ್ತು': 2 },
      portals: ['nch'],
      ready: {
        en: ['The company name and your order or booking details', 'Dates and proof of payment — screenshots are fine', 'What you want: refund, repair or replacement'],
        hi: ['कंपनी का नाम और आपके ऑर्डर या बुकिंग की जानकारी', 'तारीखें और भुगतान का सबूत — स्क्रीनशॉट चलेगा', 'आप क्या चाहते हैं: रिफंड, मरम्मत या बदलाव'],
        kn: ['ಕಂಪನಿಯ ಹೆಸರು ಮತ್ತು ನಿಮ್ಮ ಆರ್ಡರ್ ಅಥವಾ ಬುಕಿಂಗ್ ವಿವರ', 'ದಿನಾಂಕಗಳು ಮತ್ತು ಪಾವತಿಯ ಪುರಾವೆ — ಸ್ಕ್ರೀನ್‌ಶಾಟ್ ಸಾಕು', 'ನೀವು ಬಯಸುವುದು: ಮರುಪಾವತಿ, ದುರಸ್ತಿ ಅಥವಾ ಬದಲಿ']
      }
    },
    {
      id: 'complaint_govt', category: 'complaint', icon: '🏛️',
      label: { en: 'Government service complaint', hi: 'सरकारी सेवा की शिकायत', kn: 'ಸರ್ಕಾರಿ ಸೇವೆ ದೂರು' },
      keywords: { cpgrams: 6, government: 3, ministry: 3, department: 3, pension: 3, officer: 2, office: 1,
        'सरकारी': 3, 'सरकार': 3, 'विभाग': 3, 'पेंशन': 3, 'ಸರ್ಕಾರ': 3, 'ಸರ್ಕಾರಿ': 3, 'ಇಲಾಖೆ': 3, 'ಪಿಂಚಣಿ': 3 },
      portals: ['cpgrams'],
      ready: {
        en: ['The name of the department or office', 'What happened and when', 'Any reference number or letter you have'],
        hi: ['विभाग या कार्यालय का नाम', 'क्या हुआ और कब', 'आपके पास कोई संदर्भ संख्या या पत्र हो तो वह'],
        kn: ['ಇಲಾಖೆ ಅಥವಾ ಕಚೇರಿಯ ಹೆಸರು', 'ಏನಾಯಿತು ಮತ್ತು ಯಾವಾಗ', 'ನಿಮ್ಮ ಬಳಿ ಇರುವ ಯಾವುದೇ ಉಲ್ಲೇಖ ಸಂಖ್ಯೆ ಅಥವಾ ಪತ್ರ']
      }
    },
    {
      id: 'cancel_ticket', category: 'cancel', icon: '↩️',
      label: { en: 'Cancel a ticket or booking', hi: 'टिकट या बुकिंग रद्द करें', kn: 'ಟಿಕೆಟ್ ಅಥವಾ ಬುಕಿಂಗ್ ರದ್ದು ಮಾಡಿ' },
      keywords: { ticket: 1, booking: 1, 'my booking': 2, 'टिकट': 1, 'ಟಿಕೆಟ್': 1 },
      portals: ['irctc', 'makemytrip', 'goibibo', 'yatra', 'ixigo', 'redbus'],
      ready: {
        en: ['Your booking or PNR number', 'The website or app where you booked — cancel there', 'Read the refund amount shown before you confirm'],
        hi: ['आपका बुकिंग या PNR नंबर', 'जिस वेबसाइट या ऐप पर बुक किया था, वहीं रद्द करें', 'पक्का करने से पहले दिखाई गई रिफंड राशि पढ़ें'],
        kn: ['ನಿಮ್ಮ ಬುಕಿಂಗ್ ಅಥವಾ PNR ಸಂಖ್ಯೆ', 'ನೀವು ಬುಕ್ ಮಾಡಿದ ತಾಣ ಅಥವಾ ಆ್ಯಪ್‌ನಲ್ಲೇ ರದ್ದು ಮಾಡಿ', 'ದೃಢೀಕರಿಸುವ ಮೊದಲು ತೋರಿಸಿದ ಮರುಪಾವತಿ ಮೊತ್ತ ಓದಿ']
      }
    },
    {
      id: 'practice', category: 'practice', icon: '🧪',
      label: { en: 'Practice form (safe demo)', hi: 'अभ्यास फ़ॉर्म (सुरक्षित डेमो)', kn: 'ಅಭ್ಯಾಸ ಫಾರ್ಮ್ (ಸುರಕ್ಷಿತ ಡೆಮೊ)' },
      keywords: { demo: 6, practice: 5, 'डेमो': 6, 'अभ्यास': 5, 'ಡೆಮೊ': 6, 'ಅಭ್ಯಾಸ': 5 },
      portals: ['demo'],
      ready: { en: [], hi: [], kn: [] }
    }
  ];

  /** Topics WebSaathi deliberately does not cover yet (only used when nothing else matched). */
  const UNSUPPORTED = {
    bank: ['bank', 'banking', 'net banking', 'netbanking', 'loan', 'upi', 'credit card', 'debit card', 'neft', 'imps',
      'बैंक', 'लोन', 'यूपीआई', 'ಬ್ಯಾಂಕ್', 'ಸಾಲ'],
    other: ['aadhaar', 'aadhar', 'pan card', 'passport', 'electricity', 'gas connection', 'insurance', 'income tax', 'gst',
      'आधार', 'पासपोर्ट', 'बिजली', 'ಆಧಾರ್', 'ಪಾಸ್‌ಪೋರ್ಟ್', 'ವಿದ್ಯುತ್']
  };

  const LATIN = /^[a-z0-9 ]+$/;
  const norm = registry.normalise;

  function has(text, kw) {
    if (LATIN.test(kw)) return new RegExp('(^|\\s)' + kw.replace(/ /g, '\\s'), 'u').test(text);
    return text.includes(kw);
  }

  function sum(text, table) {
    let n = 0;
    for (const [kw, w] of Object.entries(table)) if (has(text, kw)) n += w;
    return n;
  }

  const byId = Object.fromEntries(TASKS.map((t) => [t.id, t]));
  const getTask = (id) => byId[id] || null;
  const tasksIn = (category) => TASKS.filter((t) => t.category === category);
  const sole = (task) => tasksIn(task.category).length === 1;

  /** A brand named by the user ("on makemytrip") becomes the preferred portal. */
  function brandIn(text) {
    for (const p of registry.PORTALS) {
      if (p.demo) continue;
      for (const [kw, w] of Object.entries(p.keywords)) if (w >= 5 && has(text, kw)) return p;
    }
    return null;
  }

  /**
   * Understand a typed or spoken request.
   * @returns {{kind:'intent', task:object, preferred:object|null, alternatives:object[]}
   *   | {kind:'clarify', category:object, options:object[]}
   *   | {kind:'portal', portal:object}
   *   | {kind:'unsupported', topic:'bank'|'other'}
   *   | {kind:'none'}}
   */
  function match(input) {
    const text = norm(input);
    if (!text) return { kind: 'none' };
    const catScore = Object.fromEntries(Object.entries(VERBS).map(([c, table]) => [c, sum(text, table)]));
    const brand = brandIn(text);

    const scored = TASKS.map((task) => {
      const m = sum(text, task.keywords);
      const c = catScore[task.category] || 0;
      const eligible = m > 0 || (sole(task) && c > 0);
      return { task, m, c, total: eligible ? m + 2 * c : 0 };
    }).filter((s) => s.total > 0).sort((a, b) => b.total - a.total);

    const top = scored[0];
    if (top && top.total >= 3) {
      // No verb ("train"): several jobs are about equally likely, so ask which one.
      const close = scored.filter((s) => s.total >= top.total - 1);
      if (top.c === 0 && close.length > 1) {
        return { kind: 'clarify', category: null, options: close.map((s) => s.task) };
      }
      return { kind: 'intent', task: top.task, preferred: brand, alternatives: scored.slice(1, 3).filter((s) => s.total >= 4).map((s) => s.task) };
    }

    // A verb but no noun ("book a ticket", "I want to complain"): ask which kind.
    const bestCat = Object.entries(catScore).sort((a, b) => b[1] - a[1])[0];
    if (bestCat && bestCat[1] >= 2 && tasksIn(bestCat[0]).length > 1) {
      return { kind: 'clarify', category: CATEGORIES.find((c) => c.id === bestCat[0]), options: tasksIn(bestCat[0]) };
    }
    if (brand) return { kind: 'portal', portal: brand };
    for (const [topic, words] of Object.entries(UNSUPPORTED)) if (words.some((w) => has(text, w))) return { kind: 'unsupported', topic };
    return { kind: 'none' };
  }

  /**
   * What WebSaathi can do for a task: the verified portals in order (official first), each with
   * its level of help. `preferred` (a portal the user named) is moved to the front.
   */
  function optionsFor(task, preferred) {
    const list = task.portals.map((id) => registry.getPortal(id)).filter(Boolean);
    if (preferred && list.some((p) => p.id === preferred.id)) {
      list.sort((a, b) => (b.id === preferred.id) - (a.id === preferred.id));
    }
    return list.map((portal) => ({ portal, level: portal.policy === 'assist' ? 'assist' : 'guide' }));
  }

  function readyList(task, lang) {
    return (task.ready && (task.ready[lang] || task.ready.en)) || [];
  }

  return { CATEGORIES, TASKS, getTask, tasksIn, match, optionsFor, readyList };
});
