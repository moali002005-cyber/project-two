// Vercel Serverless Function: /api/sub-create
// POST { plan, period }  + Authorization: Bearer <brand session token>
//   -> starts a pending subscription, creates a Moyasar invoice, returns the payment url.
// GET ?ref=<subscription_id>
//   -> asks Moyasar directly about the invoice (server-to-server) and activates the plan.

const SUPABASE_URL = "https://chpzecgpylxqsutjydkb.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const MOYASAR_SECRET_KEY = process.env.MOYASAR_SECRET_KEY || "";
const MOYASAR_API = "https://api.moyasar.com/v1";
const SITE = "https://www.flfluencer.com";

function svcHeaders() {
  return { apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY, "Content-Type": "application/json" };
}
function moyasarAuth() {
  return "Basic " + Buffer.from(MOYASAR_SECRET_KEY + ":").toString("base64");
}
async function sbGet(path) {
  const r = await fetch(SUPABASE_URL + "/rest/v1/" + path, { headers: svcHeaders() });
  if (!r.ok) return null;
  return r.json();
}
async function sbPatch(path, body) {
  return fetch(SUPABASE_URL + "/rest/v1/" + path, {
    method: "PATCH",
    headers: Object.assign(svcHeaders(), { Prefer: "return=minimal" }),
    body: JSON.stringify(body)
  });
}
async function sbRpcService(fn, args) {
  const r = await fetch(SUPABASE_URL + "/rest/v1/rpc/" + fn, {
    method: "POST", headers: svcHeaders(), body: JSON.stringify(args || {})
  });
  if (!r.ok) { console.error("rpc " + fn, await r.text()); return null; }
  return r.json();
}
async function sbRpcAsUser(fn, args, token) {
  const r = await fetch(SUPABASE_URL + "/rest/v1/rpc/" + fn, {
    method: "POST",
    headers: { apikey: SERVICE_KEY, Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(args || {})
  });
  const txt = await r.text();
  if (!r.ok) return { error: txt };
  try { return JSON.parse(txt); } catch (e) { return { error: "bad rpc response" }; }
}

async function callerToken(req) {
  const h = req.headers.authorization || req.headers.Authorization || "";
  if (!h.startsWith("Bearer ")) return null;
  const token = h.slice(7);
  const res = await fetch(SUPABASE_URL + "/auth/v1/user", {
    headers: { apikey: SERVICE_KEY, Authorization: "Bearer " + token }
  });
  if (!res.ok) return null;
  const u = await res.json();
  if (!u || !u.id) return null;
  return token;
}

async function verifyAndActivate(sub) {
  if (!sub || !sub.moyasar_invoice_id) return { status: sub ? sub.status : "unknown" };
  if (sub.status === "paid") return { status: "paid" };
  const res = await fetch(MOYASAR_API + "/invoices/" + sub.moyasar_invoice_id, { headers: { Authorization: moyasarAuth() } });
  if (!res.ok) { console.error("moyasar fetch:", await res.text()); return { status: sub.status }; }
  const inv = await res.json();
  if (inv.status === "paid") {
    const paymentId = (inv.payments && inv.payments[0] && inv.payments[0].id) || null;
    await sbPatch("subscriptions?id=eq." + sub.id, { moyasar_payment_id: paymentId, raw: inv });
    await sbRpcService("activate_subscription", { p_sub: sub.id });
    return { status: "paid" };
  }
  if (["canceled", "expired", "failed"].includes(inv.status)) {
    await sbPatch("subscriptions?id=eq." + sub.id, { status: "failed", raw: inv });
    return { status: "failed" };
  }
  return { status: sub.status };
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", SITE);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (!MOYASAR_SECRET_KEY || !SERVICE_KEY) {
    return res.status(500).json({ error: "بوابة الدفع غير مهيأة بعد" });
  }

  if (req.method === "GET") {
    const ref = (req.query && req.query.ref) || "";
    if (!/^[0-9a-f-]{36}$/.test(ref)) return res.status(400).json({ error: "bad ref" });
    const rows = await sbGet("subscriptions?id=eq." + ref + "&select=*");
    const sub = rows && rows[0];
    if (!sub) return res.status(404).json({ error: "not found" });
    const out = await verifyAndActivate(sub);
    return res.status(200).json(out);
  }

  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  const token = await callerToken(req);
  if (!token) return res.status(401).json({ error: "سجّل دخولك أولاً" });

  let body = req.body || {};
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const plan = String(body.plan || "");
  const period = String(body.period || "monthly");
  if (!/^[a-z]{3,12}$/.test(plan)) return res.status(400).json({ error: "bad plan" });
  if (period !== "monthly" && period !== "yearly") return res.status(400).json({ error: "bad period" });

  const started = await sbRpcAsUser("start_subscription", { p_plan: plan, p_period: period }, token);
  if (!started || started.error || !started.subscription_id) {
    return res.status(400).json({ error: "تعذّر بدء الاشتراك" });
  }
  const sid = started.subscription_id;
  const amount = Number(started.amount || 0);
  if (!(amount > 0)) return res.status(400).json({ error: "المبلغ غير صالح" });

  const planRows = await sbGet("plans?code=eq." + plan + "&select=name_ar");
  const planName = (planRows && planRows[0] && planRows[0].name_ar) || plan;

  const invRes = await fetch(MOYASAR_API + "/invoices", {
    method: "POST",
    headers: { Authorization: moyasarAuth(), "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: Math.round(amount * 100),
      currency: "SAR",
      description: "Flfluencer - اشتراك باقة " + planName + " (" + (period === "yearly" ? "سنوي" : "شهري") + ")",
      success_url: SITE + "/plans.html?sub_ref=" + sid,
      back_url: SITE + "/plans.html",
      metadata: { subscription_ref: sid, plan: plan, period: period }
    })
  });
  if (!invRes.ok) {
    console.error("moyasar invoice:", await invRes.text());
    await sbPatch("subscriptions?id=eq." + sid, { status: "failed" });
    return res.status(502).json({ error: "تعذّر إنشاء الفاتورة" });
  }
  const inv = await invRes.json();
  await sbPatch("subscriptions?id=eq." + sid, { moyasar_invoice_id: inv.id });

  return res.status(200).json({ url: inv.url, ref: sid, amount: amount, plan: plan, period: period });
};
