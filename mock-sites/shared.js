'use strict';
// Shared helpers for the practice sites. No dependencies.
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Base CSS: 4px grid, one easing curve, visible focus, no glow. Each site passes its own ramp. */
function baseCss(t) {
  return `
:root{--bg:${t.bg};--card:${t.card};--raised:${t.raised};--ink:${t.ink};--ink2:${t.ink2};--muted:${t.muted};
--line:color-mix(in srgb,var(--ink) 9%,transparent);--accent:${t.accent};--accent-ink:${t.accentInk};--on-accent:${t.onAccent};
--ease:cubic-bezier(.22,1,.36,1);--mono:ui-monospace,"SF Mono","Cascadia Mono",Menlo,Consolas,monospace}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:400 15px/22px system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans",sans-serif}
a{color:var(--accent-ink);text-underline-offset:3px}
a:hover{text-decoration-thickness:2px}
:focus-visible{outline:2px solid var(--accent-ink);outline-offset:2px;border-radius:4px}
.practice{background:var(--raised);color:var(--ink2);font-size:13px;line-height:20px;padding:8px 24px;border-bottom:1px solid var(--line)}
.practice strong{color:var(--ink);font-weight:500}
.wrap{max-width:1120px;margin:0 auto;padding:0 32px}
header.top{border-bottom:1px solid var(--line);background:var(--card)}
header.top .wrap{display:flex;align-items:center;justify-content:space-between;height:64px}
.brand{font-weight:600;font-size:17px;color:var(--ink);text-decoration:none;display:flex;align-items:center;gap:8px}
nav.links{display:flex;gap:24px;font-size:14px}
nav.links a{color:var(--ink2);text-decoration:none}
nav.links a:hover,nav.links a[aria-current]{color:var(--ink)}
h1{font-weight:500;font-size:32px;line-height:40px;margin:0}
h2{font-weight:500;font-size:20px;line-height:28px;margin:0}
.muted{color:var(--muted)}.ink2{color:var(--ink2)}
.mono{font-family:var(--mono);font-variant-numeric:tabular-nums;white-space:nowrap}
.num{font-variant-numeric:tabular-nums}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px}
.btn{display:inline-flex;align-items:center;justify-content:center;height:44px;padding:0 20px;border-radius:10px;border:1px solid transparent;
 font-family:inherit;font-size:15px;line-height:1;font-weight:500;cursor:pointer;text-decoration:none;transition:background-color .15s var(--ease),border-color .15s var(--ease),transform .12s var(--ease)}
.btn:active{transform:scale(.98)}
.btn-primary{background:var(--accent);color:var(--on-accent)}
.btn-primary:hover{background:var(--accent-ink)}
.btn-quiet{background:var(--card);color:var(--ink);border-color:var(--line)}
.btn-quiet:hover{background:var(--raised)}
label.field{display:grid;gap:8px;font-size:14px;color:var(--ink)}
label.field .hint{color:var(--muted);font-size:13px;line-height:20px}
input,textarea,select{font-family:inherit;font-size:15px;line-height:22px;color:var(--ink);background:var(--card);border:1px solid color-mix(in srgb,var(--ink) 18%,transparent);
 border-radius:10px;padding:10px 12px;width:100%;transition:border-color .15s var(--ease)}
input:hover,textarea:hover{border-color:color-mix(in srgb,var(--ink) 30%,transparent)}
input:focus,textarea:focus{outline:2px solid var(--accent-ink);outline-offset:1px}
textarea{min-height:112px;resize:vertical}
footer.foot{margin-top:64px;padding-top:24px;padding-bottom:40px;border-top:1px solid var(--line);color:var(--muted);font-size:13px}
@media (max-width:640px){.wrap{padding:0 16px}h1{font-size:26px;line-height:32px}nav.links{gap:16px}}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
`;
}

function page({ title, css, body, lang = 'en' }) {
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>${css}</style></head><body>${body}</body></html>`;
}

module.exports = { esc, baseCss, page };
