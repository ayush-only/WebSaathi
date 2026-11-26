/**
 * WebSaathi — voice input/output with graceful fallbacks.
 *  Input:  browser SpeechRecognition (en-IN / hi-IN / kn-IN where the browser supports it).
 *  Output: ElevenLabs via the backend if configured → browser speechSynthesis → silent (text only).
 * Typing always works; nothing here is required for the extension to function.
 */
(function (root) {
  'use strict';
  const WS = root.WebSaathi;
  const Rec = root.SpeechRecognition || root.webkitSpeechRecognition;
  let active = null;
  let audio = null;

  function speechLang(lang) {
    return (WS.i18n.LANGS[lang] || WS.i18n.LANGS.en).speech;
  }

  const voice = {
    inputSupported: !!Rec,

    /** Resolves with the transcript; rejects with an Error whose message is a code. */
    listen(lang) {
      return new Promise((resolve, reject) => {
        if (!Rec) { reject(new Error('unsupported')); return; }
        voice.stopListening();
        const rec = new Rec();
        rec.lang = speechLang(lang);
        rec.interimResults = false;
        rec.maxAlternatives = 1;
        let done = false;
        rec.onresult = (e) => { done = true; resolve(String(e.results[0][0].transcript || '').trim()); };
        rec.onerror = (e) => { done = true; reject(new Error(e.error || 'error')); };
        rec.onend = () => { active = null; if (!done) reject(new Error('no-speech')); };
        active = rec;
        try { rec.start(); } catch (err) { reject(new Error('start-failed')); }
      });
    },

    stopListening() {
      if (active) { try { active.abort(); } catch (_) { /* ignore */ } active = null; }
    },

    stopSpeaking() {
      if (audio) { audio.pause(); audio = null; }
      if (root.speechSynthesis) root.speechSynthesis.cancel();
    },

    /** @returns {Promise<'elevenlabs'|'browser'|'none'>} */
    async speak(text, lang) {
      voice.stopSpeaking();
      if (!text) return 'none';
      const blob = await WS.api.tts(text, lang);
      if (blob && blob.size > 0) {
        audio = new Audio(URL.createObjectURL(blob));
        try { await audio.play(); return 'elevenlabs'; } catch (_) { /* fall through */ }
      }
      if (root.speechSynthesis && root.SpeechSynthesisUtterance) {
        const code = speechLang(lang);
        const voices = root.speechSynthesis.getVoices();
        const match = voices.find((v) => v.lang === code) || voices.find((v) => v.lang && v.lang.startsWith(code.split('-')[0]));
        if (!match && lang !== 'en') return 'none'; // don't read Hindi/Kannada with an English voice
        const u = new root.SpeechSynthesisUtterance(text);
        u.lang = code;
        if (match) u.voice = match;
        u.rate = 0.92;
        root.speechSynthesis.speak(u);
        return 'browser';
      }
      return 'none';
    }
  };
  WS.voice = voice;
})(globalThis);
