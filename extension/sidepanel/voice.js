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
  const synthesis = root.speechSynthesis;
  let active = null;
  let audio = null;
  let speechRequest = 0;
  let finishSpeech = null;

  // Chromium can initially return an empty list while it loads OS voices.
  function loadVoices() {
    const voices = synthesis.getVoices();
    if (voices.length) return Promise.resolve(voices);
    return new Promise((resolve) => {
      const finish = (available) => {
        clearTimeout(timer);
        synthesis.removeEventListener('voiceschanged', ready);
        resolve(available);
      };
      const ready = () => {
        const available = synthesis.getVoices();
        if (available.length) finish(available);
      };
      const timer = setTimeout(() => finish(synthesis.getVoices()), 2000);
      synthesis.addEventListener('voiceschanged', ready);
    });
  }

  function clearAudio(clip) {
    if (!clip || audio !== clip) return;
    clip.player.pause();
    URL.revokeObjectURL(clip.url);
    audio = null;
  }

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
      speechRequest += 1;
      finishSpeech?.('cancelled');
      clearAudio(audio);
      synthesis?.cancel();
    },

    /** @returns {Promise<'elevenlabs'|'browser'|'none'|'cancelled'>} */
    async speak(text, lang) {
      voice.stopSpeaking();
      if (!text) return 'none';
      const request = speechRequest;
      const blob = await WS.api.tts(text, lang);
      if (request !== speechRequest) return 'cancelled';
      if (blob && blob.size > 0) {
        const url = URL.createObjectURL(blob);
        const clip = { url, player: new Audio(url) };
        audio = clip;
        clip.player.addEventListener('ended', () => clearAudio(clip), { once: true });
        try {
          await clip.player.play();
          return request === speechRequest ? 'elevenlabs' : 'cancelled';
        } catch (_) {
          clearAudio(clip);
          if (request !== speechRequest) return 'cancelled';
        }
      }
      if (!synthesis || !root.SpeechSynthesisUtterance) return 'none';
      const code = speechLang(lang);
      const voices = await loadVoices();
      if (request !== speechRequest) return 'cancelled';
      const locale = (v) => v.lang.toLowerCase().replace(/_/g, '-');
      const matchesLanguage = (v) => locale(v).split('-')[0] === code.split('-')[0];
      const match = voices.find((v) => locale(v) === code.toLowerCase() && v.localService)
        || voices.find((v) => locale(v) === code.toLowerCase())
        || voices.find((v) => matchesLanguage(v) && v.localService)
        || voices.find(matchesLanguage);
      if (!match && lang !== 'en') return 'none';

      const utterance = new root.SpeechSynthesisUtterance(text);
      utterance.lang = match?.lang || code;
      if (match) utterance.voice = match;
      utterance.rate = 0.92;
      return new Promise((resolve) => {
        const finish = (result) => {
          if (finishSpeech !== finish) return;
          clearTimeout(timer);
          finishSpeech = null;
          resolve(result);
        };
        const timer = setTimeout(() => {
          finish('none');
          synthesis.cancel();
        }, 4000);
        finishSpeech = finish;
        utterance.onstart = () => finish('browser');
        utterance.onerror = () => finish('none');
        synthesis.speak(utterance);
      });
    }
  };
  WS.voice = voice;
})(globalThis);
