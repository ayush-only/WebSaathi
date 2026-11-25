/**
 * WebSaathi — Task playbooks.
 *
 * On a real travel or status website the page is full of unrelated boxes (app-download promos,
 * pre-ticked add-ons, login pop-ups). Walking "the next empty field" there is useless and can point
 * at an upsell. A playbook instead follows THE TASK the user chose: an ordered list of steps
 * ("set FROM", "set TO", "pick the date", "press Search yourself"...). A step may carry words used to
 * find the matching spot on the page by its visible label; if it is not found, the panel simply
 * shows the instruction as text. Playbooks only produce instructions and highlights — never a
 * click, a fill or a submit.
 *
 * Hindi and Kannada text are drafts pending native-speaker review.
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  root.WebSaathi = root.WebSaathi || {};
  root.WebSaathi.playbooks = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /** keys: visible words used to find the spot. button: prefer a button-like element. final: the user must press it. */
  const STEPS = {
    login: {
      en: 'Log in if the site asks. Type your password and OTP yourself — I never will.',
      hi: 'अगर साइट कहे तो लॉगिन करें। पासवर्ड और OTP आप खुद टाइप करें — मैं कभी नहीं करूँगा।',
      kn: 'ಸೈಟ್ ಕೇಳಿದರೆ ಲಾಗಿನ್ ಮಾಡಿ. ಪಾಸ್‌ವರ್ಡ್ ಮತ್ತು OTP ನೀವೇ ಟೈಪ್ ಮಾಡಿ — ನಾನು ಎಂದಿಗೂ ಮಾಡುವುದಿಲ್ಲ.'
    },
    tripType: {
      keys: ['one way', 'round trip', 'roundtrip'],
      en: 'Choose One Way or Round Trip.',
      hi: 'वन-वे या राउंड ट्रिप चुनें।',
      kn: 'ಒನ್ ವೇ ಅಥವಾ ರೌಂಡ್ ಟ್ರಿಪ್ ಆರಿಸಿ.'
    },
    from: {
      keys: ['from', 'leaving from', 'origin'],
      en: 'Set where you are travelling FROM. Click here and type the city.',
      hi: 'आप कहाँ से यात्रा कर रहे हैं (FROM) वह चुनें। यहाँ क्लिक करके शहर लिखें।',
      kn: 'ನೀವು ಎಲ್ಲಿಂದ ಪ್ರಯಾಣಿಸುತ್ತಿದ್ದೀರಿ (FROM) ಎಂದು ಹೊಂದಿಸಿ. ಇಲ್ಲಿ ಕ್ಲಿಕ್ ಮಾಡಿ ನಗರ ಟೈಪ್ ಮಾಡಿ.'
    },
    to: {
      keys: ['to', 'destination', 'going to'],
      en: 'Set where you are going TO. Click here and type the city.',
      hi: 'आप कहाँ जा रहे हैं (TO) वह चुनें। यहाँ क्लिक करके शहर लिखें।',
      kn: 'ನೀವು ಎಲ್ಲಿಗೆ ಹೋಗುತ್ತಿದ್ದೀರಿ (TO) ಎಂದು ಹೊಂದಿಸಿ. ಇಲ್ಲಿ ಕ್ಲಿಕ್ ಮಾಡಿ ನಗರ ಟೈಪ್ ಮಾಡಿ.'
    },
    date: {
      keys: ['departure', 'depart', 'journey date', 'travel date', 'date'],
      en: 'Pick your travel date from the calendar.',
      hi: 'कैलेंडर से यात्रा की तारीख चुनें।',
      kn: 'ಕ್ಯಾಲೆಂಡರ್‌ನಿಂದ ಪ್ರಯಾಣದ ದಿನಾಂಕ ಆರಿಸಿ.'
    },
    travellers: {
      keys: ['travellers', 'travelers', 'passengers', 'adults'],
      en: 'Set how many people are travelling.',
      hi: 'कितने लोग यात्रा कर रहे हैं, यह चुनें।',
      kn: 'ಎಷ್ಟು ಜನ ಪ್ರಯಾಣಿಸುತ್ತಿದ್ದಾರೆ ಎಂದು ಆರಿಸಿ.'
    },
    class: {
      keys: ['cabin class', 'class', 'cabin'],
      en: 'Choose the class, for example Economy or Sleeper.',
      hi: 'क्लास चुनें, जैसे इकोनॉमी या स्लीपर।',
      kn: 'ಕ್ಲಾಸ್ ಆರಿಸಿ, ಉದಾ. ಎಕಾನಮಿ ಅಥವಾ ಸ್ಲೀಪರ್.'
    },
    city: {
      keys: ['city', 'where to', 'location', 'destination'],
      en: 'Type the city or area where you want to stay.',
      hi: 'जिस शहर या इलाके में ठहरना है, वह लिखें।',
      kn: 'ನೀವು ಉಳಿಯಲು ಬಯಸುವ ನಗರ ಅಥವಾ ಪ್ರದೇಶ ಟೈಪ್ ಮಾಡಿ.'
    },
    checkin: {
      keys: ['check-in', 'check in', 'checkin'],
      en: 'Pick your check-in date.',
      hi: 'आने (चेक-इन) की तारीख चुनें।',
      kn: 'ಬರುವ (ಚೆಕ್-ಇನ್) ದಿನಾಂಕ ಆರಿಸಿ.'
    },
    checkout: {
      keys: ['check-out', 'check out', 'checkout'],
      en: 'Pick your check-out date.',
      hi: 'जाने (चेक-आउट) की तारीख चुनें।',
      kn: 'ಹೋಗುವ (ಚೆಕ್-ಔಟ್) ದಿನಾಂಕ ಆರಿಸಿ.'
    },
    guests: {
      keys: ['rooms & guests', 'rooms and guests', 'guests'],
      en: 'Set the number of rooms and guests.',
      hi: 'कमरों और मेहमानों की संख्या चुनें।',
      kn: 'ಕೋಣೆಗಳು ಮತ್ತು ಅತಿಥಿಗಳ ಸಂಖ್ಯೆ ಆರಿಸಿ.'
    },
    trainNo: {
      keys: ['train number', 'train name', 'train no'],
      en: 'Type the train number or name.',
      hi: 'ट्रेन का नंबर या नाम लिखें।',
      kn: 'ರೈಲಿನ ಸಂಖ್ಯೆ ಅಥವಾ ಹೆಸರು ಟೈಪ್ ಮಾಡಿ.'
    },
    pnr: {
      keys: ['pnr number', 'pnr'],
      en: 'Type your 10-digit PNR number.',
      hi: 'अपना 10 अंकों का PNR नंबर लिखें।',
      kn: 'ನಿಮ್ಮ 10 ಅಂಕಿಯ PNR ಸಂಖ್ಯೆ ಟೈಪ್ ಮಾಡಿ.'
    },
    search: {
      keys: ['search flights', 'search buses', 'search hotels', 'search trains', 'find trains', 'get status', 'check status', 'search'],
      button: true,
      final: true,
      en: 'Check your choices, then press this button yourself. I will not press it.',
      hi: 'अपने चुनाव जाँचें, फिर यह बटन खुद दबाएँ। मैं इसे नहीं दबाऊँगा।',
      kn: 'ನಿಮ್ಮ ಆಯ್ಕೆಗಳನ್ನು ಪರಿಶೀಲಿಸಿ, ನಂತರ ಈ ಬಟನ್ ನೀವೇ ಒತ್ತಿ. ನಾನು ಒತ್ತುವುದಿಲ್ಲ.'
    },
    resultsFlight: {
      en: 'Compare the options: total price, timings, number of stops, and whether the fare is refundable. Choose one yourself.',
      hi: 'विकल्पों की तुलना करें: कुल कीमत, समय, स्टॉप की संख्या, और किराया रिफंडेबल है या नहीं। चुनाव आप खुद करें।',
      kn: 'ಆಯ್ಕೆಗಳನ್ನು ಹೋಲಿಸಿ: ಒಟ್ಟು ಬೆಲೆ, ಸಮಯ, ನಿಲುಗಡೆಗಳು, ಮತ್ತು ಟಿಕೆಟ್ ಮರುಪಾವತಿಯಾಗುತ್ತದೆಯೇ. ನೀವೇ ಆರಿಸಿ.'
    },
    resultsTrain: {
      en: 'Check availability. AVAILABLE means seats are free; WL means a waiting list and it may not get confirmed. Choose one yourself.',
      hi: 'उपलब्धता देखें। AVAILABLE यानी सीट खाली है; WL यानी वेटिंग लिस्ट, जो कन्फर्म न भी हो सकती है। चुनाव आप खुद करें।',
      kn: 'ಲಭ್ಯತೆ ನೋಡಿ. AVAILABLE ಎಂದರೆ ಸೀಟು ಖಾಲಿ ಇದೆ; WL ಎಂದರೆ ವೇಟಿಂಗ್ ಲಿಸ್ಟ್, ಅದು ದೃಢವಾಗದೆ ಇರಬಹುದು. ನೀವೇ ಆರಿಸಿ.'
    },
    resultsBus: {
      en: 'Compare timings and price. Check the bus type, the boarding point and the seat. Choose yourself.',
      hi: 'समय और कीमत की तुलना करें। बस का प्रकार, चढ़ने की जगह और सीट देखें। चुनाव आप खुद करें।',
      kn: 'ಸಮಯ ಮತ್ತು ಬೆಲೆ ಹೋಲಿಸಿ. ಬಸ್ ಪ್ರಕಾರ, ಹತ್ತುವ ಸ್ಥಳ ಮತ್ತು ಸೀಟು ನೋಡಿ. ನೀವೇ ಆರಿಸಿ.'
    },
    resultsHotel: {
      en: 'Compare the TOTAL price including taxes, the location, and the cancellation policy. Choose yourself.',
      hi: 'टैक्स सहित कुल कीमत, जगह और कैंसलेशन नीति की तुलना करें। चुनाव आप खुद करें।',
      kn: 'ತೆರಿಗೆ ಸೇರಿದ ಒಟ್ಟು ಬೆಲೆ, ಸ್ಥಳ ಮತ್ತು ರದ್ದತಿ ನೀತಿ ಹೋಲಿಸಿ. ನೀವೇ ಆರಿಸಿ.'
    },
    details: {
      en: 'On the passenger page, type names exactly as on the ID. Un-tick extras you do not want, such as insurance or protection add-ons.',
      hi: 'यात्री वाले पेज पर नाम ठीक वैसे लिखें जैसे पहचान-पत्र पर हैं। जो अतिरिक्त चीज़ें नहीं चाहिए (जैसे बीमा या प्रोटेक्शन) उन्हें अनटिक करें।',
      kn: 'ಪ್ರಯಾಣಿಕರ ಪುಟದಲ್ಲಿ ಹೆಸರನ್ನು ಗುರುತಿನ ಚೀಟಿಯಲ್ಲಿರುವಂತೆಯೇ ಟೈಪ್ ಮಾಡಿ. ನಿಮಗೆ ಬೇಡದ ಹೆಚ್ಚುವರಿಗಳನ್ನು (ವಿಮೆ, ಪ್ರೊಟೆಕ್ಷನ್) ಅನ್‌ಟಿಕ್ ಮಾಡಿ.'
    },
    review: {
      en: 'Check the total price, dates and names once more before you continue.',
      hi: 'आगे बढ़ने से पहले कुल कीमत, तारीखें और नाम एक बार फिर जाँचें।',
      kn: 'ಮುಂದುವರಿಯುವ ಮೊದಲು ಒಟ್ಟು ಬೆಲೆ, ದಿನಾಂಕ ಮತ್ತು ಹೆಸರುಗಳನ್ನು ಮತ್ತೊಮ್ಮೆ ಪರಿಶೀಲಿಸಿ.'
    },
    pay: {
      en: 'At payment I stop. Pay yourself, and never share your OTP or PIN with anyone.',
      hi: 'भुगतान पर मैं रुक जाता हूँ। भुगतान आप खुद करें, और OTP या PIN किसी को न बताएँ।',
      kn: 'ಪಾವತಿಯಲ್ಲಿ ನಾನು ನಿಲ್ಲುತ್ತೇನೆ. ಪಾವತಿ ನೀವೇ ಮಾಡಿ, OTP ಅಥವಾ PIN ಯಾರಿಗೂ ಹೇಳಬೇಡಿ.'
    },
    manage: {
      keys: ['my bookings', 'my trips', 'booked ticket', 'manage booking'],
      en: 'Open your bookings (often called My Trips or Booked Ticket History). You may need to log in yourself.',
      hi: 'अपनी बुकिंग खोलें (अक्सर My Trips या Booked Ticket History कहते हैं)। लॉगिन आपको खुद करना पड़ सकता है।',
      kn: 'ನಿಮ್ಮ ಬುಕಿಂಗ್‌ಗಳನ್ನು ತೆರೆಯಿರಿ (ಸಾಮಾನ್ಯವಾಗಿ My Trips ಅಥವಾ Booked Ticket History). ಲಾಗಿನ್ ನೀವೇ ಮಾಡಬೇಕಾಗಬಹುದು.'
    },
    findBooking: {
      en: 'Find the booking you want to cancel. Check the date and the passenger name.',
      hi: 'जिस बुकिंग को रद्द करना है उसे ढूँढें। तारीख और यात्री का नाम जाँचें।',
      kn: 'ನೀವು ರದ್ದು ಮಾಡಬೇಕಾದ ಬುಕಿಂಗ್ ಹುಡುಕಿ. ದಿನಾಂಕ ಮತ್ತು ಪ್ರಯಾಣಿಕರ ಹೆಸರು ಪರಿಶೀಲಿಸಿ.'
    },
    cancelBtn: {
      keys: ['cancel booking', 'cancel ticket', 'cancel'],
      button: true,
      final: true,
      en: 'Find the Cancel option for that booking. Press it yourself — I will not.',
      hi: 'उस बुकिंग का Cancel विकल्प ढूँढें। इसे आप खुद दबाएँ — मैं नहीं दबाऊँगा।',
      kn: 'ಆ ಬುಕಿಂಗ್‌ನ Cancel ಆಯ್ಕೆ ಹುಡುಕಿ. ಅದನ್ನು ನೀವೇ ಒತ್ತಿ — ನಾನು ಒತ್ತುವುದಿಲ್ಲ.'
    },
    refundCheck: {
      en: 'Read the refund amount and any cancellation charge shown before you confirm.',
      hi: 'पक्का करने से पहले दिखाई गई रिफंड राशि और कैंसलेशन चार्ज पढ़ें।',
      kn: 'ದೃಢೀಕರಿಸುವ ಮೊದಲು ತೋರಿಸಿದ ಮರುಪಾವತಿ ಮೊತ್ತ ಮತ್ತು ರದ್ದತಿ ಶುಲ್ಕ ಓದಿ.'
    }
  };

  /** Task id (see shared/intents.js) → ordered step ids. Tasks not listed here use the form walker. */
  const TASK_STEPS = {
    book_flight: ['tripType', 'from', 'to', 'date', 'travellers', 'search', 'resultsFlight', 'details', 'review', 'pay'],
    book_train: ['login', 'from', 'to', 'date', 'class', 'search', 'resultsTrain', 'details', 'review', 'pay'],
    book_bus: ['from', 'to', 'date', 'search', 'resultsBus', 'details', 'review', 'pay'],
    book_hotel: ['city', 'checkin', 'checkout', 'guests', 'search', 'resultsHotel', 'details', 'review', 'pay'],
    status_pnr: ['pnr', 'search'],
    status_train: ['trainNo', 'search'],
    cancel_ticket: ['login', 'manage', 'findBooking', 'cancelBtn', 'refundCheck']
  };

  const has = (taskId) => Object.prototype.hasOwnProperty.call(TASK_STEPS, taskId);

  /** @returns {{id:string, text:string, keys:string[]|null, button:boolean, final:boolean, index:number, total:number}[]} */
  function stepsFor(taskId, lang) {
    if (!has(taskId)) return [];
    const ids = TASK_STEPS[taskId];
    return ids.map((id, i) => {
      const s = STEPS[id];
      return { id, text: s[lang] || s.en, keys: s.keys || null, button: !!s.button, final: !!s.final, index: i, total: ids.length };
    });
  }

  return { STEPS, TASK_STEPS, has, stepsFor };
});
