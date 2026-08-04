// Vercel Serverless Function: /api/pay-webhook
// يستقبل إشعارات ميسر (invoice_paid / payment_paid).
// الأمان: ما نصدّق حمولة الإشعار أبداً — نتحقق من التوكن السري (لو مضبوط)
// ثم نسأل ميسر مباشرة عن الفاتورة بالمفتاح السري ونحدّث سجلنا.

const SUPABASE_URL = 'https://chpzecgpylxqsutjydkb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNocHplY2dweWx4cXN1dGp5ZGtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyODgxNzQsImV4cCI6MjA5OTg2NDE3NH0.q4wmWKtJ5IPx8AgzMkp3SuFLZL9F10qKc3qiX5LB7kI';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
const MOYASAR_SECRET_KEY = process.env.MOYASAR_SECRET_KEY || '';
const MOYASAR_WEBHOOK_TOKEN = process.env.MOYASAR_WEBHOOK_TOKEN || '';
const MOYASAR_API = 'https://api.moyasar.com/v1';

function sbHeaders() {
  return { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' };
}
async function sbGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders() });
  if (!res.ok) throw new Error('DB_GET_FAILED');
  return res.json();
}
async function sbPatch(path, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH', headers: { ...sbHeaders(), 'Prefer': 'return=representation' }, body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('DB_PATCH_FAILED');
  return res.json();
}
async function sbInsert(table, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST', headers: sbHeaders(), body: JSON.stringify(data)
  });
  if (!res.ok) console.error('sbInsert:', await res.text());
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (!MOYASAR_SECRET_KEY) return res.status(500).json({ error: 'not configured' });

  try {
    const body = req.body || {};

    // 1) توكن الويبهوك السري (يُضبط في لوحة ميسر ونفسه في Vercel)
    if (MOYASAR_WEBHOOK_TOKEN && body.secret_token !== MOYASAR_WEBHOOK_TOKEN) {
      return res.status(401).json({ error: 'bad token' });
    }

    // 2) استخرج معرف الفاتورة من أي شكل معروف للحمولة
    const data = body.data || body;
    const invoiceId = data.invoice_id || (data.object === 'invoice' ? data.id : null) || body.invoice_id || null;
    const paymentRef = (data.metadata && data.metadata.payment_ref) || null;

    let payRow = null;
    if (paymentRef && /^[0-9a-f-]{36}$/.test(paymentRef)) {
      const rows = await sbGet(`payments_gateway?id=eq.${paymentRef}&select=*`);
      payRow = rows && rows[0];
    }
    if (!payRow && invoiceId) {
      const rows = await sbGet(`payments_gateway?moyasar_invoice_id=eq.${encodeURIComponent(invoiceId)}&select=*`);
      payRow = rows && rows[0];
    }
    if (!payRow) return res.status(200).json({ ok: true, note: 'no matching payment' });
    if (payRow.status === 'paid') return res.status(200).json({ ok: true });

    // 3) التحقق الحاسم: نسأل ميسر مباشرة
    const invRes = await fetch(`${MOYASAR_API}/invoices/${payRow.moyasar_invoice_id}`, {
      headers: { 'Authorization': 'Basic ' + Buffer.from(MOYASAR_SECRET_KEY + ':').toString('base64') }
    });
    if (!invRes.ok) { console.error('moyasar verify:', await invRes.text()); return res.status(200).json({ ok: false }); }
    const inv = await invRes.json();

    if (inv.status === 'paid') {
      const paymentId = (inv.payments && inv.payments[0] && inv.payments[0].id) || null;
      await sbPatch(`payments_gateway?id=eq.${payRow.id}`, {
        status: 'paid', paid_at: new Date().toISOString(), moyasar_payment_id: paymentId, raw: inv
      });
      if (Array.isArray(payRow.application_ids) && payRow.application_ids.length) {
        const ids = payRow.application_ids.map(id => `"${id}"`).join(',');
        await sbPatch(`applications?id=in.(${ids})`, { platform_paid: true, platform_paid_at: new Date().toISOString() });
        try {
          const apps = await sbGet(`applications?id=in.(${ids})&select=creator_id,campaigns(title)`);
          for (const a of (apps || [])) {
            if (!a.creator_id) continue;
            await sbInsert('notifications', {
              user_id: a.creator_id, type: 'platform_paid',
              title: '💳 دفعتك مضمونة',
              message: `${(a.campaigns && a.campaigns.title) || 'حملة'}: الشركة سدّدت قيمة صفقتك للمنصة — مستحقك مضمون عند إكمال العمل.`,
              link: '/creator.html'
            });
          }
        } catch (e) { console.error('notify fail:', e); }
      }
    } else if (['canceled', 'expired', 'failed'].includes(inv.status)) {
      await sbPatch(`payments_gateway?id=eq.${payRow.id}`, { status: 'failed', raw: inv });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('pay-webhook error:', err);
    // نرجع 200 عشان ميسر ما يعيد المحاولة للأبد على خطأ داخلي دائم
    return res.status(200).json({ ok: false });
  }
};
