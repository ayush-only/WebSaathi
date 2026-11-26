/**
 * WebSaathi — Live Error Translator (rule-based part).
 * Turns website validation messages into plain language in English, Hindi and Kannada.
 * Used in Local Demo Mode and as the fallback when the AI backend is unavailable.
 * Kannada strings are draft translations and should be reviewed by a native speaker.
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  root.WebSaathi = root.WebSaathi || {};
  root.WebSaathi.errors = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /** Each rule: regex over the raw message → explanation + fix, per language. `{n}` is the first captured number. */
  const RULES = [
    {
      id: 'required',
      re: /required|cannot be (empty|blank)|please fill|mandatory|आवश्यक|अनिवार्य|ಕಡ್ಡಾಯ/i,
      en: ['This box cannot be left empty.', 'Please fill it in before moving on.'],
      hi: ['यह खाना खाली नहीं छोड़ा जा सकता।', 'आगे बढ़ने से पहले इसे भरें।'],
      kn: ['ಈ ಖಾನೆಯನ್ನು ಖಾಲಿ ಬಿಡುವಂತಿಲ್ಲ.', 'ಮುಂದುವರಿಯುವ ಮೊದಲು ಇದನ್ನು ತುಂಬಿ.']
    },
    {
      id: 'email',
      re: /(invalid|valid|incorrect|wrong).{0,20}e-?mail|e-?mail.{0,20}(invalid|not valid|incorrect)|include an '@'/i,
      en: ['The email address is not written correctly.', 'It should look like name@example.com — with an @ and a dot, and no spaces.'],
      hi: ['ईमेल पता सही तरह से नहीं लिखा गया है।', 'यह name@example.com जैसा होना चाहिए — @ और डॉट के साथ, बिना स्पेस के।'],
      kn: ['ಇಮೇಲ್ ವಿಳಾಸ ಸರಿಯಾಗಿ ಬರೆದಿಲ್ಲ.', 'ಇದು name@example.com ರೀತಿ ಇರಬೇಕು — @ ಮತ್ತು ಡಾಟ್ ಇರಬೇಕು, ಸ್ಪೇಸ್ ಇರಬಾರದು.']
    },
    {
      id: 'file-size',
      re: /(file|size).{0,30}(exceed|larger|more than|too (big|large)).{0,20}?(\d+)\s?(kb|mb)/i,
      num: 4, unit: 5,
      en: ['The file you chose is too big. The website accepts files up to {n} {u}.', 'Choose a smaller file, or reduce it with a photo/PDF compressor, then upload again.'],
      hi: ['आपकी चुनी हुई फ़ाइल बहुत बड़ी है। वेबसाइट {n} {u} तक की फ़ाइल लेती है।', 'छोटी फ़ाइल चुनें या फ़ोटो/PDF को छोटा करके फिर से अपलोड करें।'],
      kn: ['ನೀವು ಆರಿಸಿದ ಫೈಲ್ ತುಂಬಾ ದೊಡ್ಡದು. ತಾಣವು {n} {u} ವರೆಗೆ ಮಾತ್ರ ಸ್ವೀಕರಿಸುತ್ತದೆ.', 'ಚಿಕ್ಕ ಫೈಲ್ ಆರಿಸಿ ಅಥವಾ ಫೋಟೋ/PDF ಗಾತ್ರ ಕಡಿಮೆ ಮಾಡಿ ಮತ್ತೆ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ.']
    },
    {
      id: 'min-length',
      re: /(at least|minimum( of)?|min\.?)\s*(\d+)\s*(characters|chars|letters)/i,
      num: 3,
      en: ['This answer is too short. The website needs at least {n} characters.', 'Add a little more detail — for example what happened and when.'],
      hi: ['यह जवाब बहुत छोटा है। वेबसाइट को कम से कम {n} अक्षर चाहिए।', 'थोड़ा और विवरण जोड़ें — जैसे क्या हुआ और कब हुआ।'],
      kn: ['ಈ ಉತ್ತರ ತುಂಬಾ ಚಿಕ್ಕದು. ಕನಿಷ್ಠ {n} ಅಕ್ಷರಗಳು ಬೇಕು.', 'ಇನ್ನಷ್ಟು ವಿವರ ಸೇರಿಸಿ — ಏನಾಯಿತು, ಯಾವಾಗ ಆಯಿತು ಎಂದು.']
    },
    {
      id: 'pnr',
      re: /pnr/i,
      en: ['The PNR number is not in the right format.', 'A PNR has exactly 10 digits. You can find it at the top of your ticket or booking SMS.'],
      hi: ['PNR नंबर सही फ़ॉर्मेट में नहीं है।', 'PNR में ठीक 10 अंक होते हैं। यह आपके टिकट या बुकिंग SMS में सबसे ऊपर मिलता है।'],
      kn: ['PNR ಸಂಖ್ಯೆ ಸರಿಯಾದ ರೂಪದಲ್ಲಿಲ್ಲ.', 'PNR ನಲ್ಲಿ 10 ಅಂಕಿಗಳಿರುತ್ತವೆ. ಇದು ನಿಮ್ಮ ಟಿಕೆಟ್ ಅಥವಾ ಬುಕಿಂಗ್ SMS ನಲ್ಲಿ ಮೇಲ್ಭಾಗದಲ್ಲಿ ಇರುತ್ತದೆ.']
    },
    {
      id: 'date',
      re: /(valid|invalid|select|choose).{0,15}date|date.{0,15}(invalid|past|future)/i,
      en: ['The date is not accepted.', 'Pick the date again using the calendar on the page, and check the day, month and year.'],
      hi: ['यह तारीख स्वीकार नहीं हुई।', 'पेज के कैलेंडर से तारीख फिर चुनें और दिन, महीना, साल जाँच लें।'],
      kn: ['ಈ ದಿನಾಂಕ ಸ್ವೀಕಾರವಾಗಿಲ್ಲ.', 'ಪುಟದ ಕ್ಯಾಲೆಂಡರ್ ಬಳಸಿ ದಿನಾಂಕವನ್ನು ಮತ್ತೆ ಆರಿಸಿ, ದಿನ-ತಿಂಗಳು-ವರ್ಷ ಪರಿಶೀಲಿಸಿ.']
    },
    {
      id: 'mobile',
      re: /(mobile|phone).{0,20}(invalid|valid|10 digit)|(invalid|valid).{0,20}(mobile|phone)/i,
      en: ['The mobile number is not correct.', 'Enter your 10-digit mobile number without +91 or spaces.'],
      hi: ['मोबाइल नंबर सही नहीं है।', '+91 या स्पेस के बिना अपना 10 अंकों का मोबाइल नंबर लिखें।'],
      kn: ['ಮೊಬೈಲ್ ಸಂಖ್ಯೆ ಸರಿಯಿಲ್ಲ.', '+91 ಅಥವಾ ಸ್ಪೇಸ್ ಇಲ್ಲದೆ ನಿಮ್ಮ 10 ಅಂಕಿಯ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ ಬರೆಯಿರಿ.']
    },
    {
      id: 'captcha',
      re: /captcha/i,
      en: ['The picture code (CAPTCHA) was not accepted.', 'Type the characters you see in the picture yourself. WebSaathi never fills CAPTCHAs.'],
      hi: ['चित्र वाला कोड (CAPTCHA) स्वीकार नहीं हुआ।', 'चित्र में दिख रहे अक्षर खुद लिखें। WebSaathi कभी CAPTCHA नहीं भरता।'],
      kn: ['ಚಿತ್ರದ ಕೋಡ್ (CAPTCHA) ಸ್ವೀಕಾರವಾಗಿಲ್ಲ.', 'ಚಿತ್ರದಲ್ಲಿ ಕಾಣುವ ಅಕ್ಷರಗಳನ್ನು ನೀವೇ ಬರೆಯಿರಿ. WebSaathi ಎಂದಿಗೂ CAPTCHA ತುಂಬುವುದಿಲ್ಲ.']
    },
    {
      id: 'session',
      re: /session.{0,20}(expired|timed? ?out)/i,
      en: ['The website logged you out because you were idle for a while.', 'This is normal. Start again from the first page; your details may need to be entered again.'],
      hi: ['कुछ देर कुछ न करने से वेबसाइट ने आपको लॉग आउट कर दिया।', 'यह सामान्य है। पहले पेज से फिर शुरू करें; जानकारी दोबारा भरनी पड़ सकती है।'],
      kn: ['ಸ್ವಲ್ಪ ಸಮಯ ಏನೂ ಮಾಡದ ಕಾರಣ ತಾಣ ನಿಮ್ಮನ್ನು ಲಾಗ್ ಔಟ್ ಮಾಡಿದೆ.', 'ಇದು ಸಾಮಾನ್ಯ. ಮೊದಲ ಪುಟದಿಂದ ಮತ್ತೆ ಪ್ರಾರಂಭಿಸಿ.']
    }
  ];

  const GENERIC = {
    en: ['The website shows a problem: "{raw}"', 'Check the highlighted box and correct it. If you are unsure, ask someone you trust.'],
    hi: ['वेबसाइट एक समस्या दिखा रही है: "{raw}"', 'हाइलाइट किया गया खाना जाँचें और ठीक करें। संदेह हो तो किसी भरोसेमंद व्यक्ति से पूछें।'],
    kn: ['ತಾಣವು ಒಂದು ಸಮಸ್ಯೆ ತೋರಿಸುತ್ತಿದೆ: "{raw}"', 'ಹೈಲೈಟ್ ಮಾಡಿದ ಖಾನೆ ಪರಿಶೀಲಿಸಿ ಸರಿಪಡಿಸಿ. ಸಂದೇಹವಿದ್ದರೆ ನಂಬಿಕೆಯ ವ್ಯಕ್ತಿಯನ್ನು ಕೇಳಿ.']
  };

  /**
   * @param {string} raw   message text found on the page
   * @param {'en'|'hi'|'kn'} lang
   * @returns {{ruleId: string, matched: boolean, explanation: string, fix: string}}
   */
  function explainError(raw, lang) {
    const L = ['en', 'hi', 'kn'].includes(lang) ? lang : 'en';
    const text = String(raw || '').trim().slice(0, 300);
    for (const rule of RULES) {
      const m = text.match(rule.re);
      if (!m) continue;
      const n = rule.num ? (m[rule.num] || '') : '';
      const u = rule.unit ? String(m[rule.unit] || '').toUpperCase() : '';
      const fill = (s) => s.replace('{n}', n).replace('{u}', u);
      return { ruleId: rule.id, matched: true, explanation: fill(rule[L][0]), fix: fill(rule[L][1]) };
    }
    return { ruleId: 'generic', matched: false, explanation: GENERIC[L][0].replace('{raw}', text), fix: GENERIC[L][1] };
  }

  return { explainError, RULES };
});
