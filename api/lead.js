// /api/lead — nimmt den Fitment-Lead entgegen (HTTPS, same-origin),
// leitet ihn an n8n weiter UND feuert das Meta Conversions-API 'Lead' serverseitig.
//
// Benötigte Env-Variablen (im Vercel-Projekt unter Settings → Environment Variables setzen):
//   N8N_WEBHOOK_URL  = die Webhook-URL aus eurem n8n-Workflow (Production-URL)
//   META_PIXEL_ID    = 28119741824299108
//   META_CAPI_TOKEN  = Conversions-API-Token aus dem Meta Events Manager
//
// Ohne META_PIXEL_ID/META_CAPI_TOKEN wird KEIN CAPI gefeuert (nur n8n-Weiterleitung).
// Ohne N8N_WEBHOOK_URL wird NICHT an n8n weitergeleitet. Beides ist optional/unabhängig.

const crypto = require('crypto');

// Meta verlangt personenbezogene Daten SHA-256-gehasht (E-Mail/Telefon normalisiert).
function sha256(v){ return crypto.createHash('sha256').update(String(v).trim().toLowerCase()).digest('hex'); }
function normPhone(p){ return String(p).replace(/[^0-9]/g, ''); }

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  let lead = req.body;
  if (typeof lead === 'string') { try { lead = JSON.parse(lead); } catch (e) { lead = {}; } }
  lead = lead || {};

  const tasks = [];

  // 1) Lead an n8n weiterleiten (das eigentliche "Postfach" → n8n mailt an CETE / trägt in Sheet ein)
  const n8nUrl = process.env.N8N_WEBHOOK_URL;
  if (n8nUrl) {
    tasks.push(
      fetch(n8nUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lead)
      }).catch(e => console.error('n8n forward failed:', e))
    );
  }

  // 2) Meta Conversions API — 'Lead' serverseitig. Dedup mit dem Browser-Pixel über event_id.
  const pixel = process.env.META_PIXEL_ID;
  const token = process.env.META_CAPI_TOKEN;
  if (pixel && token) {
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const ua = req.headers['user-agent'] || '';

    const user_data = {};
    if (ip) user_data.client_ip_address = ip;
    if (ua) user_data.client_user_agent = ua;
    if (lead.email) user_data.em = [sha256(lead.email)];
    if (lead.phone) user_data.ph = [sha256(normPhone(lead.phone))];
    if (lead.fbp) user_data.fbp = lead.fbp;   // _fbp-Cookie → besseres Matching
    if (lead.fbc) user_data.fbc = lead.fbc;   // _fbc-Cookie (Klick-ID) → beste Attribution

    const event = {
      event_name: 'Lead',
      event_time: Math.floor(Date.now() / 1000),
      event_id: lead.event_id || undefined,       // MUSS gleich der Browser-eventID sein (Dedup)
      action_source: 'website',
      event_source_url: lead.page_url || undefined,
      user_data,
      custom_data: {
        content_name: 'ASC Fitment-Lead',
        brand: lead.brand, model: lead.model, year: lead.year, air: lead.air, src: lead.src
      }
    };

    const url = `https://graph.facebook.com/v19.0/${pixel}/events?access_token=${encodeURIComponent(token)}`;
    tasks.push(
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: [event] })
      })
        .then(async r => { if (!r.ok) console.error('CAPI error', r.status, await r.text()); })
        .catch(e => console.error('CAPI failed:', e))
    );
  }

  try { await Promise.allSettled(tasks); } catch (e) { /* Tracking darf den Nutzer nie blockieren */ }

  res.status(200).json({ ok: true });
};
