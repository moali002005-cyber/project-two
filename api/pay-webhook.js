// Vercel Serverless Function: /api/pay-webhook
// يستقبل إشعارات ميسر (invoice_paid / payment_paid).
// الأمان: ما نصدّق حمولة الإشعار أبداً — نتحقق من التوكن السري (إلزامي)
// ثم نسأل ميسر مباشرة عن الفاتورة بالمفتاح السري ونحدّث سجلنا.
// يغطي مسارين: دفع صفقات الحملات (payments_gateway) واشتراكات الباقات (subscriptions).

const SUPABASE_URL = 'https://chpzecgpylxqsutjydkb.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const MOYASAR_SECRET_KEY = process.env.MOYASAR_SECRET_KEY || '';
const MOYASAR_WEBHOOK_TOKEN = process.env.MOYASAR_WEBHOOK_TOKEN || '';
const MOYASAR_API = 'https://api.moyasar.com/v1';

const UUID_RE = /^[0-9a-f-]{36}$/;

function sbHeaders() {
  return { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' };
}
async function sbGet(path) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + path, { headers: sbHeaders() });
  if (!res.ok) throw new Error('DB_GET_FAILED');
  return res.json();
}
async function sbPatch(path, data) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
    method: 'PATCH', headers: { ...sbHeaders(), 'Prefer': 'return=representation' }, body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('DB_PATCH_FAILED');
  return res.json();
}
async function sbInsert(table, data) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + table, {
    method: 'POST', headers: sbHeaders(), body: JSON.stringify(data)
  });
  if (!res.ok) console.error('sbInsert:', await res.text());
}
async function sbRpc(fn, args) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/rpc/' + fn, {
    method: 'POST', headers: sbHeaders(), body: JSON.stringify(args || {})
  });
  if (!res.ok) { console.error('rpc ' + fn, await res.text()); return null; }
  return res.json();
}
function moyasarAuth() {
  return 'Basic ' + Buffer.from(MOYASAR_SECRET_KEY + ':').toString('base64');
}
async function fetchInvoice(invoiceId) {
  const r = await fetch(MOYASAR_API + '/invoices/' + invoiceId, { headers: { 'Authorization': moyasarAuth() } });
  if (!r.ok) { console.error('moyasar verify:', await r.text()); return null; }
  return r.json();
}

// ── مسار صفقات الحملات ───────────────────────────────────────────────
async function settlePayment(payRow) {
  if (payRow.status === 'paid') return true;
  const inv = await fetchInvoice(payRow.moyasar_invoice_id);
  if (!inv) return false;

  if (inv.status === 'paid') {
    const paymentId = (inv.payments && inv.payments[0] && inv.payments[0].id) || null;
    await sbPatch('payments_gateway?id=eq.' + payRow.id, {
      status: 'paid', paid_at: new Date().toISOString(), moyasar_payment_id: paymentId, raw: inv
    });
    if (Array.isArray(payRow.application_ids) && payRow.application_ids.length) {
      const ids = payRow.application_ids.map(id => '"' + id + '"').join(',');
      await sbPatch('applications?id=in.(' + ids + ')', { platform_paid: true, platform_paid_at: new Date().toISOString() });
      try {
        const apps = await sbGet('applications?id=in.(' + ids + ')&select=creator_id,campaigns(title)');
        for (const a of (apps || [])) {
          if (!a.creator_id) continue;
          await sbInsert('notifications', {
            user_id: a.creator_id, type: 'platform_paid',
            title: '💳 دفعتك مضمونة',
            message: ((a.campaigns && a.campaigns.title) || 'حملة') + ': الشركة سدّدت قيمة صفقتك للمنصة — مستحقك مضمون عند إكمال العمل.',
            link: '/creator.html'
          });
        }
      } catch (e) { console.error('notify fail:', e); }
    }
  } else if (['canceled', 'expired', 'failed'].includes(inv.status)) {
    await sbPatch('payments_gateway?id=eq.' + payRow.id, { status: 'failed', raw: inv });
  }
  return true;
}

// ── مسار اشتراكات الباقات ────────────────────────────────────────────
async function settleSubscription(sub) {
  if (sub.status === 'paid') return true;
  const inv = await fetchInvoice(sub.moyasar_invoice_id);
  if (!inv) return false;

  if (inv.status === 'paid') {
    const paymentId = (inv.payments && inv.payments[0] && inv.payments[0].id) || null;
    await sbPatch('subscriptions?id=eq.' + sub.id, { moyasar_payment_id: paymentId, raw: inv });
    // activate_subscription يقلب الحالة إلى paid، يمدّد تاريخ الانتهاء، ويرسل إشعاراً للشركة
    await sbRpc('activate_subscription', { p_sub: sub.id });
  } else if (['canceled', 'expired', 'failed'].includes(inv.status)) {
    await sbPatch('subscriptions?id=eq.' + sub.id, { status: 'failed', raw: inv });
  }
  return true;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (!MOYASAR_SECRET_KEY || !SUPABASE_SERVICE_KEY) return res.status(500).json({ error: 'not configured' });

  // 1) توكن الويبهوك السري — إلزامي. لو المتغير مفقود نرفض بدل ما نتخطى الفحص.
  if (!MOYASAR_WEBHOOK_TOKEN) {
    console.error('pay-webhook: MOYASAR_WEBHOOK_TOKEN is not set — rejecting');
    return res.status(500).json({ error: 'not configured' });
  }

  try {
    const body = req.body || {};
    if (body.secret_token !== MOYASAR_WEBHOOK_TOKEN) {
      return res.status(401).json({ error: 'bad token' });
    }

    // 2) استخرج معرف الفاتورة من أي شكل معروف للحمولة
    const data = body.data || body;
    const meta = data.metadata || {};
    const invoiceId = data.invoice_id || (data.object === 'invoice' ? data.id : null) || body.invoice_id || null;
    const paymentRef = meta.payment_ref || null;
    const subRef = meta.subscription_ref || null;

    // 3) مسار صفقات الحملات
    let payRow = null;
    if (paymentRef && UUID_RE.test(paymentRef)) {
      const rows = await sbGet('payments_gateway?id=eq.' + paymentRef + '&select=*');
      payRow = rows && rows[0];
    }
    if (!payRow && invoiceId) {
      const rows = await sbGet('payments_gateway?moyasar_invoice_id=eq.' + encodeURIComponent(invoiceId) + '&select=*');
      payRow = rows && rows[0];
    }
    if (payRow) {
      const ok = await settlePayment(payRow);
      return res.status(200).json({ ok: ok, kind: 'payment' });
    }

    // 4) مسار اشتراكات الباقات
    let subRow = null;
    if (subRef && UUID_RE.test(subRef)) {
      const rows = await sbGet('subscriptions?id=eq.' + subRef + '&select=*');
      subRow = rows && rows[0];
    }
    if (!subRow && invoiceId) {
      const rows = await sbGet('subscriptions?moyasar_invoice_id=eq.' + encodeURIComponent(invoiceId) + '&select=*');
      subRow = rows && rows[0];
    }
    if (subRow) {
      const ok = await settleSubscription(subRow);
      return res.status(200).json({ ok: ok, kind: 'subscription' });
    }

    return res.status(200).json({ ok: true, note: 'no matching record' });
  } catch (err) {
    console.error('pay-webhook error:', err);
    // نرجع 200 عشان ميسر ما يعيد المحاولة للأبد على خطأ داخلي دائم
    return res.status(200).json({ ok: false });
  }
};
