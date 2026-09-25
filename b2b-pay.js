// ===== خيارات دفع الحملة: ادفع الآن (بطاقة / تحويل بنكي) أو الدفع الآجل للشركات =====
// يظهر بعد اعتماد أسماء المعلنين، مكان زر «الدفع الآن» في صفحة الحملات.
(function () {
  var css = ''
    + '.pm-ov{position:fixed;inset:0;z-index:2000;background:rgba(15,20,32,.5);display:none;align-items:center;justify-content:center;padding:16px}'
    + '.pm-ov.on{display:flex}'
    + '.pm-box{background:#fff;border-radius:20px;max-width:540px;width:100%;max-height:92vh;overflow:auto;padding:24px 22px;box-shadow:0 24px 60px rgba(0,0,0,.25);position:relative;text-align:right}'
    + '.pm-x{position:absolute;top:12px;left:14px;border:0;background:#F4F5F7;border-radius:50%;width:32px;height:32px;font-size:18px;cursor:pointer;color:#2C3548}'
    + '.pm-box h2{font-size:19px;font-weight:700;margin:0 0 4px}'
    + '.pm-sub{font-size:13px;color:#8A93A6;margin-bottom:14px;line-height:1.8}'
    + '.pm-sum{background:#F4F5F7;border-radius:12px;padding:11px 14px;font-size:13.5px;margin-bottom:12px;line-height:1.9}'
    + '.pm-sum .t{display:flex;justify-content:space-between;gap:10px}.pm-sum .t.tot{font-weight:700;border-top:1px solid #E1E4EA;margin-top:4px;padding-top:4px}'
    + '.pm-opt{border:1.5px solid rgba(15,20,32,.1);border-radius:16px;padding:16px 16px 14px;margin-bottom:12px}'
    + '.pm-opt h3{margin:0 0 2px;font-size:16px}'
    + '.pm-opt p{font-size:13px;color:#2C3548;margin:0 0 12px;line-height:1.8}'
    + '.pm-opt.b2b{border-color:#0F1420;background:#FAFBFC}'
    + '.pm-btns{display:flex;gap:8px;flex-wrap:wrap}'
    + '.pm-btns button{flex:1 1 150px;font-family:inherit;font-size:14px;font-weight:700;border-radius:12px;padding:11px 12px;cursor:pointer;border:1.5px solid #E23B2E;background:#E23B2E;color:#fff}'
    + '.pm-btns button.alt{background:#fff;color:#E23B2E}.pm-btns button.dark{background:#0F1420;border-color:#0F1420}'
    + '.pm-tags{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px}'
    + '.pm-tags span{font-size:11.5px;font-weight:600;background:#fff;border:1px solid rgba(15,20,32,.1);border-radius:100px;padding:3px 10px;color:#2C3548}'
    + '.pm-f label{display:block;font-size:12.5px;font-weight:700;color:#0F1420;margin:10px 2px 5px}'
    + '.pm-f input,.pm-f select,.pm-f textarea{width:100%;box-sizing:border-box;font-family:inherit;font-size:14.5px;padding:11px 12px;border:1.5px solid #E1E4EA;border-radius:11px;background:#fff;color:#0F1420}'
    + '.pm-f input:focus,.pm-f select:focus,.pm-f textarea:focus{outline:none;border-color:#E23B2E}'
    + '.pm-f .row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}'
    + '.pm-f .chk{display:flex;align-items:center;gap:9px;font-size:13.5px;font-weight:600;margin-top:12px;cursor:pointer}'
    + '.pm-f .chk input{width:18px;height:18px;accent-color:#E23B2E}'
    + '.pm-err{display:none;background:#FDF1F0;color:#B02A20;border-radius:10px;padding:9px 12px;font-size:13px;margin-top:12px}'
    + '.pm-submit{margin-top:16px;width:100%;font-family:inherit;font-size:15px;font-weight:700;border:0;border-radius:12px;padding:13px;background:#E23B2E;color:#fff;cursor:pointer}'
    + '.pm-submit:disabled{opacity:.6;cursor:default}'
    + '.b2b-inline{border:1.5px solid #0F1420;border-radius:14px;padding:12px 14px;margin:10px 0;background:#FAFBFC;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}'
    + '.b2b-inline .l{font-size:13.5px;line-height:1.7}.b2b-inline .l small{display:block;color:#8A93A6;font-size:12px}'
    + '.b2b-inline button{font-family:inherit;font-size:13px;font-weight:700;border-radius:10px;padding:8px 14px;cursor:pointer;border:0;background:#0F1420;color:#fff}'
    + '.b2b-inline button.go{background:#E23B2E}'
    + '.b2b-chip{font-size:12px;font-weight:700;border-radius:100px;padding:3px 11px;background:#F4F5F7;color:#2C3548;white-space:nowrap;display:inline-block}'
    + '.b2b-chip.good{background:#E8F5F0;color:#1D8F6B}.b2b-chip.warn{background:#FBF0E4;color:#9A4B06}.b2b-chip.bad{background:#FDECEA;color:#C0392B}'
    + '.b2b-ref{font-size:12px;color:#8A93A6;direction:ltr;unicode-bidi:isolate}'
    + '.b2b-kv{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px 16px;margin:14px 0;font-size:13.5px}'
    + '.b2b-kv div span{display:block;font-size:11.5px;color:#8A93A6}.b2b-kv div b{font-weight:700}'
    + '.b2b-steps{display:flex;gap:4px;margin:12px 0 4px;overflow-x:auto;padding-bottom:4px}'
    + '.b2b-steps .st{flex:1 0 60px;text-align:center;font-size:10.5px;color:#8A93A6;line-height:1.4}'
    + '.b2b-steps .st i{display:block;height:6px;border-radius:6px;background:#E7E9EE;margin-bottom:6px}'
    + '.b2b-steps .st.done i{background:#1D8F6B}.b2b-steps .st.now i{background:#E23B2E}.b2b-steps .st.now{color:#0F1420;font-weight:700}'
    + '.b2b-act{border-top:1px dashed rgba(15,20,32,.12);margin-top:12px;padding-top:12px}'
    + '.b2b-act .agr{background:#fff;border:1px solid rgba(15,20,32,.1);border-radius:12px;padding:12px 14px;font-size:13px;line-height:1.95;max-height:240px;overflow:auto;margin-bottom:10px}'
    + '.b2b-act .agr ol{padding-inline-start:18px;margin:6px 0 0}'
    + '.b2b-info{font-size:13.5px;color:#2C3548;line-height:1.8}'
    + '@media (max-width:480px){.pm-f .row2{grid-template-columns:1fr}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
})();

var B2B_ST = { new:'طلب دفع آجل جديد', quote_sent:'تم إرسال عرض السعر', awaiting_po:'بانتظار PO', awaiting_agreement:'بانتظار قبول الاتفاقية',
  awaiting_nafith:'بانتظار سند نافذ', nafith_accepted:'تم قبول السند ✅', invoiced:'تم إصدار الفاتورة', active:'الحملة فعّالة',
  due_soon:'مستحق قريبًا', overdue:'متأخر عن السداد ⚠️', paid:'مدفوع ✅', cancelled:'ملغى' };
var B2B_TERMS = { net15:'Net 15', net30:'Net 30', net60:'Net 60' };
window.B2B_REQS = [];
var B2B_CTX = { campaignId: null, method: 'deferred', quote: null, me: null };

function b2bEsc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function b2bMoney(n){ return Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }); }
function b2bSb(){ return window.supabaseClient; }

// آخر طلب قائم لهالحملة (يختفي بعد السداد أو الإلغاء)
function b2bReqFor(campaignId){
  var list = (window.B2B_REQS || []).filter(function(r){ return r.campaign_id === campaignId && r.status !== 'cancelled' && r.status !== 'paid'; });
  return list[0] || null;
}
async function b2bLoad(){
  try { var r = await b2bSb().rpc('b2b_my_requests'); window.B2B_REQS = (r && Array.isArray(r.data)) ? r.data : []; }
  catch (e) { window.B2B_REQS = []; }
}

function b2bChipCls(s){ return (s==='paid'||s==='active'||s==='nafith_accepted') ? 'good' : s==='overdue' ? 'bad' : (s==='due_soon'||s==='awaiting_po'||s==='awaiting_agreement'||s==='awaiting_nafith') ? 'warn' : ''; }
function b2bNeedsBrand(r){
  if (r.method === 'bank_transfer') return false;
  if ((r.status==='quote_sent' || r.status==='awaiting_po') && r.po_required && !r.po_number) return true;
  return r.status==='quote_sent' || r.status==='awaiting_agreement';
}
// السطر اللي يظهر مكان زر الدفع
function b2bInlineHtml(r){
  var label = r.method==='bank_transfer' ? '🏦 دفع بتحويل بنكي' : '💼 الدفع الآجل للشركات';
  var need = b2bNeedsBrand(r);
  return '<div class="b2b-inline"><div class="l"><b>' + label + '</b> <span class="b2b-chip ' + b2bChipCls(r.status) + '">' + b2bEsc(B2B_ST[r.status]||r.status) + '</span>'
    + '<small><span class="b2b-ref">' + b2bEsc(r.ref) + '</span> · ' + b2bMoney(r.contract_value) + ' ر.س' + (r.due_date ? ' · الاستحقاق ' + b2bEsc(r.due_date) : '') + '</small></div>'
    + '<button class="' + (need ? 'go' : '') + '" onclick="event.stopPropagation(); b2bOpenDetails(\'' + r.id + '\')">' + (need ? 'مطلوب منك إجراء ←' : 'التفاصيل') + '</button></div>';
}

function b2bEnsureDom(){
  if (document.getElementById('pay-opt-modal')) return;
  var wrap = document.createElement('div');
  wrap.innerHTML = ''
    + '<div class="pm-ov" id="pay-opt-modal" role="dialog" aria-modal="true" aria-labelledby="po-title"><div class="pm-box">'
    +   '<button class="pm-x" onclick="b2bClose(\'pay-opt-modal\')" aria-label="إغلاق">×</button>'
    +   '<h2 id="po-title">اختر طريقة الدفع</h2><div class="pm-sub" id="po-sub"></div>'
    +   '<div class="pm-sum" id="po-sum">جاري حساب المبلغ…</div>'
    +   '<div class="pm-opt"><h3>ادفع الآن</h3><p>تنطلق الحملة فور تأكيد السداد.</p><div class="pm-btns">'
    +     '<button onclick="b2bPayCard()">💳 بطاقة (مدى / Visa / Mastercard)</button>'
    +     '<button class="alt" onclick="b2bOpenForm(\'bank_transfer\')">🏦 تحويل بنكي</button></div></div>'
    +   '<div class="pm-opt b2b"><h3>الدفع الآجل للشركات</h3><p>للشركات اللي تدفع بنظام المشتريات وبفاتورة مؤسسية: الحملة تنطلق حسب شروط الاتفاق، والسداد في تاريخ الاستحقاق.</p>'
    +     '<div class="pm-tags"><span>عرض سعر</span><span>PO عند الحاجة</span><span>فاتورة مؤسسية</span><span>سند إلكتروني عبر نافذ</span><span>Net 15 / 30 / 60</span></div>'
    +     '<div class="pm-btns"><button class="dark" onclick="b2bOpenForm(\'deferred\')">طلب الدفع الآجل ←</button></div></div>'
    + '</div></div>'
    + '<div class="pm-ov" id="b2b-form-modal" role="dialog" aria-modal="true" aria-labelledby="bf-title"><div class="pm-box">'
    +   '<button class="pm-x" onclick="b2bClose(\'b2b-form-modal\')" aria-label="إغلاق">×</button>'
    +   '<h2 id="bf-title">الدفع الآجل للشركات</h2><div class="pm-sub" id="bf-sub"></div><div class="pm-sum" id="bf-sum"></div>'
    +   '<div class="pm-f">'
    +     '<label for="bf-company">اسم الشركة (كما في السجل التجاري)</label><input id="bf-company" autocomplete="organization">'
    +     '<label for="bf-cr">رقم السجل التجاري</label><input id="bf-cr" inputmode="numeric">'
    +     '<label for="bf-fname">مسؤول المالية</label><input id="bf-fname" placeholder="الاسم">'
    +     '<div class="row2"><div><label for="bf-femail">إيميل المالية</label><input id="bf-femail" type="email" dir="ltr"></div>'
    +     '<div><label for="bf-fphone">جوال المالية</label><input id="bf-fphone" type="tel" dir="ltr" placeholder="05xxxxxxxx"></div></div>'
    +     '<div id="bf-deferred-only"><label for="bf-terms">شروط الدفع</label><select id="bf-terms">'
    +       '<option value="net15">Net 15 — السداد خلال 15 يوم من الفاتورة</option>'
    +       '<option value="net30" selected>Net 30 — السداد خلال 30 يوم من الفاتورة</option>'
    +       '<option value="net60">Net 60 — السداد خلال 60 يوم من الفاتورة</option></select>'
    +       '<label class="chk"><input type="checkbox" id="bf-po"> عندنا نظام مشتريات ونحتاج نصدر أمر شراء (PO)</label></div>'
    +     '<label for="bf-notes">ملاحظات (اختياري)</label><textarea id="bf-notes" rows="2"></textarea>'
    +   '</div><div class="pm-err" id="bf-err"></div>'
    +   '<button class="pm-submit" id="bf-submit" onclick="b2bSubmit()">إرسال الطلب</button>'
    + '</div></div>'
    + '<div class="pm-ov" id="b2b-det-modal" role="dialog" aria-modal="true"><div class="pm-box" id="b2b-det"></div></div>';
  while (wrap.firstChild) document.body.appendChild(wrap.firstChild);
  ['pay-opt-modal','b2b-form-modal','b2b-det-modal'].forEach(function(id){
    var m = document.getElementById(id);
    m.addEventListener('click', function(e){ if (e.target === m) b2bClose(id); });
  });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape') ['pay-opt-modal','b2b-form-modal','b2b-det-modal'].forEach(b2bClose); });
}
function b2bClose(id){ var m = document.getElementById(id); if (m) m.classList.remove('on'); }

function b2bSumHtml(q){
  if (!q) return '';
  return '<div class="t"><span>' + b2bEsc(q.title || 'الحملة') + ' — ' + q.deals + (q.deals === 1 ? ' صفقة معتمدة' : ' صفقات معتمدة') + '</span></div>'
    + '<div class="t"><span>مستحقات المعلنين</span><b>' + b2bMoney(q.net) + ' ر.س</b></div>'
    + '<div class="t"><span>عمولة المنصة (' + b2bMoney(q.pct) + '٪)</span><b>' + b2bMoney(q.commission) + ' ر.س</b></div>'
    + '<div class="t tot"><span>الإجمالي</span><b>' + b2bMoney(q.total) + ' ر.س</b></div>';
}

// زر «الدفع الآن» في الحملة يفتح هذي النافذة
async function openPayOptions(campaignId){
  b2bEnsureDom();
  B2B_CTX.campaignId = campaignId; B2B_CTX.quote = null;
  var camp = (window.myCampaigns || (typeof myCampaigns !== 'undefined' ? myCampaigns : []) || []).find(function(x){ return x.id === campaignId; });
  document.getElementById('po-sub').textContent = 'اعتمدت أسماء المعلنين — باقي خطوة الدفع عشان تنطلق حملة «' + ((camp && camp.title) || '') + '».';
  document.getElementById('po-sum').textContent = 'جاري حساب المبلغ…';
  document.getElementById('pay-opt-modal').classList.add('on');
  try {
    var r = await b2bSb().rpc('b2b_campaign_quote', { p_campaign: campaignId });
    if (r.error || !r.data || r.data.error) throw new Error('quote');
    B2B_CTX.quote = r.data;
    document.getElementById('po-sum').innerHTML = b2bSumHtml(r.data);
  } catch (e) { document.getElementById('po-sum').textContent = 'المبلغ يظهر في الفاتورة.'; }
}
function b2bPayCard(){
  b2bClose('pay-opt-modal');
  if (B2B_CTX.campaignId && typeof startCampaignPayment === 'function') startCampaignPayment(B2B_CTX.campaignId);
}
async function b2bMe(){
  if (B2B_CTX.me) return B2B_CTX.me;
  try {
    var s = await b2bSb().auth.getSession(); var uid = s.data.session.user.id;
    var r = await b2bSb().from('users').select('id,name,email,phone,company_name,cr_number').eq('auth_id', uid).maybeSingle();
    B2B_CTX.me = r.data || {};
  } catch (e) { B2B_CTX.me = {}; }
  return B2B_CTX.me;
}
async function b2bOpenForm(method){
  B2B_CTX.method = method;
  b2bClose('pay-opt-modal');
  var me = await b2bMe();
  var bank = method === 'bank_transfer';
  document.getElementById('bf-title').textContent = bank ? 'الدفع بتحويل بنكي' : 'الدفع الآجل للشركات';
  document.getElementById('bf-sub').textContent = bank
    ? 'عبّئ بيانات الفاتورة، ونرسل الفاتورة وبيانات الحساب البنكي على إيميل المالية. تنطلق الحملة أول ما يوصلنا التحويل.'
    : 'عبّئ بيانات شركتك، ونرسل لك عرض السعر خلال يوم عمل. بعدها: PO إذا تحتاجونه ← اتفاقية الخدمة ← سند نافذ ← الفاتورة ← انطلاق الحملة ← السداد في تاريخ الاستحقاق.';
  document.getElementById('bf-deferred-only').style.display = bank ? 'none' : '';
  document.getElementById('bf-sum').innerHTML = b2bSumHtml(B2B_CTX.quote);
  document.getElementById('bf-sum').style.display = B2B_CTX.quote ? '' : 'none';
  var set = function(id, v){ var el = document.getElementById(id); if (el && !el.value) el.value = v || ''; };
  set('bf-company', me.company_name); set('bf-cr', me.cr_number); set('bf-femail', me.email); set('bf-fphone', me.phone);
  document.getElementById('bf-err').style.display = 'none';
  var b = document.getElementById('bf-submit'); b.disabled = false; b.textContent = 'إرسال الطلب';
  document.getElementById('b2b-form-modal').classList.add('on');
}
async function b2bSubmit(){
  var v = function(id){ return (document.getElementById(id).value || '').trim(); };
  var err = document.getElementById('bf-err');
  var fail = function(t){ err.textContent = t; err.style.display = 'block'; };
  if (!v('bf-company')) return fail('اكتب اسم الشركة.');
  if (!v('bf-cr')) return fail('اكتب رقم السجل التجاري.');
  if (!v('bf-fname')) return fail('اكتب اسم مسؤول المالية.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v('bf-femail'))) return fail('اكتب إيميل المالية بشكل صحيح.');
  var b = document.getElementById('bf-submit'); b.disabled = true; b.textContent = 'جاري الإرسال…';
  try {
    var r = await b2bSb().rpc('b2b_campaign_request_create', {
      p_campaign: B2B_CTX.campaignId, p_method: B2B_CTX.method, p_company: v('bf-company'), p_cr: v('bf-cr'),
      p_fin_name: v('bf-fname'), p_fin_email: v('bf-femail'), p_fin_phone: v('bf-fphone'),
      p_terms: document.getElementById('bf-terms').value, p_po_required: document.getElementById('bf-po').checked, p_notes: v('bf-notes') });
    if (r.error) throw r.error;
    if (r.data && r.data.error) {
      b.disabled = false; b.textContent = 'إرسال الطلب';
      var m = { open_request_exists:'فيه طلب دفع قائم لهالحملة — تابعه من صفحة الحملة.', brands_only:'هذا الخيار لحسابات الشركات فقط.',
                no_unpaid_deals:'ما فيه صفقات معتمدة تنتظر الدفع في هالحملة.', not_found:'ما لقينا الحملة.' };
      return fail(m[r.data.error] || 'تعذّر إرسال الطلب، حاول مرة ثانية.');
    }
    b2bClose('b2b-form-modal');
    if (typeof showToast === 'function') showToast(B2B_CTX.method === 'bank_transfer' ? 'وصلنا طلبك ✓ — بنرسل الفاتورة وبيانات الحساب على إيميل المالية' : 'وصلنا طلب الدفع الآجل ✓ — نرسل لك عرض السعر خلال يوم عمل');
    if (typeof loadData === 'function') await loadData();
  } catch (e) { b.disabled = false; b.textContent = 'إرسال الطلب'; fail('تعذّر إرسال الطلب، حاول مرة ثانية.'); }
}

function b2bSteps(r){
  var bank = r.method === 'bank_transfer';
  var seq = bank
    ? [['new','الطلب'],['invoiced','الفاتورة'],['paid','التحويل وانطلاق الحملة']]
    : [['new','الطلب'],['quote_sent','عرض السعر']].concat(r.po_required ? [['awaiting_po','PO']] : []).concat([['awaiting_agreement','الاتفاقية'],['awaiting_nafith','سند نافذ'],['nafith_accepted','قبول السند'],['invoiced','الفاتورة'],['active','انطلاق الحملة'],['paid','السداد']]);
  var order = bank ? ['new','invoiced','paid'] : ['new','quote_sent','awaiting_po','awaiting_agreement','awaiting_nafith','nafith_accepted','invoiced','active','paid'];
  var cur = r.status;
  if (cur === 'due_soon' || cur === 'overdue') cur = bank ? 'invoiced' : 'active';
  var ci = order.indexOf(cur);
  return '<div class="b2b-steps">' + seq.map(function(x){
    var i = order.indexOf(x[0]);
    var c = r.status === 'paid' ? 'done' : (i < ci ? 'done' : (x[0] === cur ? 'now' : ''));
    if (x[0] === 'active' && (r.status === 'due_soon' || r.status === 'overdue')) c = 'done';
    return '<div class="st ' + c + '"><i></i>' + x[1] + '</div>';
  }).join('') + '</div>';
}
function b2bAgreement(r){
  var days = r.payment_terms === 'net15' ? 15 : r.payment_terms === 'net60' ? 60 : 30;
  return '<div class="agr"><b>اتفاقية الخدمة — ملخّص الشروط</b><ol>'
    + '<li>تقدّم فلفلونسر لـ«' + b2bEsc(r.company_name) + '» تنفيذ حملة «' + b2bEsc(r.campaign_title || '') + '» (' + (r.deals || 0) + ' صفقة معتمدة مع المعلنين) بقيمة إجمالية ' + b2bMoney(r.contract_value) + ' ر.س شاملة عمولة المنصة.</li>'
    + '<li>شروط الدفع ' + (B2B_TERMS[r.payment_terms] || '') + ': السداد خلال ' + days + ' يومًا من تاريخ إصدار الفاتورة.</li>'
    + '<li>تُصدر فلفلونسر سندًا لأمر إلكترونيًا عبر منصة «نافذ» بقيمة العقد، ويلتزم الطرف الثاني بقبوله قبل إصدار الفاتورة.</li>'
    + '<li>تنطلق الحملة بعد قبول السند وإصدار الفاتورة المؤسسية، ويبدأ المعلنون التنفيذ.</li>'
    + '<li>في حال التأخر عن السداد بعد تاريخ الاستحقاق، يحق لفلفلونسر إيقاف الحملات والحساب لحين السداد، مع حفظ حقها في المطالبة عبر السند.</li>'
    + '<li>تسري <a href="/terms.html" target="_blank">الشروط والأحكام</a> و<a href="/refund.html" target="_blank">سياسة الاسترجاع والإلغاء</a>.</li></ol></div>';
}
function b2bOpenDetails(id){
  b2bEnsureDom();
  var r = (window.B2B_REQS || []).find(function(x){ return x.id === id; }); if (!r) return;
  var bank = r.method === 'bank_transfer';
  var act = '';
  if (!bank) {
    if ((r.status === 'quote_sent' || r.status === 'awaiting_po') && r.po_required && !r.po_number) {
      act = '<div class="b2b-act pm-f"><b style="font-size:14px">أرسل رقم أمر الشراء (PO)</b>'
        + '<label for="b2b-po-in">رقم PO</label><input id="b2b-po-in" dir="ltr"><div class="pm-err" id="b2b-po-err"></div>'
        + '<button class="pm-submit" onclick="b2bSendPO(\'' + r.id + '\', this)">إرسال رقم PO</button></div>';
    } else if (r.status === 'quote_sent' || r.status === 'awaiting_agreement') {
      act = '<div class="b2b-act pm-f"><b style="font-size:14px">وافق على اتفاقية الخدمة</b>' + b2bAgreement(r)
        + '<label for="b2b-agr-name">اسم المفوّض بالموافقة</label><input id="b2b-agr-name">'
        + '<label class="chk"><input type="checkbox" id="b2b-agr-ok"> قرأت الشروط وأوافق على اتفاقية الخدمة نيابةً عن الشركة</label>'
        + '<div class="pm-err" id="b2b-agr-err"></div><button class="pm-submit" onclick="b2bAcceptAgr(\'' + r.id + '\', this)">أوافق على الاتفاقية</button></div>';
    } else if (r.status === 'new') {
      act = '<div class="b2b-act b2b-info">⏳ استلمنا طلبك، ونرسل لك عرض السعر خلال يوم عمل.</div>';
    } else if (r.status === 'awaiting_nafith') {
      act = '<div class="b2b-act b2b-info">📄 بيوصلكم سند إلكتروني من منصة <b>نافذ</b> على جوال المفوّض — اقبلوه عشان نصدر الفاتورة وتنطلق الحملة.</div>';
    } else if (r.status === 'nafith_accepted') {
      act = '<div class="b2b-act b2b-info">✅ استلمنا قبول السند، ونصدر الفاتورة الآن.</div>';
    } else if (r.status === 'invoiced') {
      act = '<div class="b2b-act b2b-info">🧾 صدرت الفاتورة، والحملة تنطلق حسب شروط الاتفاق.</div>';
    } else if (r.status === 'active' || r.status === 'due_soon') {
      act = '<div class="b2b-act b2b-info">🚀 الحملة منطلقة. السداد في تاريخ الاستحقاق <b>' + b2bEsc(r.due_date || '') + '</b>.</div>';
    }
  } else if (r.status === 'new') {
    act = '<div class="b2b-act b2b-info">⏳ بنرسل الفاتورة وبيانات الحساب البنكي على إيميل المالية. تنطلق الحملة أول ما يوصلنا التحويل.</div>';
  } else if (r.status === 'invoiced' || r.status === 'due_soon') {
    act = '<div class="b2b-act b2b-info">🧾 الفاتورة وبيانات الحساب وصلت على إيميل المالية. تنطلق الحملة أول ما يوصلنا التحويل.</div>';
  }
  if (r.status === 'overdue') act = '<div class="b2b-act b2b-info" style="color:#C0392B;font-weight:600">⚠️ الفاتورة تجاوزت تاريخ الاستحقاق. يُرجى السداد لتجنّب إيقاف الحملة.</div>';
  document.getElementById('b2b-det').innerHTML =
    '<button class="pm-x" onclick="b2bClose(\'b2b-det-modal\')" aria-label="إغلاق">×</button>'
    + '<h2>' + (bank ? '🏦 الدفع بتحويل بنكي' : '💼 الدفع الآجل للشركات') + '</h2>'
    + '<div class="pm-sub"><span class="b2b-ref">' + b2bEsc(r.ref) + '</span> · حملة «' + b2bEsc(r.campaign_title || '') + '» &nbsp;<span class="b2b-chip ' + b2bChipCls(r.status) + '">' + b2bEsc(B2B_ST[r.status] || r.status) + '</span></div>'
    + b2bSteps(r)
    + '<div class="b2b-kv">'
    + '<div><span>قيمة العقد</span><b>' + b2bMoney(r.contract_value) + ' ر.س</b></div>'
    + '<div><span>الصفقات</span><b>' + (r.deals || 0) + '</b></div>'
    + (!bank ? '<div><span>شروط الدفع</span><b>' + (B2B_TERMS[r.payment_terms] || '') + '</b></div>' : '')
    + (r.po_number ? '<div><span>رقم PO</span><b dir="ltr">' + b2bEsc(r.po_number) + '</b></div>' : '')
    + (r.nafith_number ? '<div><span>رقم سند نافذ</span><b dir="ltr">' + b2bEsc(r.nafith_number) + '</b></div>' : '')
    + (r.invoice_number ? '<div><span>رقم الفاتورة</span><b dir="ltr">' + b2bEsc(r.invoice_number) + '</b></div>' : '')
    + (r.due_date ? '<div><span>تاريخ الاستحقاق</span><b>' + b2bEsc(r.due_date) + '</b></div>' : '')
    + '</div>' + act;
  document.getElementById('b2b-det-modal').classList.add('on');
}
async function b2bRefreshOpen(id){
  await b2bLoad();
  if (typeof loadData === 'function') await loadData();
  var still = (window.B2B_REQS || []).find(function(x){ return x.id === id; });
  if (still) b2bOpenDetails(id); else b2bClose('b2b-det-modal');
}
async function b2bSendPO(id, btn){
  var v = (document.getElementById('b2b-po-in').value || '').trim(), e = document.getElementById('b2b-po-err');
  if (!v) { e.textContent = 'اكتب رقم أمر الشراء.'; e.style.display = 'block'; return; }
  btn.disabled = true;
  var r = await b2bSb().rpc('b2b_submit_po', { p_id: id, p_po: v });
  if (r.error || (r.data && r.data.error)) { btn.disabled = false; e.textContent = 'تعذّر الإرسال، حاول مرة ثانية.'; e.style.display = 'block'; return; }
  b2bRefreshOpen(id);
}
async function b2bAcceptAgr(id, btn){
  var n = (document.getElementById('b2b-agr-name').value || '').trim(), ok = document.getElementById('b2b-agr-ok').checked, e = document.getElementById('b2b-agr-err');
  if (!n) { e.textContent = 'اكتب اسم المفوّض.'; e.style.display = 'block'; return; }
  if (!ok) { e.textContent = 'علّم على الموافقة على الشروط.'; e.style.display = 'block'; return; }
  btn.disabled = true;
  var r = await b2bSb().rpc('b2b_accept_agreement', { p_id: id, p_signer: n });
  if (r.error || (r.data && r.data.error)) { btn.disabled = false; e.textContent = (r.data && r.data.error === 'po_first') ? 'أرسل رقم PO أولًا.' : 'تعذّر الحفظ، حاول مرة ثانية.'; e.style.display = 'block'; return; }
  b2bRefreshOpen(id);
}
