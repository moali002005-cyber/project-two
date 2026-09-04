// إعدادات Supabase لـ Flfluencer
const SUPABASE_URL = 'https://chpzecgpylxqsutjydkb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNocHplY2dweWx4cXN1dGp5ZGtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyODgxNzQsImV4cCI6MjA5OTg2NDE3NH0.q4wmWKtJ5IPx8AgzMkp3SuFLZL9F10qKc3qiX5LB7kI';

if (!window.supabase) {
  console.error('Supabase library not loaded!');
}

// ===== وضع «جلسة مستقلة لكل تبويب» (للاختبار فقط) =====
// افتح أي صفحة بـ ?multi=1 فيصير لهذا التبويب تسجيل دخول مستقل تماماً عن بقية
// التبويبات: نستخدم sessionStorage (خاص بالتبويب) بدل localStorage (مشترك بينها)،
// ونوقف كوكي الاستعادة لأنها مشتركة كذلك. الوسم يُحفظ في sessionStorage فيبقى مع
// التنقّل داخل نفس التبويب ويموت بإغلاقه.
// أي تبويب لم يُفتح بهذا الوسم يبقى على سلوكه الأصلي حرفياً بلا أي تغيير.
window.__flfMultiSession = false;
try {
  if (new URLSearchParams(window.location.search).get('multi') === '1') {
    window.sessionStorage.setItem('flf_multi', '1');
  }
  window.__flfMultiSession = (window.sessionStorage.getItem('flf_multi') === '1');
} catch (e) { window.__flfMultiSession = false; }

function flfStore() {
  try { return window.__flfMultiSession ? window.sessionStorage : window.localStorage; }
  catch (e) { return window.localStorage; }
}

// إعدادات الجلسة: حفظ دائم + تجديد تلقائي - الجلسة ما تنتهي إلا لما المستخدم نفسه يضغط خروج
window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: flfStore()
  }
});

// ===== مطابقة الموقع (دولة/مدينة) بين الحملة والمعلن — مصدر موحّد للإشعار والخلاصة =====
// القاعدة: لا دولة على الحملة → الجميع · دولة بلا مدينة أو «all» → كل معلني الدولة ·
// دولة + مدينة محددة → نفس المدينة + معلني الدولة اللي مدينتهم غير مسجّلة (NULL).
function simblLocationMatch(creator, campaign) {
  // استهداف صارم: لا دولة على الحملة → الجميع · دولة → لازم نفس الدولة ·
  // مدينة محددة (غير all) → لازم نفس المدينة بالضبط (معلن بلا مدينة مسجّلة يُحجب).
  const norm = v => (v == null ? '' : String(v).trim().toLowerCase());
  if (!campaign || !campaign.country) return true;                                 // لا دولة → الجميع
  if (!creator || norm(creator.country) !== norm(campaign.country)) return false;  // لازم نفس الدولة
  const campCity = norm(campaign.city);
  if (!campCity || campCity === 'all') return true;                                // كل مدن الدولة
  return norm(creator.city) === campCity;                                          // تطابق المدينة الصارم
}

// ===== استهداف المنصة + نطاق المتابعين (استهداف صارم) =====
// شرائح المتابعين: بداية الشريحة → [الحد الأدنى, الحد الأعلى)
const SIMBL_FOLLOWER_BUCKETS = {
  '10000':[10000,20000], '20000':[20000,50000], '50000':[50000,100000],
  '100000':[100000,200000], '200000':[200000,300000], '300000':[300000,500000],
  '500000':[500000,700000], '700000':[700000,1000000], '1000000':[1000000,2000000],
  '2000000':[2000000,Infinity], '3000000':[3000000,Infinity], '4000000':[4000000,Infinity]
};

// المنصة: لا منصة على الحملة → الجميع · منصة محددة → لازم نفس منصة المعلن (معلن بلا منصة يُحجب)
function simblPlatformMatch(creator, campaign) {
  const cp = (campaign && campaign.platform != null) ? String(campaign.platform).trim().toLowerCase() : '';
  if (!cp) return true;
  const up = (creator && creator.platform != null) ? String(creator.platform).trim().toLowerCase() : '';
  return up === cp;
}

// المتابعون: لا نطاق على الحملة → الجميع · نطاق محدد → متابعو المعلن ضمن إحدى الشرائح المختارة
// (معلن متابعوه غير معروفين/صفر يُحجب من الحملات المحددة النطاق)
function simblFollowerMatch(creator, campaign) {
  const raw = (campaign && campaign.follower_range != null) ? String(campaign.follower_range).trim() : '';
  if (!raw) return true;
  const buckets = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (!buckets.length) return true;
  const f = Number(creator && creator.followers);
  if (!isFinite(f) || f <= 0) return false;
  return buckets.some(b => {
    const rng = SIMBL_FOLLOWER_BUCKETS[b];
    return rng ? (f >= rng[0] && f < rng[1]) : false;
  });
}

// التصنيف (Micro (UGC) / Medium / Mega): لا تصنيف على الحملة → الجميع ·
// تصنيف محدّد → لازم تصنيف المعلن ضمن المختار (معلن بلا تصنيف يُحجب من الحملات المصنّفة)
function simblTierMatch(creator, campaign) {
  const raw = (campaign && campaign.creator_tiers != null) ? String(campaign.creator_tiers).trim() : '';
  if (!raw) return true;
  const tiers = raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!tiers.length) return true;
  const ct = (creator && creator.creator_tier != null) ? String(creator.creator_tier).trim().toLowerCase() : '';
  if (!ct) return false;
  return tiers.includes(ct);
}

// مطابقة موحّدة: الدولة + المدينة + المنصة + نطاق المتابعين + التصنيف
function simblTargetMatch(creator, campaign) {
  return simblLocationMatch(creator, campaign)
      && simblPlatformMatch(creator, campaign)
      && simblFollowerMatch(creator, campaign)
      && simblTierMatch(creator, campaign);
}

// سبب قفل الحملة للمعلن غير المطابق (أول بُعد غير مطابق) — تُعرض الحملة للاطّلاع لكن بلا دخول
function simblLockReason(creator, campaign) {
  const norm = v => (v == null ? '' : String(v).trim().toLowerCase());
  if (!simblLocationMatch(creator, campaign)) {
    const COUNTRY = { sa:'السعودية', ae:'الإمارات', qa:'قطر', kw:'الكويت', bh:'البحرين' };
    if (campaign && campaign.country && norm(creator && creator.country) === norm(campaign.country)
        && campaign.city && norm(campaign.city) !== 'all') {
      return 'هذي الحملة لمعلني مدينة محدّدة';
    }
    const cc = campaign && campaign.country ? (COUNTRY[norm(campaign.country)] || campaign.country) : '';
    return cc ? ('هذي الحملة لمعلني ' + cc) : 'هذي الحملة لمنطقة مختلفة';
  }
  if (!simblPlatformMatch(creator, campaign)) {
    const P = { tiktok:'تيك توك', snapchat:'سناب شات', x:'إكس', instagram:'انستقرام', youtube:'يوتيوب' };
    const p = P[norm(campaign.platform)] || campaign.platform;
    return 'هذي الحملة للنشر على ' + p;
  }
  if (!simblFollowerMatch(creator, campaign)) {
    return 'هذي الحملة لنطاق متابعين مختلف عن نطاقك';
  }
  if (!simblTierMatch(creator, campaign)) {
    const T = { micro:'Micro (UGC)', medium:'Medium', mega:'Mega' };
    const names = String((campaign && campaign.creator_tiers) || '')
      .split(',').map(s => T[s.trim().toLowerCase()] || s.trim()).filter(Boolean).join('، ');
    return names ? ('هذي الحملة لتصنيف: ' + names) : 'هذي الحملة لتصنيف مختلف';
  }
  return '';
}

// ============ إدارة الجلسة: نعتمد على autoRefreshToken المدمج فقط ============
// أزلنا التجديد اليدوي المتعدد (كان يستدعي refreshSession عند تبديل التبويب + كل 4 دقائق + عند الفتح)
// لأنه يسبّب "refresh token already used" → تسجيل خروج مفاجئ وعشوائي (خصوصًا مع تعدد التبويبات/الأجهزة).
// المكتبة تجدّد الجلسة لحالها مرة وحدة وبتنسيق آمن بين التبويبات. ونكتفي بالإصغاء لحدث الخروج
// لعرض شاشة "انتهت جلستك" بدل صفحة فاضية — بلا أي استفزاز للتوكن.
try {
  if (window.supabaseClient && window.supabaseClient.auth && window.supabaseClient.auth.onAuthStateChange) {
    window.supabaseClient.auth.onAuthStateChange(function (event) {
      if (event === 'SIGNED_OUT' && !window.__simblLoggingOut) {
        try {
          if (flfStore().getItem('simbl_current_user')
              && typeof simblOnLoginPage === 'function' && !simblOnLoginPage()
              && typeof simblShowSessionExpired === 'function') {
            simblShowSessionExpired();
          }
        } catch (e) { /* تجاهل */ }
      }
    });
  }
} catch (e) { /* تجاهل */ }

// ============ ضمان جلسة Auth طازجة قبل تحميل البيانات ============
// إصلاح "اختفاء الحملات/الأسماء على الجوال بعد يوم": الهوية محفوظة لكن توكن الجلسة
// ينتهي أو يتأخر تحميله عند الفتح البارد، فتُرفض القراءات (RLS) وتبان فاضية.
// هنا نتأكد إن التوكن محمّل ومجدّد قبل أي قراءة.
async function simblEnsureFreshSession() {
  try {
    if (!window.supabaseClient) return;
    const { data } = await supabaseClient.auth.getSession();
    const s = data && data.session;
    if (!s) {
      // ما فيه جلسة محمّلة (توكن راح مؤقتًا على الجوال) → جرّب تجديدها من refresh token المخزّن
      return; // لا نجدّد يدويًا (autoRefreshToken يتكفّل) — نتفادى 'refresh token already used'
    }
    const msLeft = (s.expires_at ? s.expires_at * 1000 : 0) - Date.now();
    // لا نجدّد يدويًا — المكتبة تتكفّل بالتجديد بأمان.
  } catch (e) { /* نكمّل حتى لو فشل الفحص */ }
}

// ترويسات طلبات /api — ترفق توكن الجلسة عشان السيرفر يتحقق من هوية المُرسِل بنفسه
// بدلاً من أن يثق بما يأتي في جسم الطلب.
async function apiAuthHeaders() {
  var h = { 'Content-Type': 'application/json' };
  try {
    var s = await supabaseClient.auth.getSession();
    var t = s && s.data && s.data.session && s.data.session.access_token;
    if (t) h['Authorization'] = 'Bearer ' + t;
  } catch (e) {}
  return h;
}

async function dbSignup(userData) {
  const { data, error } = await supabaseClient
    .from('users')
    .insert([userData])
    .select('id, role, name, platform, handle, followers, category, bio, company_name, industry, size, position, website, created_at, auth_id, approval_status, cr_number, is_test, avatar_url, country, city, creator_tier')
    .single();
  if (error) throw error;
  return data;
}

async function dbGetCampaigns() {
  const { data, error } = await supabaseClient
    .from('campaigns')
    .select('*, users!campaigns_brand_id_fkey(company_name)')
    .eq('is_direct', false)
    .in('status', ['active', 'closed', 'completed'])
    .eq('is_test', !!getCurrentUser()?.is_test)
    .order('created_at', { ascending: false });
  if (error) throw error;

  // فلترة الموقع: المعلن يشوف فقط الحملات اللي تستهدف دولته/مدينته.
  // إصلاح fail-open: بدل ما نعرض كل الحملات لمعلن دولته مجهولة في الكائن المخزّن،
  // نعيد جلب دولته من القاعدة أولًا (ونحدّث المخزّن)، ثم نفلتر دائمًا — فلا تتسرّب حملة خارج منطقته.
  let __me = getCurrentUser();
  let __rows = data || [];
  if (__me && __me.role === 'creator') {
    if (!__me.country || !__me.platform || __me.followers == null || __me.creator_tier === undefined) {
      try {
        const { data: __fresh } = await supabaseClient
          .from('users').select('country, city, platform, followers, creator_tier').eq('id', __me.id).maybeSingle();
        if (__fresh) {
          __me = { ...__me, ...__fresh };
          if (typeof saveCurrentUser === 'function') saveCurrentUser(__me); // حدّث الكائن المخزّن للمرات الجاية
        }
      } catch (e) { /* تجاهل — نفلتر بالمتاح */ }
    }
    // نُظهر كل الحملات للمعلن (شفافية)، ونعلّم غير المطابقة بقفل + سبب بدل إخفائها
    __rows = __rows.map(c => {
      const ok = (typeof simblTargetMatch === 'function') ? simblTargetMatch(__me, c) : true;
      return { ...c, _targetMatch: ok, _lockReason: ok ? '' : (typeof simblLockReason === 'function' ? simblLockReason(__me, c) : 'غير متاحة لك') };
    });
  }
  return __rows.map(c => ({
    ...c,
    brand: c.users?.company_name || 'شركة',
    tags: c.tags || []
  }));
}

async function dbGetMyCampaigns(brandId) {
  const { data, error } = await supabaseClient
    .from('campaigns')
    .select('*')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

async function dbCreateCampaign(campaignData) {
  const { data, error } = await supabaseClient
    .from('campaigns')
    .insert([campaignData])
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function dbApply(applicationData) {
  const { data, error } = await supabaseClient
    .from('applications')
    .insert([applicationData])
    .select()
    .single();
  if (error) {
    // القيد الفريد (23505): المعلن طبّق على هذه الحملة من قبل →
    // نرجّع التطبيق الموجود بدل رمي خطأ، فينتقل لمفاوضته الحالية بسلاسة.
    if (error.code === '23505' && applicationData && applicationData.creator_id && applicationData.campaign_id) {
      const { data: existing, error: findErr } = await supabaseClient
        .from('applications')
        .select('*')
        .eq('creator_id', applicationData.creator_id)
        .eq('campaign_id', applicationData.campaign_id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!findErr && existing) return existing;
    }
    throw error;
  }
  return data;
}

async function dbGetMyApplications(creatorId) {
  // احتياط: لو عمود attachments ما انضاف بعد لقاعدة البيانات، نرجع للاستعلام القديم
  // بدل ما تنكسر صفحة المعلن كاملة (PostgREST يرمي 400 على عمود غير موجود).
  const SEL_CODE = '*, campaigns(title, description, status, attachments, fulfillment_mode, product_url, campaign_type, users!campaigns_brand_id_fkey(company_name))';
  const SEL_NEW = '*, campaigns(title, description, status, attachments, users!campaigns_brand_id_fkey(company_name))';
  const SEL_OLD = '*, campaigns(title, description, status, users!campaigns_brand_id_fkey(company_name))';
  const run = (sel) => supabaseClient
    .from('applications')
    .select(sel)
    .eq('creator_id', creatorId)
    .order('created_at', { ascending: false });
  let { data, error } = await run(SEL_CODE);
  if (error) {
    console.warn('code columns missing? falling back:', error.message);
    ({ data, error } = await run(SEL_NEW));
  }
  if (error) {
    console.warn('attachments column missing? falling back:', error.message);
    ({ data, error } = await run(SEL_OLD));
  }
  if (error) throw error;
  return data;
}

async function dbGetCampaignApplications(campaignId) {
  const { data, error } = await supabaseClient
    .from('applications')
    .select('*, users!applications_creator_id_fkey(name, platform, handle, followers, category, website)')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

function getCurrentUser() {
  // أولاً نحاول من مخزن التبويب (localStorage عادةً، sessionStorage في وضع ?multi=1)
  let json = flfStore().getItem('simbl_current_user');

  // لو ما لقينا، نحاول من cookie كنسخة احتياطية — إلا في وضع الجلسة المستقلة،
  // لأن الكوكي مشتركة بين كل التبويبات فتخلط الحسابين
  if (!json && !window.__flfMultiSession) {
    const cookieMatch = document.cookie.match(/simbl_user_id=([^;]+)/);
    if (cookieMatch) {
      // فيه cookie، لكن البيانات في localStorage راحت
      // نرجع null عشان الصفحة تجلب البيانات من قاعدة البيانات
      return null;
    }
  }

  return json ? JSON.parse(json) : null;
}

function saveCurrentUser(user) {
  // نحفظ في مخزن التبويب - يبقى للأبد إلا لو المستخدم مسح بيانات المتصفح
  flfStore().setItem('simbl_current_user', JSON.stringify(user));

  // نحفظ id في cookie لمدة 10 سنوات كاحتياطي — إلا في وضع الجلسة المستقلة
  if (window.__flfMultiSession) return;
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 10);
  document.cookie = `simbl_user_id=${user.id}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}

function clearCurrentUser() {
  flfStore().removeItem('simbl_current_user');
  // نمسح الـ cookie — إلا في وضع الجلسة المستقلة حتى لا نُخرج التبويب الآخر
  if (!window.__flfMultiSession) {
    document.cookie = 'simbl_user_id=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  }

  // نسجّل خروج من Supabase Auth كذلك عشان الجلسة تنتهي كاملة
  try {
    window.__simblLoggingOut = true;   // خروج متعمّد → لا تعرض شاشة "انتهت جلستك"
    if (window.supabaseClient && window.supabaseClient.auth) {
      window.supabaseClient.auth.signOut();
    }
  } catch (e) {}
}

// محاولة استعادة الجلسة من cookie لو localStorage راح — مع إعادة محاولة
// (إصلاح تذبذب الجلسة: قبل كانت تحاول مرة وحدة وتستسلم بصمت لو فشلت لحظيًا)
// ============ كشف الجلسة الميتة وإعادة المصادقة تلقائيًا ============
// المشكلة: الهوية المخزّنة (simbl_current_user) تبقى حتى لو ماتت جلسة Auth،
// فالصفحة تحسبك "داخل" وتحمّل بيانات فاضية (RLS يرفض بلا جلسة) → تبان الحملات/الأسماء اختفت.
// الحل: نتأكد إن الجلسة حيّة فعلًا؛ لو ماتت نعرض "انتهت جلستك — سجّل دخول" (يؤتمت خطوة الخروج/الدخول اليدوية).
function simblOnLoginPage() {
  const p = (location.pathname || '').toLowerCase();
  return p === '/' || p === '' || p.indexOf('signup') >= 0 || p.indexOf('login') >= 0 || p.indexOf('index') >= 0;
}

async function simblSessionAlive() {
  try {
    if (!window.supabaseClient) return true;               // ما نقدر نتأكد → لا نمنع
    const { data } = await supabaseClient.auth.getSession();
    // فيه جلسة مخزّنة؟ (حتى لو التوكن قريب الانتهاء، autoRefreshToken يتكفّل بالتجديد لحاله بأمان).
    // لا نستدعي refreshSession يدويًا هنا — التجديد اليدوي يسبّب "refresh token already used".
    return !!(data && data.session);
  } catch (e) { return true; }                             // عند الشك لا نمنع
}

function simblShowSessionExpired() {
  try {
    if (document.getElementById('simbl-session-expired')) return;
    const o = document.createElement('div');
    o.id = 'simbl-session-expired';
    o.setAttribute('style', 'position:fixed;inset:0;z-index:99999;background:#ffffff;display:flex;align-items:center;justify-content:center;padding:24px;font-family:inherit;');
    o.innerHTML = '<div style="max-width:420px;text-align:center;">'
      + '<div style="width:76px;height:76px;border-radius:50%;background:rgba(226,59,46,0.12);display:flex;align-items:center;justify-content:center;margin:0 auto 22px;font-size:34px;">\uD83D\uDD12</div>'
      + '<h2 style="font-size:24px;margin:0 0 10px;color:#0F1420;font-weight:700;">انتهت جلستك</h2>'
      + '<p style="font-size:15px;color:#8A93A6;line-height:1.8;margin:0 0 22px;">حسابك سليم، بس الجلسة انتهت. سجّل دخول من جديد وترجع بياناتك مباشرة.</p>'
      + '<button id="simbl-relogin-btn" style="padding:13px 34px;border-radius:100px;border:0;background:#E23B2E;color:#fff;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer;">سجّل دخول</button>'
      + '<div style="margin-top:14px;"><span id="simbl-retry-link" style="font-size:13px;color:#8A93A6;cursor:pointer;text-decoration:underline;">إعادة المحاولة</span></div>'
      + '</div>';
    document.body.appendChild(o);
    const btn = document.getElementById('simbl-relogin-btn');
    if (btn) btn.onclick = function () { try { if (typeof clearCurrentUser === 'function') clearCurrentUser(); } catch (e) {} window.location.href = '/signup.html'; };
    const rt = document.getElementById('simbl-retry-link');
    if (rt) rt.onclick = function () { window.location.reload(); };
  } catch (e) { window.location.href = '/signup.html'; }
}

async function tryRestoreSession() {
  // 0) تأكّد إن جلسة Auth حيّة فعلًا؛ لو ماتت والهوية محفوظة → اعرض "انتهت جلستك"
  const __alive = await simblSessionAlive();
  if (!__alive) {
    const __hasIdentity = !!flfStore().getItem('simbl_current_user')
      || (!window.__flfMultiSession && /simbl_user_id=/.test(document.cookie));
    if (__hasIdentity && !simblOnLoginPage()) { simblShowSessionExpired(); return false; }
  }

  // لو الهوية موجودة في مخزن التبويب، خلاص
  if (flfStore().getItem('simbl_current_user')) return true;

  // نشوف cookie — لا نستعملها في وضع الجلسة المستقلة (مشتركة بين التبويبات)
  if (window.__flfMultiSession) return false;
  const cookieMatch = document.cookie.match(/simbl_user_id=([^;]+)/);
  if (!cookieMatch) return false;

  const userId = cookieMatch[1];

  // نعيد المحاولة حتى 5 مرات مع تراجع تدريجي (نتفادى فشل الشبكة البطيئة عند الفتح البارد)
  const backoff = [400, 700, 1100, 1600, 2200];
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const { data, error } = await supabaseClient
        .from('users')
        .select('id, role, name, platform, handle, followers, category, bio, company_name, industry, size, position, website, created_at, auth_id, approval_status, cr_number, is_test, avatar_url, country, city, creator_tier')
        .eq('id', userId)
        .maybeSingle();

      if (data) {
        saveCurrentUser(data);   // رجّعنا المستخدم لـ localStorage
        return true;
      }
      // ما فيه data وما فيه خطأ → المستخدم غير موجود فعلاً، لا داعي لإعادة المحاولة
      if (!error) return false;
    } catch (err) {
      console.error('Restore attempt ' + (attempt + 1) + ' failed:', err);
    }
    // انتظر قبل المحاولة الجاية (تراجع تدريجي)
    await new Promise(r => setTimeout(r, backoff[attempt] || 2000));
  }
  return false;
}


// ============ (منقول من سيمبل) مرفقات البريف + الجلب المقسم بدون سقف 1000 صف ============
const SIMBL_BRIEF_BUCKET = 'brief-files';
const SIMBL_BRIEF_MAX_BYTES = 10 * 1024 * 1024;
const SIMBL_BRIEF_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
// الحد الأقصى لعدد مرفقات الحملة الواحدة (فيديوهات + صور) — غيّر الرقم هنا فقط
const SIMBL_BRIEF_MAX_FILES = 15;
// 15 -> ١٥ لعرض الأرقام بالعربية داخل الرسائل
function simblArNum(n) { return String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[+d]); }



// قراءة قائمة المرفقات من سجل الحملة مهما كان شكل العمود (jsonb أو نص)
function simblBriefList(camp) {
  const raw = camp && camp.attachments;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch (e) { return []; }
  }
  return [];
}

// رابط موقّت لعرض/تنزيل مرفق — السلة خاصة فما فيه رابط عام
async function simblBriefSignedUrl(path, seconds, downloadName) {
  if (!path) return '';
  // downloadName: يضيف Content-Disposition=attachment فيصير الرابط «تنزيل» حقيقي
  // (بدون فتح الملف في المتصفح — وهذا اللي يخلي التنزيل يشتغل على الجوال)
  const opts = downloadName ? { download: (downloadName === true ? true : String(downloadName)) } : undefined;
  const { data, error } = await supabaseClient.storage
    .from(SIMBL_BRIEF_BUCKET).createSignedUrl(path, seconds || 3600, opts);
  if (error) { console.error('brief signed url failed:', path, error); return ''; }
  return (data && data.signedUrl) || '';
}

// المسار لازم يبدأ بـ<campaign_id>/ لأن سياسات RLS تقرأ اسم المجلد الأول
const SIMBL_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const SIMBL_VIDEO_MAX_BYTES = 50 * 1024 * 1024;
async function simblBriefUpload(campaignId, file, allowVideo) {
  if (!campaignId) throw new Error('حملة غير معروفة');
  const isVideo = SIMBL_VIDEO_TYPES.indexOf(file.type) >= 0;
  if (isVideo && !allowVideo) throw new Error('الفيديو مسموح في حملات «الفيديو الجاهز» فقط');
  if (!isVideo && SIMBL_BRIEF_TYPES.indexOf(file.type) < 0) {
    throw new Error('الصيغة غير مدعومة — صور (JPG / PNG / WebP)' + (allowVideo ? ' أو فيديو (MP4 / MOV / WebM)' : ' فقط'));
  }
  const maxBytes = isVideo ? SIMBL_VIDEO_MAX_BYTES : SIMBL_BRIEF_MAX_BYTES;
  if (file.size > maxBytes) throw new Error('حجم «' + (file.name || 'الملف') + '» أكبر من ' + (isVideo ? '٥٠' : '١٠') + ' ميجا');
  const safe = (file.name || (isVideo ? 'video' : 'image')).replace(/[^\w.\-]+/g, '_').slice(-60);
  const path = campaignId + '/' + Date.now() + '_' + safe;
  const { error } = await supabaseClient.storage
    .from(SIMBL_BRIEF_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return { path: path, name: file.name || safe, size: file.size, type: file.type, uploaded_at: new Date().toISOString() };
}

async function simblBriefRemove(path) {
  const { error } = await supabaseClient.storage.from(SIMBL_BRIEF_BUCKET).remove([path]);
  if (error) throw error;
}

async function simblBriefSaveList(campaignId, list) {
  const { data, error } = await supabaseClient.from('campaigns')
    .update({ attachments: list }).eq('id', campaignId).select('id');
  if (error) throw error;
  if (!data || !data.length) throw new Error('ما تم الحفظ — تحقّق من صلاحياتك على الحملة');
  return true;
}

// ملاحظة: لازم ترتيب حاسم (created_at + id) وإلا تكرّرت/ضاعت صفوف بين الدفعات.
async function simblFetchAll(build, pageSize) {
  const SZ = pageSize || 1000;
  let out = [];
  for (let page = 0; page < 60; page++) {
    const from = page * SZ;
    const { data, error } = await build().range(from, from + SZ - 1);
    if (error) throw error;
    const rows = data || [];
    out = out.concat(rows);
    if (rows.length < SZ) break;
  }
  return out;
}

// جلب كل عروض مجموعة حملات بلا قصّ — المصدر الموحّد لكل الصفحات
async function dbGetAppsForCampaigns(campIds, selectStr) {
  if (!campIds || !campIds.length) return [];
  const sel = selectStr || '*, users!applications_creator_id_fkey(name, platform, handle, followers, category, website)';
  return await simblFetchAll(() => supabaseClient
    .from('applications')
    .select(sel)
    .in('campaign_id', campIds)
    .order('created_at', { ascending: false })
    .order('id', { ascending: true }));
}
window.simblBriefList = simblBriefList;
window.simblBriefSignedUrl = simblBriefSignedUrl;
window.SIMBL_BRIEF_MAX_FILES = SIMBL_BRIEF_MAX_FILES;
window.simblArNum = simblArNum;
window.simblBriefUpload = simblBriefUpload;
window.simblBriefRemove = simblBriefRemove;
window.simblBriefSaveList = simblBriefSaveList;
window.simblFetchAll = simblFetchAll;
window.dbGetAppsForCampaigns = dbGetAppsForCampaigns;

// ============ حارس الباقات — مصدر واحد لكل الصفحات ============
// simblPlan()            → صف الباقة كاملًا (my_plan_status) مع تخزين مؤقت
// simblCan('can_x')      → هل الميزة متاحة في باقة المستخدم
// simblLimit('max_x')    → الحد الرقمي (null = بلا حد)
// simblGate('can_x', ...)→ يفحص، وإن لم تتوفر يعرض بطاقة الترقية ويرجع false
//
// سياسة الفشل: لو تعذّر جلب الباقة (شبكة/عطل مؤقت) نسمح بالميزة ولا نحجبها،
// لأن تعطيل ميزة يدفع ثمنها مشترك أسوأ من تسريب ميزة لدقيقة. والحدود الحقيقية
// (حجم الحملة، عدد الحملات المجانية، نسبة العمولة) مفروضة في قاعدة البيانات أصلًا.

var __simblPlan = null, __simblPlanAt = 0;

async function simblPlan(force) {
  var now = Date.now();
  if (!force && __simblPlan && (now - __simblPlanAt) < 60000) return __simblPlan;
  try {
    var s = await window.supabaseClient.auth.getSession();
    if (!s || !s.data || !s.data.session) return null;
    var r = await window.supabaseClient.rpc('my_plan_status');
    var d = r && r.data;
    if (!d || d.error) throw new Error('plan rpc');
    __simblPlan = d; __simblPlanAt = now;
    // حد مرفقات البريف يتبع الباقة (٣ · ٨ · ١٥) — الصفحات كلها تقرأ هذا المتغيّر
    if (d.max_brief_attachments !== null && d.max_brief_attachments !== undefined) {
      window.SIMBL_BRIEF_MAX_FILES = Number(d.max_brief_attachments);
    }
    try { sessionStorage.setItem('simbl_plan', JSON.stringify(d)); } catch (e) {}
    return d;
  } catch (e) {
    console.warn('simblPlan failed, falling back', e);
    try {
      var c = sessionStorage.getItem('simbl_plan');
      if (c) { __simblPlan = JSON.parse(c); return __simblPlan; }
    } catch (e2) {}
    return { __unknown: true };
  }
}

async function simblCan(flag) {
  var p = await simblPlan();
  if (!p) return false;
  if (p.__unknown) return true;
  return p[flag] === true;
}

async function simblLimit(key) {
  var p = await simblPlan();
  if (!p || p.__unknown) return null;
  var v = p[key];
  return (v === null || v === undefined) ? null : Number(v);
}

function simblPlansUrl(p) {
  return (p && p.role === 'creator') ? '/plans-creator.html' : '/plans.html';
}

// بطاقة ترقية موحّدة — مستقلة بذاتها فتعمل في أي صفحة بلا اعتماد على أنماطها
function simblUpgradeCard(title, body, planName, url) {
  var old = document.getElementById('simbl-upg');
  if (old) old.remove();
  var wrap = document.createElement('div');
  wrap.id = 'simbl-upg';
  wrap.setAttribute('dir', 'rtl');
  wrap.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(15,20,32,.55);display:flex;align-items:center;justify-content:center;padding:20px;font-family:"IBM Plex Sans Arabic","Segoe UI",Tahoma,sans-serif';
  var card = document.createElement('div');
  card.style.cssText = 'background:#fff;border-radius:20px;max-width:420px;width:100%;padding:30px 26px 24px;box-shadow:0 24px 60px rgba(0,0,0,.22);text-align:center';
  var h = document.createElement('div');
  h.style.cssText = 'font-size:20px;font-weight:700;color:#0F1420;margin-bottom:10px';
  h.textContent = title;
  var p = document.createElement('div');
  p.style.cssText = 'font-size:14.5px;line-height:1.9;color:#5b6070;margin-bottom:8px';
  p.textContent = body;
  var cur = document.createElement('div');
  cur.style.cssText = 'font-size:12.5px;color:#8A93A6;margin-bottom:20px';
  cur.textContent = planName ? ('باقتك الحالية: ' + planName) : '';
  var go = document.createElement('a');
  go.href = url;
  go.textContent = 'شوف الباقات ←';
  go.style.cssText = 'display:block;background:#E23B2E;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:13px;border-radius:12px;margin-bottom:10px';
  var no = document.createElement('button');
  no.type = 'button';
  no.textContent = 'لاحقًا';
  no.style.cssText = 'width:100%;background:none;border:0;color:#8A93A6;font-family:inherit;font-size:14px;padding:8px;cursor:pointer';
  no.onclick = function () { wrap.remove(); };
  wrap.onclick = function (e) { if (e.target === wrap) wrap.remove(); };
  card.appendChild(h); card.appendChild(p); card.appendChild(cur); card.appendChild(go); card.appendChild(no);
  wrap.appendChild(card);
  document.body.appendChild(wrap);
}

// الاستخدام: if (!await simblGate('can_analytics','لوحة الأداء','...')) return;
async function simblGate(flag, title, body) {
  if (await simblCan(flag)) return true;
  var p = await simblPlan();
  simblUpgradeCard(title, body, p && p.name_ar, simblPlansUrl(p));
  return false;
}

window.simblPlan = simblPlan;
window.simblCan = simblCan;
window.simblLimit = simblLimit;
window.simblGate = simblGate;
window.simblUpgradeCard = simblUpgradeCard;

// نجلب الباقة مبكرًا مرة واحدة حتى تُضبط الحدود قبل أول رفع مرفقات
try { simblPlan(); } catch (e) {}
/* ================= مميزات الباقات — تركيب تلقائي (فلفلونسر) ================= */
(function () {
  'use strict';
  if (window.__flfFeatInit) return;
  window.__flfFeatInit = true;

  var ACC = '#E23B2E';

  function esc(s) {
    return String(s == null ? '' : s)
      .split('&').join('&amp;').split('<').join('&lt;')
      .split('>').join('&gt;').split('"').join('&quot;');
  }
  function num(n) {
    var v = Number(n);
    if (!isFinite(v)) return '—';
    return Math.round(v).toLocaleString('en-US');
  }
  function money(n) {
    var v = Number(n);
    if (!isFinite(v)) return '—';
    return Math.round(v).toLocaleString('en-US') + ' ر.س';
  }
  function shortNum(n) {
    var v = Number(n) || 0;
    if (v >= 1000000) return (v / 1000000).toFixed(1).replace('.0', '') + 'M';
    if (v >= 1000) return (v / 1000).toFixed(1).replace('.0', '') + 'K';
    return String(v);
  }
  function dateAr(s) {
    if (!s) return '—';
    try {
      var d = new Date(s);
      return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate();
    } catch (e) { return '—'; }
  }

  function css() {
    if (document.getElementById('flf-feat-css')) return;
    var st = document.createElement('style');
    st.id = 'flf-feat-css';
    st.textContent = [
      '.flf-bar{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 4px}',
      '.flf-bar button{display:inline-flex;align-items:center;gap:6px;background:#fff;border:1.5px solid rgba(15,20,32,.14);',
      'border-radius:100px;padding:9px 15px;font-family:inherit;font-size:13.5px;font-weight:600;color:#0F1420;cursor:pointer;transition:.15s}',
      '.flf-bar button:hover{border-color:' + ACC + ';color:' + ACC + '}',
      '.flf-bar button.locked{color:#8A93A6;border-style:dashed}',
      '.flf-ov{position:fixed;inset:0;z-index:99998;background:rgba(15,20,32,.55);display:flex;align-items:center;',
      'justify-content:center;padding:16px;overflow-y:auto}',
      '.flf-mo{background:#fff;border-radius:20px;width:100%;max-width:760px;max-height:88vh;overflow-y:auto;',
      'box-shadow:0 24px 70px rgba(15,20,32,.3);font-family:inherit;direction:rtl}',
      '.flf-mh{position:sticky;top:0;background:#fff;display:flex;align-items:center;justify-content:space-between;',
      'gap:12px;padding:18px 22px 12px;border-bottom:1px solid rgba(15,20,32,.08);z-index:2}',
      '.flf-mh h3{margin:0;font-size:17px;font-weight:800;color:#0F1420}',
      '.flf-x{background:none;border:0;font-size:22px;line-height:1;color:#8A93A6;cursor:pointer;padding:2px 6px}',
      '.flf-mb{padding:18px 22px 24px}',
      '.flf-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}',
      '.flf-kpi{background:#FAFAFB;border:1px solid rgba(15,20,32,.07);border-radius:14px;padding:13px 14px}',
      '.flf-kpi .k{font-size:11.5px;color:#8A93A6;font-weight:600;margin-bottom:5px}',
      '.flf-kpi .v{font-size:20px;font-weight:800;color:#0F1420;letter-spacing:-.4px}',
      '.flf-kpi .s{font-size:11.5px;color:#8A93A6;margin-top:3px}',
      '.flf-kpi.hi .v{color:' + ACC + '}',
      '.flf-tbl{width:100%;border-collapse:collapse;font-size:13px;margin-top:14px}',
      '.flf-tbl th{text-align:right;font-size:11.5px;color:#8A93A6;font-weight:700;padding:8px 6px;border-bottom:1px solid rgba(15,20,32,.1)}',
      '.flf-tbl td{padding:10px 6px;border-bottom:1px solid rgba(15,20,32,.06);color:#0F1420}',
      '.flf-tbl a{color:' + ACC + ';text-decoration:none;font-weight:600}',
      '.flf-empty{text-align:center;color:#8A93A6;padding:34px 10px;font-size:14px}',
      '.flf-load{text-align:center;color:#8A93A6;padding:34px 10px;font-size:14px}',
      '.flf-note{background:#FFF6F5;border:1px solid rgba(226,59,46,.18);border-radius:12px;padding:12px 14px;',
      'font-size:13px;color:#7E2119;margin-top:14px;line-height:1.7}',
      '.flf-act{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}',
      '.flf-act button,.flf-act a{background:' + ACC + ';color:#fff;border:0;border-radius:100px;padding:10px 18px;',
      'font-family:inherit;font-size:13.5px;font-weight:700;cursor:pointer;text-decoration:none;display:inline-block}',
      '.flf-act button.gh{background:#fff;color:#0F1420;border:1.5px solid rgba(15,20,32,.14)}',
      '.flf-inv{background:#fff;border:1.5px solid rgba(226,59,46,.35);color:' + ACC + ';border-radius:100px;',
      'padding:5px 12px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;margin-top:6px}',
      '.flf-inv.in{background:' + ACC + ';color:#fff;border-color:' + ACC + '}',
      '.flf-lockcard{background:#FAFAFB;border:1.5px dashed rgba(15,20,32,.16);border-radius:16px;padding:22px;',
      'text-align:center;color:#8A93A6;font-size:13.5px;line-height:1.8}',
      '.flf-lockcard a{color:' + ACC + ';font-weight:700;text-decoration:none}',
      '@media(max-width:640px){.flf-mo{max-width:100%}.flf-mb{padding:14px 14px 20px}}'
    ].join('');
    document.head.appendChild(st);
  }

  function modal(title) {
    css();
    var ov = document.createElement('div');
    ov.className = 'flf-ov';
    var mo = document.createElement('div');
    mo.className = 'flf-mo';
    var mh = document.createElement('div');
    mh.className = 'flf-mh';
    var h = document.createElement('h3');
    h.textContent = title;
    var x = document.createElement('button');
    x.className = 'flf-x';
    x.textContent = '×';
    x.onclick = function () { ov.remove(); };
    mh.appendChild(h); mh.appendChild(x);
    var mb = document.createElement('div');
    mb.className = 'flf-mb';
    mb.innerHTML = '<div class="flf-load">جاري التحميل…</div>';
    mo.appendChild(mh); mo.appendChild(mb);
    ov.appendChild(mo);
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
    document.body.appendChild(ov);
    return { ov: ov, body: mb };
  }

  async function rpc(fn, args) {
    try {
      var r = await window.supabaseClient.rpc(fn, args || {});
      if (r && r.error) return { error: 'rpc' };
      return r ? r.data : null;
    } catch (e) { return { error: 'rpc' }; }
  }

  function kpi(k, v, s, hi) {
    return '<div class="flf-kpi' + (hi ? ' hi' : '') + '"><div class="k">' + esc(k) + '</div>'
      + '<div class="v">' + v + '</div>'
      + (s ? '<div class="s">' + esc(s) + '</div>' : '') + '</div>';
  }

  function failBody(m, d) {
    if (d && d.error === 'plan') return '<div class="flf-empty">هذه الميزة غير متاحة في باقتك الحالية.</div>';
    m.body.innerHTML = '<div class="flf-empty">تعذّر تحميل البيانات. حاول مرة ثانية.</div>';
    return null;
  }

  /* إحصائيات السوق: أُزيلت بقرار المالك — كانت تعرض للمعلن أسعار منافسيه
     وتنصحه برفع سعره، وهذا تسعير متبادل بين متنافسين لا نريد تسهيله. */
  /* ---------- 2) أرشيف الأعمال ---------- */
  window.flfPostArchive = async function () {
    if (!(await window.simblGate('can_post_archive', 'أرشيف أعمالي',
      'أرشيف دائم لكل أعمالك المنشورة مع الروابط والأرقام والتقييمات — جاهز تعرضه لأي شركة.'))) return;
    var m = modal('أرشيف أعمالي');
    var d = await rpc('my_post_archive');
    if (!d || d.error) { failBody(m, d); return; }
    var items = (d && d.items) || [];
    if (!items.length) {
      m.body.innerHTML = '<div class="flf-empty">ما عندك أعمال منشورة بعد. أول ما تكمل صفقة بتظهر هنا تلقائياً.</div>';
      return;
    }
    var tv = 0, te = 0, tr = 0, nr = 0;
    items.forEach(function (it) {
      tv += Number(it.views) || 0;
      te += Number(it.net != null ? it.net : it.price) || 0;
      if (it.stars) { tr += Number(it.stars); nr++; }
    });
    var html = '<div class="flf-grid">'
      + kpi('عدد الأعمال', num(items.length), '')
      + kpi('إجمالي المشاهدات', num(tv), '', true)
      + kpi('إجمالي الأرباح', money(te), '')
      + kpi('متوسط التقييم', nr ? (tr / nr).toFixed(1) + ' ★' : '—', nr ? num(nr) + ' تقييم' : 'لا تقييمات')
      + '</div>';
    html += '<table class="flf-tbl"><thead><tr><th>الحملة</th><th>الشركة</th><th>التاريخ</th>'
      + '<th>المشاهدات</th><th>العائد</th><th>التقييم</th><th>الرابط</th></tr></thead><tbody>';
    items.forEach(function (it) {
      html += '<tr><td>' + esc(it.title || 'حملة') + '</td>'
        + '<td>' + esc(it.brand || '—') + '</td>'
        + '<td>' + dateAr(it.dt) + '</td>'
        + '<td>' + (it.views != null ? num(it.views) : '—') + '</td>'
        + '<td>' + money(it.net != null ? it.net : it.price) + '</td>'
        + '<td>' + (it.stars ? Number(it.stars).toFixed(1) + ' ★' : '—') + '</td>'
        + '<td>' + (it.url ? '<a href="' + esc(it.url) + '" target="_blank" rel="noopener">فتح</a>' : '—') + '</td></tr>';
    });
    html += '</tbody></table>';
    m.body.innerHTML = html;
  };

  /* ---------- 3) بطاقة الإنجاز ---------- */
  window.flfAchievementCard = async function () {
    if (!(await window.simblGate('can_achievement_card', 'بطاقة إنجازي',
      'بطاقة جاهزة للنشر تلخّص إنجازك على فلفلونسر: صفقاتك وتقييمك وترتيبك — تنزّلها صورة وتنشرها.'))) return;
    var m = modal('بطاقة إنجازي');
    var d = await rpc('my_achievement_card');
    if (!d || d.error) { failBody(m, d); return; }
    var cv = document.createElement('canvas');
    cv.width = 1080; cv.height = 1350;
    cv.style.cssText = 'width:100%;max-width:360px;display:block;margin:0 auto;border-radius:16px;box-shadow:0 10px 34px rgba(15,20,32,.18)';
    var g = cv.getContext('2d');
    var grd = g.createLinearGradient(0, 0, 1080, 1350);
    grd.addColorStop(0, '#7E2119'); grd.addColorStop(1, '#E23B2E');
    g.fillStyle = grd; g.fillRect(0, 0, 1080, 1350);
    g.fillStyle = 'rgba(255,255,255,.10)';
    g.beginPath(); g.arc(900, 190, 300, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(140, 1180, 260, 0, Math.PI * 2); g.fill();
    g.textAlign = 'center'; g.fillStyle = '#fff';
    g.font = '700 34px system-ui, sans-serif';
    g.fillText('FLFLUENCER', 540, 130);
    g.font = '800 74px system-ui, sans-serif';
    g.fillText(String(d.name || 'معلن'), 540, 300);
    g.font = '500 40px system-ui, sans-serif';
    g.fillStyle = 'rgba(255,255,255,.85)';
    g.fillText(String(d.handle || ''), 540, 366);
    var stats = [
      [num(d.deals), 'صفقة مكتملة'],
      [(d.avg_rating ? Number(d.avg_rating).toFixed(1) + ' ★' : '—'), 'متوسط التقييم'],
      ['#' + num(d.rank), 'ترتيبك على منصتك'],
      [shortNum(d.followers), 'متابع']
    ];
    var y = 520;
    stats.forEach(function (s) {
      g.fillStyle = 'rgba(255,255,255,.13)';
      var rx = 110, rw = 860, rh = 150;
      g.beginPath();
      if (g.roundRect) { g.roundRect(rx, y, rw, rh, 34); } else { g.rect(rx, y, rw, rh); }
      g.fill();
      g.fillStyle = '#fff';
      g.font = '800 66px system-ui, sans-serif';
      g.textAlign = 'right';
      g.fillText(String(s[0]), 930, y + 98);
      g.fillStyle = 'rgba(255,255,255,.82)';
      g.font = '500 36px system-ui, sans-serif';
      g.textAlign = 'left';
      g.fillText(String(s[1]), 160, y + 95);
      y += 180;
    });
    g.textAlign = 'center';
    g.fillStyle = 'rgba(255,255,255,.72)';
    g.font = '500 32px system-ui, sans-serif';
    g.fillText('flfluencer.com', 540, 1290);
    m.body.innerHTML = '';
    m.body.appendChild(cv);
    var act = document.createElement('div');
    act.className = 'flf-act';
    act.style.justifyContent = 'center';
    var dl = document.createElement('button');
    dl.textContent = 'تنزيل الصورة';
    dl.onclick = function () {
      try {
        var a = document.createElement('a');
        a.download = 'flfluencer-card.png';
        a.href = cv.toDataURL('image/png');
        a.click();
      } catch (e) { alert('تعذّر التنزيل على هذا المتصفح'); }
    };
    act.appendChild(dl);
    m.body.appendChild(act);
  };

  /* ---------- 4) تحليلات الترتيب ---------- */
  window.flfRankAnalytics = async function () {
    if (!(await window.simblGate('can_rank_analytics', 'تحليلات ترتيبي',
      'ترتيبك الدقيق: عام، وفي مدينتك، وفي تصنيفك، وبعدد الصفقات — وكم متابع يفصلك عن المركز اللي فوقك.'))) return;
    var m = modal('تحليلات ترتيبي');
    var d = await rpc('my_rank_analytics');
    if (!d || d.error) { failBody(m, d); return; }
    function pct(r, p) {
      if (!p) return '—';
      return Math.max(0, Math.round(100 - (Number(r) / Number(p)) * 100)) + '%';
    }
    var html = '<div class="flf-grid">'
      + kpi('ترتيبك على منصتك', '#' + num(d.rank_all), 'من ' + num(d.pool_all) + ' معلن · أعلى من ' + pct(d.rank_all, d.pool_all), true)
      + kpi('في مدينتك', '#' + num(d.rank_city), esc(d.city || '—') + ' · من ' + num(d.pool_city))
      + kpi('في تصنيفك', '#' + num(d.rank_category), esc(d.category || '—') + ' · من ' + num(d.pool_category))
      + kpi('بعدد الصفقات', '#' + num(d.rank_deals), num(d.my_deals) + ' صفقة · من ' + num(d.pool_deals) + ' منافس')
      + '</div>';
    if (d.followers_to_next != null && Number(d.followers_to_next) > 0) {
      html += '<div class="flf-note">يفصلك عن المركز اللي فوقك <b>' + num(d.followers_to_next)
        + '</b> متابع فقط. الترتيب يتحدّث تلقائياً كل ما تغيّرت أرقامك.</div>';
    } else {
      html += '<div class="flf-note">أنت في القمة على منصتك ضمن هذه القائمة 👑</div>';
    }
    html += '<div class="flf-note" style="background:#FAFAFB;border-color:rgba(15,20,32,.08);color:#5A6377">'
      + 'أسرع طريقة ترفع ترتيبك: أكمل صفقاتك في وقتها واطلب التقييم بعد كل عمل — درجة الثقة أثقل من عدد المتابعين في نتائج بحث الشركات.</div>';
    m.body.innerHTML = html;
  };

  /* ---------- 5) نتائج المحتوى (شركة) ---------- */
  window.flfContentResults = async function (campaignId) {
    if (!(await window.simblGate('can_content_results', 'نتائج المحتوى',
      'أرقام كل عمل نُشر في حملاتك: المشاهدات والتفاعل وتكلفة الألف مشاهدة لكل معلن.'))) return;
    var m = modal('نتائج المحتوى');
    var d = await rpc('brand_content_results', campaignId ? { p_campaign: campaignId } : {});
    if (!d || d.error) { failBody(m, d); return; }
    var items = (d && d.items) || [];
    if (!items.length) {
      m.body.innerHTML = '<div class="flf-empty">ما فيه أعمال منشورة بعد. تظهر هنا تلقائياً بعد نشر المعلنين لمحتواهم.</div>';
      return;
    }
    var tv = 0, tc = 0, teng = 0;
    items.forEach(function (it) {
      tv += Number(it.views) || 0;
      tc += Number(it.price) || 0;
      teng += (Number(it.likes) || 0) + (Number(it.comments) || 0) + (Number(it.shares) || 0);
    });
    var cpm = tv > 0 ? (tc / tv) * 1000 : null;
    var html = '<div class="flf-grid">'
      + kpi('إجمالي المشاهدات', num(tv), '', true)
      + kpi('إجمالي التفاعل', num(teng), 'إعجاب + تعليق + مشاركة')
      + kpi('إجمالي الإنفاق', money(tc), '')
      + kpi('تكلفة الألف مشاهدة', cpm != null ? money(cpm) : '—', 'CPM')
      + '</div>';
    html += '<table class="flf-tbl"><thead><tr><th>المعلن</th><th>الحملة</th><th>المشاهدات</th>'
      + '<th>التفاعل</th><th>نسبة التفاعل</th><th>التكلفة</th><th>CPM</th><th>الرابط</th></tr></thead><tbody>';
    items.forEach(function (it) {
      var v = Number(it.views) || 0;
      var e = (Number(it.likes) || 0) + (Number(it.comments) || 0) + (Number(it.shares) || 0);
      var er = v > 0 ? ((e / v) * 100).toFixed(1) + '%' : '—';
      var c1 = Number(it.price) || 0;
      var cm = v > 0 ? money((c1 / v) * 1000) : '—';
      html += '<tr><td>' + esc(it.creator || '—') + '<div style="font-size:11px;color:#8A93A6">'
        + esc(it.handle || '') + '</div></td>'
        + '<td>' + esc(it.campaign || '—') + '</td>'
        + '<td>' + (it.views != null ? num(it.views) : '—') + '</td>'
        + '<td>' + num(e) + '</td>'
        + '<td>' + er + '</td>'
        + '<td>' + money(c1) + '</td>'
        + '<td>' + cm + '</td>'
        + '<td>' + (it.url ? '<a href="' + esc(it.url) + '" target="_blank" rel="noopener">فتح</a>' : '—') + '</td></tr>';
    });
    html += '</tbody></table>';
    html += '<div class="flf-note" style="background:#FAFAFB;border-color:rgba(15,20,32,.08);color:#5A6377">'
      + 'الأرقام تُسحب من المنصة بعد النشر. الخانات الفاضية تعني إن المحتوى لسه ما نُشر أو ما تم جلب أرقامه بعد.</div>';
    m.body.innerHTML = html;
  };

  /* ---------- 6) تصدير القائمة (شركة) ---------- */
  window.flfTopExport = async function () {
    if (!(await window.simblGate('can_top_export', 'تصدير القائمة',
      'نزّل قائمة أفضل المعلنين ملف CSV تشتغل عليه في إكسل وتشاركه مع فريقك.'))) return;
    var rows = [];
    try { if (typeof RANKED !== 'undefined' && RANKED && RANKED.length) rows = RANKED; } catch (e) { rows = []; }
    if (!rows.length) { alert('القائمة لسه ما حمّلت. انتظر ثانية وأعد المحاولة.'); return; }
    var NL = String.fromCharCode(10);
    var head = ['الترتيب', 'الاسم', 'المعرّف', 'المنصة', 'التصنيف', 'المتابعون', 'الدولة', 'درجة الثقة', 'الصفقات', 'التقييم'];
    function cell(v) {
      var s = String(v == null ? '' : v);
      if (s.indexOf(',') >= 0 || s.indexOf('"') >= 0) return '"' + s.split('"').join('""') + '"';
      return s;
    }
    var out = [head.map(cell).join(',')];
    rows.forEach(function (c) {
      out.push([
        c.rank, c.name, c.handle, c.platform, c.category,
        c.followers, c.country || 'SA',
        (c.score != null ? Math.round(c.score) : ''),
        (c.deals_count != null ? c.deals_count : ''),
        (c.avg_rating != null ? Number(c.avg_rating).toFixed(1) : '')
      ].map(cell).join(','));
    });
    var blob = new Blob([String.fromCharCode(65279) + out.join(NL)], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'flfluencer-top.csv';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  };

  /* ---------- 7) دعوة معلن من القائمة (شركة) ---------- */
  function cartGet() {
    try { return JSON.parse(flfStore().getItem('simbl_cart') || '[]') || []; } catch (e) { return []; }
  }
  function cartSet(a) {
    try { flfStore().setItem('simbl_cart', JSON.stringify(a)); } catch (e) {}
  }
  window.flfTopInvite = async function (id, btn) {
    if (!(await window.simblGate('can_top_invite', 'الدعوة المباشرة من القائمة',
      'ادعُ أي معلن من قائمة الأفضل مباشرة لحملة خاصة بك بدون ما تنتظر يتقدّم.'))) return;
    var a = cartGet();
    var i = a.indexOf(id);
    var nowIn;
    if (i >= 0) { a.splice(i, 1); nowIn = false; } else { a.push(id); nowIn = true; }
    cartSet(a);
    if (btn) {
      btn.classList.toggle('in', nowIn);
      btn.textContent = nowIn ? 'في السلة ✓' : 'دعوة';
    }
    if (nowIn && !document.getElementById('flf-cart-go')) {
      var bar = document.createElement('a');
      bar.id = 'flf-cart-go';
      bar.href = '/cart.html';
      bar.textContent = 'إكمال الدعوات في السلة ←';
      bar.style.cssText = 'position:fixed;bottom:18px;right:50%;transform:translateX(50%);z-index:99997;'
        + 'background:' + ACC + ';color:#fff;padding:12px 22px;border-radius:100px;font-family:inherit;'
        + 'font-size:14px;font-weight:700;text-decoration:none;box-shadow:0 10px 28px rgba(226,59,46,.4)';
      document.body.appendChild(bar);
    }
  };

  /* ---------- قفل عناصر مبنية مسبقاً ---------- */
  function lockEl(el, title, body) {
    if (!el || el.getAttribute('data-flf-lock')) return;
    el.setAttribute('data-flf-lock', '1');
    if (el.textContent && el.textContent.indexOf('🔒') < 0) {
      var lbl = el.querySelector('span:not(.filter-count)') || el;
      if (lbl === el) { el.textContent = '🔒 ' + el.textContent.trim(); }
      else { lbl.textContent = '🔒 ' + lbl.textContent.trim(); }
    }
    el.style.opacity = '.72';
    el.addEventListener('click', async function (ev) {
      ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
      var pl = null;
      try { pl = await window.simblPlan(); } catch (e) {}
      var url = (pl && pl.role === 'creator') ? '/plans-creator.html' : '/plans.html';
      window.simblUpgradeCard(title, body, pl && pl.name_ar, url);
    }, true);
  }

  /* ---------- التركيب التلقائي ---------- */
  function path() {
    var p = (location.pathname || '').toLowerCase();
    if (p === '/' || p === '') return '/index.html';
    if (p.indexOf('.') < 0) return p + '.html';
    return p;
  }

  function bar(items) {
    css();
    var d = document.createElement('div');
    d.className = 'flf-bar';
    items.forEach(function (it) {
      var b = document.createElement('button');
      b.textContent = it[0];
      b.onclick = it[1];
      d.appendChild(b);
    });
    return d;
  }

  async function mount() {
    var p = path();
    var plan = null;
    try { plan = await window.simblPlan(); } catch (e) { plan = null; }
    var role = plan && plan.role;

    if (p.indexOf('creator.html') >= 0 && role !== 'brand') {
      var host = document.getElementById('my-trust');
      if (host && !document.querySelector('.flf-bar')) {
        var b = bar([
          ['🗂️ أرشيف أعمالي', window.flfPostArchive],
          ['🏅 بطاقة إنجازي', window.flfAchievementCard],
          ['📈 تحليلات ترتيبي', window.flfRankAnalytics]
        ]);
        host.parentNode.insertBefore(b, host.nextSibling);
        ['can_post_archive', 'can_achievement_card', 'can_rank_analytics'].forEach(function (f, i) {
          if (plan && plan[f] !== true && !plan.__unknown) {
            b.children[i].classList.add('locked');
          }
        });
      }
    }

    if (p.indexOf('top.html') >= 0) {
      if (plan && plan.can_top_filters !== true && !plan.__unknown) {
        lockEl(document.getElementById('filter-btn'), 'فلترة القائمة',
          'صفِّ قائمة الأفضل حسب المنصة والتصنيف عشان توصل للمعلن المناسب أسرع.');
      }
      var tools = document.querySelector('.tools-row');
      if (tools && !document.getElementById('flf-top-export')) {
        var ex = document.createElement('button');
        ex.id = 'flf-top-export';
        ex.className = 'filter-btn';
        var exLocked = (plan && plan.can_top_export !== true && !plan.__unknown);
        ex.textContent = exLocked ? '🔒 تصدير' : '⇩ تصدير';
        ex.onclick = window.flfTopExport;
        if (exLocked) ex.style.opacity = '.72';
        tools.appendChild(ex);
      }
      if (role === 'brand') {
        var addInv = function () {
          document.querySelectorAll('.titem').forEach(function (el) {
            if (el.querySelector('.flf-inv')) return;
            var id = (el.id || '').indexOf('ti-') === 0 ? el.id.slice(3) : '';
            if (!id) return;
            var side = el.querySelector('.tside');
            if (!side) return;
            var bt = document.createElement('button');
            bt.className = 'flf-inv';
            var inCart = cartGet().indexOf(id) >= 0;
            if (inCart) bt.classList.add('in');
            bt.textContent = inCart ? 'في السلة ✓' : 'دعوة';
            bt.onclick = function (ev) { ev.stopPropagation(); window.flfTopInvite(id, bt); };
            side.appendChild(bt);
          });
        };
        addInv();
        var lst = document.getElementById('list');
        if (lst && window.MutationObserver) {
          new MutationObserver(function () { addInv(); }).observe(lst, { childList: true });
        }
      }
    }

    if (p.indexOf('creators.html') >= 0) {
      if (plan && plan.can_direct_invite !== true && !plan.__unknown) {
        var lockCarts = function () {
          document.querySelectorAll('.cart-btn').forEach(function (el) {
            lockEl(el, 'الدعوة المباشرة',
              'ادعُ المعلنين مباشرة لحملة خاصة بك بدون ما تنتظرهم يتقدّمون — متاحة في الباقات الأعلى.');
          });
        };
        lockCarts();
        var grid = document.getElementById('grid');
        if (grid && window.MutationObserver) {
          new MutationObserver(function () { lockCarts(); }).observe(grid, { childList: true, subtree: true });
        }
      }
    }

    if (p.indexOf('myteam.html') >= 0) {
      if (plan && plan.can_team_activity !== true && !plan.__unknown) {
        var hideFeed = function () {
          document.querySelectorAll('.feed').forEach(function (el) {
            if (el.getAttribute('data-flf-lock')) return;
            el.setAttribute('data-flf-lock', '1');
            el.innerHTML = '<div class="flf-lockcard">🔒 سجل نشاط الفريق متاح في باقة أعلى<br>'
              + '<a href="/plans.html">شوف الباقات</a></div>';
          });
        };
        css(); hideFeed();
        if (window.MutationObserver) {
          new MutationObserver(function () { hideFeed(); })
            .observe(document.body, { childList: true, subtree: true });
        }
      }
    }

    if (p.indexOf('company.html') >= 0 && role === 'brand') {
      var tabs = document.querySelector('.tabs') || (document.querySelector('.tab') && document.querySelector('.tab').parentNode);
      if (tabs && !document.getElementById('flf-cr-btn')) {
        var cb = document.createElement('button');
        cb.id = 'flf-cr-btn';
        cb.className = 'tab';
        cb.textContent = 'نتائج المحتوى';
        if (plan && plan.can_content_results !== true && !plan.__unknown) {
          cb.textContent = '🔒 نتائج المحتوى';
        }
        cb.onclick = function (ev) {
          ev.preventDefault(); ev.stopPropagation();
          window.flfContentResults();
        };
        tabs.appendChild(cb);
      }
    }
  }

  function boot() {
    setTimeout(function () { mount().catch(function () {}); }, 600);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
})();
