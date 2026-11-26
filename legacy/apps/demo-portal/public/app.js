/* WebSaathi Grievance Demo — realistic validation behaviour, no network calls. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const form = $('complaint-form');
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const MAX_FILE = 200 * 1024;

  function setError(input, msg) {
    const errId = input.type === 'radio' ? 'resolution-error' : input.id + '-error';
    const p = $(errId);
    p.textContent = msg || '';
    if (input.type === 'radio') {
      input.closest('fieldset').classList.toggle('invalid', !!msg);
    } else {
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    }
    return !msg;
  }

  const checks = {
    name: (el) => (el.value.trim() ? '' : 'This field is required.'),
    email: (el) => (!el.value.trim() ? 'This field is required.' : EMAIL_RE.test(el.value.trim()) ? '' : 'Invalid email address.'),
    category: (el) => (el.value ? '' : 'Please select a complaint category.'),
    company: (el) => (el.value.trim() ? '' : 'This field is required.'),
    description: (el) => (!el.value.trim() ? 'This field is required.' : el.value.trim().length < 20 ? 'Description must be at least 20 characters.' : ''),
    consent: (el) => (el.checked ? '' : 'Please confirm the declaration to continue.')
  };

  function validateField(el, onlyIfFilled) {
    const fn = checks[el.id];
    if (!fn) return true;
    if (onlyIfFilled && el.type !== 'checkbox' && !el.value.trim()) return setError(el, '');
    return setError(el, fn(el));
  }

  // Validate as the user (or WebSaathi, via input/change events) edits a field.
  Object.keys(checks).forEach((id) => {
    const el = $(id);
    el.addEventListener('change', () => validateField(el, true));
    el.addEventListener('blur', () => validateField(el, true));
  });
  document.querySelectorAll('input[name="resolution"]').forEach((r) => r.addEventListener('change', () => setError(r, '')));

  $('document').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f && f.size > MAX_FILE) {
      e.target.value = '';
      setError(e.target, 'File size exceeds 200KB. Please upload a smaller file.');
    } else {
      setError(e.target, '');
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let ok = true;
    Object.keys(checks).forEach((id) => { if (!validateField($(id), false)) ok = false; });
    const radios = document.querySelectorAll('input[name="resolution"]');
    if (![...radios].some((r) => r.checked)) { setError(radios[0], 'Please choose a resolution.'); ok = false; }
    const summary = $('form-summary');
    if (!ok) {
      summary.hidden = false;
      summary.textContent = 'Please correct the highlighted fields before continuing.';
      return;
    }
    summary.hidden = true;
    $('step-details').hidden = true;
    $('step-otp').hidden = false;
    $('otp').focus();
  });

  $('otp-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const otp = $('otp');
    if (!/^\d{6}$/.test(otp.value.trim())) {
      setError(otp, 'Please enter the 6-digit OTP.');
      return;
    }
    $('step-otp').hidden = true;
    $('step-done').hidden = false;
    $('ref').textContent = 'DEMO-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  });
})();
