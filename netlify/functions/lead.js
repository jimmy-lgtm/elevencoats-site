// WE-012: website lead -> Zapier catch hook (Pipedrive deal etc.).
// Netlify Functions v2. Hits Zapier ONLY on the production deploy of elevencoatspainting.com
// with LEAD_DRY_RUN unset, ZAPIER_LEAD_HOOK and LEAD_HOOK_KEY set. Everything else returns the payload as a dry run.
import { createHmac, timingSafeEqual } from 'node:crypto';

const PROD_HOSTS = new Set(['elevencoatspainting.com', 'www.elevencoatspainting.com']);
const clip = (v, n = 500) => (v == null ? '' : String(v)).trim().slice(0, n);
const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export function buildPayload(d) {
  // client-supplied lead_key is ignored: only fields below are kept
  const name = clip(d.name, 120).replace(/\s+/g, ' ');
  const sp = name.indexOf(' ');
  return {
    first_name: sp === -1 ? name : name.slice(0, sp),
    last_name: sp === -1 ? '' : name.slice(sp + 1),
    name,
    email: clip(d.email, 254),
    phone: clip(d.phone, 40),
    address: clip(d.address, 300),
    message: clip(d.message ?? d.description, 3000),
    lead_source: clip(d.lead_source, 40) || 'Website',
    utm_source: clip(d.utm_source, 200),
    utm_medium: clip(d.utm_medium, 200),
    utm_campaign: clip(d.utm_campaign, 200),
    gclid: clip(d.gclid, 300),
    referrer: clip(d.referrer, 500),
    landing_page: clip(d.landing_page, 500),
    page: clip(d.page, 500),
  };
}

export function decide(req, context, env) {
  let host = '';
  try { host = new URL(req.url).hostname.toLowerCase(); } catch (e) {}
  const deployContext = (context && context.deploy && context.deploy.context) || env.CONTEXT || '';
  const reasons = [];
  if (env.LEAD_DRY_RUN) reasons.push('LEAD_DRY_RUN is set');
  if (!PROD_HOSTS.has(host)) reasons.push(`host ${host || '(unknown)'} is not elevencoatspainting.com`);
  if (deployContext !== 'production') reasons.push(`deploy context is ${deployContext || '(unknown)'}, not production`);
  const hook = env.ZAPIER_LEAD_HOOK || '';
  if (!hook) reasons.push('no hook configured');
  const key = env.LEAD_HOOK_KEY || '';
  if (!key) reasons.push('LEAD_HOOK_KEY missing');
  return { live: reasons.length === 0, reasons, hook, key, host, deployContext };
}

// ---- WE-013: anti-spam ----------------------------------------------------------------
export const MIN_AGE_MS = 3000, MAX_AGE_MS = 2 * 60 * 60 * 1000;

// Secret for page-load tokens. LEAD_TOKEN_SECRET if set; otherwise derived (one-way) from
// LEAD_HOOK_KEY so production is protected without a new env var. Neither -> null (check
// unavailable; leads are flagged suspect, never dropped, and no live call happens anyway
// because LEAD_HOOK_KEY is required for that).
export function tokenSecret(env) {
  if (env.LEAD_TOKEN_SECRET) return { secret: env.LEAD_TOKEN_SECRET, source: 'LEAD_TOKEN_SECRET' };
  if (env.LEAD_HOOK_KEY) return { secret: createHmac('sha256', env.LEAD_HOOK_KEY).update('we013-lead-token-v1').digest('hex'), source: 'derived from LEAD_HOOK_KEY' };
  return { secret: null, source: 'none' };
}
const sig = (secret, ts) => createHmac('sha256', secret).update('t:' + ts).digest('base64url');

export function issueToken(env, now = Date.now()) {
  const { secret } = tokenSecret(env);
  if (!secret) return null;
  return `${now}.${sig(secret, String(now))}`;
}

// -> { ok:true } | { ok:false, action:'skip'|'suspect', reason }
export function checkToken(token, env, now = Date.now()) {
  const { secret } = tokenSecret(env);
  if (!secret) return { ok: false, action: 'suspect', reason: 'token check unavailable (no secret)' };
  const t = clip(token, 200);
  if (!t) return { ok: false, action: 'suspect', reason: 'no page-load token' };
  const m = /^(\d{13})\.([A-Za-z0-9_-]{43})$/.exec(t);
  if (!m) return { ok: false, action: 'skip', reason: 'token malformed' };
  const a = Buffer.from(m[2]), b = Buffer.from(sig(secret, m[1]));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, action: 'skip', reason: 'token signature invalid' };
  const age = now - Number(m[1]);
  if (age < MIN_AGE_MS) return { ok: false, action: 'skip', reason: `submitted too fast (${age} ms)` };
  if (age > MAX_AGE_MS) return { ok: false, action: 'skip', reason: 'token expired (>2 h)' };
  return { ok: true };
}

const PITCH = /\bvirtual\s+assistants?\b|\bAI[\s-]+system\b|\bSEO\b|\bbid\s+on\b|\bproposals?\b|\bmarketing\b|\bwebsite\s+design\b|\bleads\s+for\s+you\b/i;
const VA = /\bVAs?\b/; // case-sensitive so "va" in ordinary words/addresses doesn't trip it
const LINK = /https?:\/\/|\bwww\.|(?<![@\w.-])[a-z0-9-]+\.(?:com|net|org|io|co|biz|info|xyz|ru|top|site|online|pk|in)\b/i;

export function phoneIsUS(phone) {
  const raw = clip(phone, 40);
  const d = raw.replace(/\D/g, '');
  if (/^\s*(\+|00)/.test(raw) && !/^\s*(\+\s*1|001)/.test(raw)) return false;
  const n = d.length === 11 && d[0] === '1' ? d.slice(1) : (d.length === 13 && d.startsWith('001') ? d.slice(3) : d);
  return n.length === 10 && /[2-9]/.test(n[0]) && /[2-9]/.test(n[3]);
}

export function randomName(name) {
  return clip(name, 120).split(/\s+/).some(w => {
    if (w.length < 8 || !/^[A-Za-z]+$/.test(w)) return false;
    const humps = (w.slice(1).match(/[a-z][A-Z]/g) || []).length;
    const noVowelRun = /[^aeiouyAEIOUY]{6,}/.test(w);
    return humps >= 2 || noVowelRun;
  });
}

export function contentFlags(p) {
  const r = [];
  if (p.phone && !phoneIsUS(p.phone)) r.push('non-US phone');
  if (LINK.test(p.message) || LINK.test(p.name)) r.push('link in message or name');
  const txt = `${p.name}\n${p.message}`;
  if (PITCH.test(txt) || VA.test(txt)) r.push('sales pitch wording');
  if (randomName(p.name)) r.push('random-string name');
  return r;
}

// Cloudflare Turnstile. No TURNSTILE_SECRET -> not configured, nothing verified (never blocks).
export async function checkTurnstile(token, env, ip, fetchImpl = fetch) {
  if (!env.TURNSTILE_SECRET) return { ok: true, state: 'not configured' };
  const t = clip(token, 2048);
  if (!t) return { ok: false, action: 'suspect', reason: 'no Turnstile token (widget did not load)' };
  try {
    const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: t });
    if (ip) body.set('remoteip', ip);
    const r = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify',
      { method: 'POST', body, signal: AbortSignal.timeout(4000) });
    const j = await r.json();
    if (j && j.success) return { ok: true, state: 'passed' };
    return { ok: false, action: 'skip', reason: 'Turnstile verification failed' };
  } catch (e) {
    // Cloudflare unreachable: don't lose a possible homeowner
    return { ok: false, action: 'suspect', reason: 'Turnstile verify unreachable' };
  }
}

// Logs carry the reason and page path only: never name, email, phone, address or message.
const logSkip = (why, page) => { let path = ''; try { path = new URL(page).pathname; } catch (e) {}
  console.log(JSON.stringify({ we013: 'skip', reason: why, page: path })); };

export async function handle(req, context, env, fetchImpl = fetch, now = Date.now()) {
  if (req.method === 'GET') {
    const token = issueToken(env, now);
    return json(token ? 200 : 503, token ? { ok: true, token } : { ok: false, error: 'token unavailable' });
  }
  if (req.method !== 'POST') return json(405, { ok: false, error: 'POST or GET only' });
  let d;
  try { d = await req.json(); } catch (e) { return json(400, { ok: false, error: 'invalid JSON' }); }
  if (!d || typeof d !== 'object') return json(400, { ok: false, error: 'invalid JSON' });
  if (clip(d._honey)) { logSkip('honeypot', d.page); return json(200, { ok: true, skipped: 'honeypot' }); }
  const payload = buildPayload(d);
  if (!payload.name || !payload.phone) return json(422, { ok: false, error: 'name and phone required' });

  const suspect = [];
  const tk = checkToken(d.lead_token, env, now);
  if (!tk.ok) { if (tk.action === 'skip') { logSkip(tk.reason, payload.page); return json(200, { ok: true, skipped: tk.reason }); } suspect.push(tk.reason); }
  const ip = req.headers.get('x-nf-client-connection-ip') || '';
  const ts = await checkTurnstile(d.cf_turnstile_response, env, ip, fetchImpl);
  if (!ts.ok) { if (ts.action === 'skip') { logSkip(ts.reason, payload.page); return json(200, { ok: true, skipped: ts.reason }); } suspect.push(ts.reason); }
  suspect.push(...contentFlags(payload));

  if (suspect.length) {
    // lead_source is never overwritten: a flagged lead keeps its real source (Google Maps, Website...)
    // so attribution survives; routing uses the separate suspect / suspect_reasons fields.
    payload.suspect = true; payload.suspect_reasons = suspect.join('; ');
    console.log(JSON.stringify({ we013: 'suspect', reasons: suspect }));
  } else { payload.suspect = false; payload.suspect_reasons = ''; }
  // Default: suspects are SENT with suspect:true (Zap routes on the suspect field, not lead_source).
  // LEAD_SUSPECT_MODE=skip drops them instead.
  if (payload.suspect && env.LEAD_SUSPECT_MODE === 'skip') { logSkip('suspect (LEAD_SUSPECT_MODE=skip)', payload.page); return json(200, { ok: true, skipped: 'suspect', reasons: suspect }); }

  const g = decide(req, context, env);
  if (!g.live) return json(200, { ok: true, dry_run: true, reasons: g.reasons, turnstile: ts.state || 'see suspect_reasons',
    token_secret: tokenSecret(env).source, payload: { ...payload, lead_key: g.key ? '[set]' : '[missing]' } });
  try {
    const r = await fetchImpl(g.hook, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...payload, lead_key: g.key }), signal: AbortSignal.timeout(8000) });
    return json(r.ok ? 200 : 502, { ok: r.ok, status: r.status });
  } catch (e) {
    return json(502, { ok: false, error: 'hook unreachable' });
  }
}

export default (req, context) => handle(req, context, process.env);
