// WE-012: website lead -> Zapier catch hook (Pipedrive deal etc.).
// Netlify Functions v2. Hits Zapier ONLY on the production deploy of elevencoatspainting.com
// with LEAD_DRY_RUN unset. Everything else returns the payload as a dry run.
const PROD_HOSTS = new Set(['elevencoatspainting.com', 'www.elevencoatspainting.com']);
const FALLBACK_HOOK = 'https://hooks.zapier.com/hooks/catch/882887/41p4uzy/';
const clip = (v, n = 500) => (v == null ? '' : String(v)).trim().slice(0, n);
const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export function buildPayload(d) {
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
  const hook = env.ZAPIER_LEAD_HOOK || (deployContext === 'production' ? FALLBACK_HOOK : '');
  if (!hook) reasons.push('no hook configured');
  return { live: reasons.length === 0, reasons, hook, host, deployContext };
}

export default async (req, context) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'POST only' });
  let d;
  try { d = await req.json(); } catch (e) { return json(400, { ok: false, error: 'invalid JSON' }); }
  if (!d || typeof d !== 'object') return json(400, { ok: false, error: 'invalid JSON' });
  if (clip(d._honey)) return json(200, { ok: true, skipped: 'honeypot' });
  const payload = buildPayload(d);
  if (!payload.name || !payload.phone) return json(422, { ok: false, error: 'name and phone required' });
  const g = decide(req, context, process.env);
  if (!g.live) return json(200, { ok: true, dry_run: true, reasons: g.reasons, payload });
  try {
    const r = await fetch(g.hook, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(8000) });
    return json(r.ok ? 200 : 502, { ok: r.ok, status: r.status });
  } catch (e) {
    return json(502, { ok: false, error: 'hook unreachable' });
  }
};

