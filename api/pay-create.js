/* بوابة ميسر مفعّلة — 31 أغسطس 2026 */
// Vercel Serverless Function: /api/pay-create
// POST { campaign_id }  + Authorization: Bearer <توكن جلسة الشركة>
//   → يتحقق أن المستدعي شركة الحملة، يحسب مجموع الصفقات المعتمدة غير المدفوعة،
//     ينشئ فاتورة ميسر (بالمفتاح السري — سيرفر فقط)، يسجّلها، ويرجع رابط الدفع.
// GET ?ref=<payment_row_id>
//   → تحقق عند العودة من صفحة الدفع: يسأل ميسر مباشرة عن حالة الفاتورة
//     (سيرفر-لسيرفر، صفر ثقة بالمتصفح) ويحدّث السجل ويرجع الحالة.

const SUPABASE_URL = 'https://chpzecgpylxqsutjydkb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNocHplY2dweWx4cXN1dGp5ZGtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyODgxNzQsImV4cCI6MjA5OTg2NDE3NH0.q4wmWKtJ5IPx8AgzMkp3SuFLZL9F10qKc3qiX5LB7kI';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
const MOYASAR_SECRET_KEY = process.env.MOYASAR_SECRET_KEY || '';
const MOYASAR_API = 'https://api.moyasar.com/v1';
const SITE = 'https://www.flfluencer.com';

function sbHeaders() {
  return { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' };
}
async function sbGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders() });
  if (!res.ok) { console.error('sbGet:', await res.text()); throw new Error('DB_GET_FAILED'); }
  return res.json();
}
async function sbInsert(table, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST', headers: { ...sbHeaders(), 'Prefer': 'return=representation' }, body: JSON.stringify(data)
  });
  if (!res.ok) { console.error('sbInsert:', await res.text()); throw new Error('DB_INSERT_FAILED'); }
  return res.json();
}
async function sbPatch(path, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH', headers: { ...sbHeaders(), 'Prefer': 'return=representation' }, body: JSON.stringify(data)
  });
  if (!res.ok) { console.error('sbPatch:', await res.text()); throw new Error('DB_PATCH_FAILED'); }
  return res.json();
}
async function sbRpc(fn, args) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST', headers: sbHeaders(), body: JSON.stringify(args || {})
  });
  if (!res.ok) { console.error('sbRpc:', await res.text()); throw new Error('DB_RPC_FAILED'); }
  return res.json();
}

// من هو المستخدم صاحب التوكن؟ (نسأل Supabase Auth مباشرة)
async function getCallerUser(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) return null;
  const u = await res.json();
  if (!u || !u.id) return null;
  const rows = await sbGet(`users?auth_id=eq.${u.id}&select=id,role,name,company_name`);
  return rows && rows[0] ? rows[0] : null;
}

function moyasarAuth() {
  return 'Basic ' + Buffer.from(MOYASAR_SECRET_KEY + ':').toString('base64');
}

// تأكيد الدفع من ميسر مباشرة وتحديث سجلنا (المصدر الوحيد للحقيقة)
async function verifyAndSettle(payRow) {
  if (!payRow || !payRow.moyasar_invoice_id) return { status: payRow ? payRow.status : 'unknown' };
  if (payRow.status === 'paid') return { status: 'paid' };
  const res = await fetch(`${MOYASAR_API}/invoices/${payRow.moyasar_invoice_id}`, { headers: { 'Authorization': moyasarAuth() } });
  if (!res.ok) { console.error('moyasar fetch:', await res.text()); return { status: payRow.status }; }
  const inv = await res.json();
  if (inv.status === 'paid') {
    const paymentId = (inv.payments && inv.payments[0] && inv.payments[0].id) || null;
    await sbPatch(`payments_gateway?id=eq.${payRow.id}`, {
      status: 'paid', paid_at: new Date().toISOString(), moyasar_payment_id: paymentId, raw: inv
    });
    // علّم الصفقات كمدفوعة للمنصة
    if (Array.isArray(payRow.application_ids) && payRow.application_ids.length) {
      const ids = payRow.application_ids.map(id => `"${id}"`).join(',');
      await sbPatch(`applications?id=in.(${ids})`, { platform_paid: true, platform_paid_at: new Date().toISOString() });
      // إشعار المعلنين إن دفعتهم مضمونة الآن
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
    return { status: 'paid' };
  }
  if (['canceled', 'expired', 'failed'].includes(inv.status)) {
    await sbPatch(`payments_gateway?id=eq.${payRow.id}`, { status: 'failed', raw: inv });
    return { status: 'failed' };
  }
  return { status: 'initiated' };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', SITE);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!MOYASAR_SECRET_KEY) return res.status(500).json({ error: 'بوابة الدفع غير مهيأة بعد' });

  try {
    // ===== تحقق عند العودة من الدفع =====
    if (req.method === 'GET') {
      const ref = (req.query && req.query.ref) || '';
      if (!/^[0-9a-f-]{36}$/.test(ref)) return res.status(400).json({ error: 'bad ref' });
      const rows = await sbGet(`payments_gateway?id=eq.${ref}&select=*`);
      if (!rows || !rows[0]) return res.status(404).json({ error: 'not found' });
      const out = await verifyAndSettle(rows[0]);
      return res.status(200).json(out);
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'method' });

    // ===== إنشاء فاتورة =====
    const caller = await getCallerUser(req);
    if (!caller) return res.status(401).json({ error: 'سجّل دخولك أولاً' });

    const { campaign_id } = req.body || {};
    if (!campaign_id || !/^[0-9a-f-]{36}$/.test(campaign_id)) return res.status(400).json({ error: 'bad campaign' });

    const camps = await sbGet(`campaigns?id=eq.${campaign_id}&select=id,title,brand_id`);
    const camp = camps && camps[0];
    if (!camp) return res.status(404).json({ error: 'الحملة غير موجودة' });
    if (camp.brand_id !== caller.id) return res.status(403).json({ error: 'هذه الحملة ليست لك' });

    // الصفقات المعتمدة غير المدفوعة
    const items = await sbRpc('campaign_unpaid_summary', { p_campaign_id: campaign_id });
    if (!items || !items.length) return res.status(400).json({ error: 'ما فيه صفقات معتمدة بانتظار الدفع' });

    const totalSar = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
    if (totalSar <= 0) return res.status(400).json({ error: 'المبلغ غير صالح' });

  // عمولة المنصة حسب باقة الشركة
  // تفشل مغلقة: لا تُنشأ فاتورة بعمولة صفر بصمت
  let commissionPct = null;
  try {
    const planRows = await sbGet(`users?id=eq.${caller.id}&select=plan_code,plan_expires_at`);
    let pcode = (planRows && planRows[0] && planRows[0].plan_code) || 'trial';
    const pexp = planRows && planRows[0] && planRows[0].plan_expires_at;
    const FREE_CODES = ['trial', 'trial_legacy'];
    if (!FREE_CODES.includes(pcode) && (!pexp || new Date(pexp) < new Date())) pcode = 'trial';
    const pl = await sbGet(`plans?code=eq.${pcode}&select=commission_pct`);
    const raw = pl && pl[0] ? pl[0].commission_pct : null;
    if (raw !== null && raw !== undefined && isFinite(Number(raw))) commissionPct = Number(raw);
  } catch (e) { commissionPct = null; }
  if (commissionPct === null || commissionPct < 0 || commissionPct > 50) {
    console.error('commission lookup failed or out of range:', commissionPct);
    return res.status(503).json({ error: 'تعذّر تحديد عمولة باقتك الآن. حاول بعد قليل أو تواصل معنا.' });
  }
  const commissionSar = Math.round(totalSar * commissionPct) / 100;
  const grossSar = Math.round((totalSar + commissionSar) * 100) / 100;


    // سجل الدفع عندنا أولاً (المرجع)
    const payRows = await sbInsert('payments_gateway', {
      campaign_id, brand_id: caller.id,
      application_ids: items.map(it => it.application_id),
      amount_halalas: Math.round(grossSar * 100),
      commission_pct: commissionPct,
      commission_sar: commissionSar,
      net_sar: totalSar,
      description: `مستحقات حملة «${camp.title}» — ${items.length} صفقة`,
      status: 'initiated'
    });
    const payRow = payRows[0];

    // فاتورة ميسر
    const invRes = await fetch(`${MOYASAR_API}/invoices`, {
      method: 'POST',
      headers: { 'Authorization': moyasarAuth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Math.round(grossSar * 100),
        currency: 'SAR',
        description: `Flfluencer — ${camp.title} (${items.length} صفقة)`,
        success_url: `${SITE}/pay-result.html?ref=${payRow.id}`,
        back_url: `${SITE}/campaigns.html`,
        metadata: { payment_ref: payRow.id, campaign_id }
      })
    });
    if (!invRes.ok) {
      console.error('moyasar invoice:', await invRes.text());
      await sbPatch(`payments_gateway?id=eq.${payRow.id}`, { status: 'failed' });
      return res.status(502).json({ error: 'تعذّر إنشاء الفاتورة — حاول بعد قليل' });
    }
    const inv = await invRes.json();
    await sbPatch(`payments_gateway?id=eq.${payRow.id}`, { moyasar_invoice_id: inv.id });

    return res.status(200).json({ url: inv.url, ref: payRow.id, amount: grossSar, net: totalSar, commission: commissionSar, commission_pct: commissionPct, deals: items.length });
  } catch (err) {
    console.error('pay-create error:', err);
    return res.status(500).json({ error: 'خطأ داخلي' });
  }
};
