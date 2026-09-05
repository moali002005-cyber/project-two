// نظام إشعارات Flfluencer - ملف موحد
// يستخدم في كل الصفحات لعرض الجرس والإشعارات

// تسجيل Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(err => {
    console.warn('SW registration failed:', err);
  });
}

// إضافة CSS الإشعارات
const notifStyles = `
<style>
.notif-bell {
  position: relative;
  background: white;
  border: 1px solid var(--line, rgba(26,23,20,0.1));
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  transition: all 0.2s;
}
.notif-bell:hover {
  border-color: var(--accent, #D4523A);
}
.notif-badge {
  position: absolute;
  top: -4px;
  inset-inline-end: -4px;
  background: var(--accent, #D4523A);
  color: white;
  font-size: 10px;
  font-weight: 600;
  min-width: 18px;
  height: 18px;
  border-radius: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
  border: 2px solid white;
  font-family: var(--font-display, 'Reem Kufi', sans-serif);
}
.notif-badge.hidden { display: none; }

.notif-dropdown {
  position: absolute;
  top: 50px;
  inset-inline-end: 0;
  background: white;
  border: 1px solid var(--line, rgba(26,23,20,0.1));
  border-radius: 20px;
  width: 380px;
  max-width: calc(100vw - 32px);
  max-height: 500px;
  overflow: hidden;
  display: none;
  flex-direction: column;
  z-index: 100;
  box-shadow: 0 8px 32px rgba(26, 23, 20, 0.12);
}
.notif-dropdown.show { display: flex; }

.notif-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--line, rgba(26,23,20,0.1));
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.notif-header h3 {
  font-family: var(--font-display, 'Reem Kufi', sans-serif);
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}
.notif-mark-read {
  font-size: 12px;
  color: var(--accent, #D4523A);
  background: none;
  border: none;
  cursor: pointer;
  font-family: var(--font-body, 'Tajawal', sans-serif);
}
.notif-mark-read:hover { text-decoration: underline; }

.notif-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}
.notif-empty {
  text-align: center;
  padding: 40px 20px;
  color: var(--ink-muted, #6B645B);
  font-size: 14px;
}

.notif-item {
  padding: 14px 20px;
  border-bottom: 1px solid var(--line, rgba(26,23,20,0.08));
  cursor: pointer;
  display: flex;
  gap: 12px;
  transition: background 0.15s;
  text-decoration: none;
  color: inherit;
}
.notif-item:hover {
  background: var(--cream-darker, #EFE9DD);
}
.notif-item.unread {
  background: rgba(212, 82, 58, 0.04);
}
.notif-item:last-child { border-bottom: none; }

.notif-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 16px;
}
.notif-icon.campaign { background: rgba(212, 82, 58, 0.12); color: var(--accent, #D4523A); }
.notif-icon.application { background: rgba(91, 96, 66, 0.12); color: var(--olive, #5B6042); }
.notif-icon.message { background: rgba(184, 145, 94, 0.15); color: var(--gold, #B8915E); }
.notif-icon.workflow { background: rgba(91, 96, 66, 0.12); color: var(--olive, #5B6042); }
.notif-icon.deal { background: rgba(91, 96, 66, 0.15); color: var(--olive, #5B6042); }

.notif-content { flex: 1; min-width: 0; }
.notif-title {
  font-family: var(--font-display, 'Reem Kufi', sans-serif);
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
  color: var(--ink, #1A1714);
}
.notif-message {
  font-size: 13px;
  color: var(--ink-soft, #3D3833);
  margin-bottom: 4px;
  line-height: 1.5;
}
.notif-time {
  font-size: 11px;
  color: var(--ink-faint, #A8A095);
}
.notif-dot {
  width: 8px;
  height: 8px;
  background: var(--accent, #D4523A);
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 14px;
}
.notif-dot.read { visibility: hidden; }

.install-banner {
  display: none;
  position: fixed;
  bottom: 20px;
  inset-inline-start: 20px;
  inset-inline-end: 20px;
  background: var(--ink, #1A1714);
  color: white;
  padding: 16px 20px;
  border-radius: 16px;
  z-index: 999;
  align-items: center;
  gap: 12px;
  max-width: 500px;
  margin: 0 auto;
  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
}
.install-banner.show { display: flex; }
.install-banner .text { flex: 1; }
.install-banner h4 {
  font-family: var(--font-display, 'Reem Kufi', sans-serif);
  font-size: 14px;
  margin-bottom: 2px;
}
.install-banner p {
  font-size: 12px;
  opacity: 0.85;
  margin: 0;
}
.install-banner button {
  background: var(--accent, #D4523A);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 100px;
  font-family: var(--font-body, 'Tajawal', sans-serif);
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}
.install-banner .close-btn {
  background: transparent;
  font-size: 18px;
  padding: 4px 8px;
}

@media (max-width: 480px) {
  .notif-dropdown {
    position: fixed;
    top: 80px;
    left: 16px;
    right: 16px;
    inset-inline-end: 16px;
    inset-inline-start: 16px;
    width: auto;
    max-width: none;
  }
}
</style>
`;

// إضافة الأنماط للصفحة
if (!document.getElementById('notif-styles')) {
  const styleEl = document.createElement('div');
  styleEl.id = 'notif-styles';
  styleEl.innerHTML = notifStyles;
  document.head.appendChild(styleEl.firstElementChild);
}

let notifData = [];
let unreadCount = 0;
let notifPollInterval = null;
let notifLoaded = false;

// إنشاء جرس الإشعارات
function createBellHTML() {
  return `
    <div style="position: relative">
      <button class="notif-bell" onclick="toggleNotifications(event)" id="notif-bell-btn" aria-label="الإشعارات">
        🔔
        <span class="notif-badge hidden" id="notif-badge">0</span>
      </button>
      <div class="notif-dropdown" id="notif-dropdown">
        <div class="notif-header">
          <h3>الإشعارات</h3>
          <button class="notif-mark-read" onclick="markAllAsRead()">تعليم الكل كمقروء</button>
        </div>
        <div class="notif-list" id="notif-list">
          <div class="notif-empty">جاري التحميل...</div>
        </div>
      </div>
    </div>
  `;
}

// تركيب الجرس في الـ navbar
function mountBell(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = createBellHTML();
  container.insertBefore(wrapper.firstElementChild, container.firstChild);
}

// جلب الإشعارات
async function loadNotifications() {
  const user = getCurrentUser();

  // DEBUG: نعرض رسالة على الشاشة
  showDebug('User: ' + (user ? user.name + ' (id: ' + user.id.substring(0,8) + ')' : 'NONE'));
  showDebug('Supabase ready: ' + (window.supabaseClient ? 'YES' : 'NO'));

  if (!user) {
    notifLoaded = true;
    renderNotifList();
    showDebug('STOPPED: no user');
    return;
  }

  // ننتظر supabase يكون جاهز (حتى 5 ثواني)
  let waitCount = 0;
  while (!window.supabaseClient && waitCount < 50) {
    await new Promise(r => setTimeout(r, 100));
    waitCount++;
  }

  if (!window.supabaseClient) {
    showDebug('STOPPED: supabase not ready after wait');
    notifLoaded = true;
    renderNotifList();
    return;
  }

  showDebug('Supabase ready, fetching...');

  try {
    const { data, error } = await supabaseClient
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      showDebug('ERROR: ' + JSON.stringify(error));
      throw error;
    }

    showDebug('Found: ' + (data?.length || 0) + ' notifications');

    notifData = data || [];
    unreadCount = notifData.filter(n => !n.is_read).length;
    notifLoaded = true;
    renderBell();
    renderNotifList();
  } catch (err) {
    console.error('Failed to load notifications:', err);
    showDebug('CATCH: ' + err.message);
    notifLoaded = true;
    renderNotifList();
  }
}

function showDebug(msg) {
  return;
  let debugEl = document.getElementById('notif-debug');
  if (!debugEl) {
    debugEl = document.createElement('div');
    debugEl.id = 'notif-debug';
    debugEl.style.cssText = 'position:fixed; top:80px; left:10px; right:10px; background:#1A1714; color:#F7F3EC; padding:10px; border-radius:8px; font-size:11px; font-family:monospace; z-index:9999; max-height:200px; overflow:auto; direction:ltr; text-align:left;';
    document.body.appendChild(debugEl);
  }
  const time = new Date().toLocaleTimeString();
  debugEl.innerHTML += `<div>[${time}] ${msg}</div>`;
}

function renderBell() {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  if (unreadCount > 0) {
    badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function renderNotifList() {
  const list = document.getElementById('notif-list');
  if (!list) return;

  if (!notifLoaded) {
    list.innerHTML = '<div class="notif-empty">جاري التحميل...</div>';
    return;
  }

  if (notifData.length === 0) {
    list.innerHTML = '<div class="notif-empty">ما عندك إشعارات بعد</div>';
    return;
  }

  const iconMap = {
    new_campaign: { class: 'campaign', emoji: '🎯' },
    new_application: { class: 'application', emoji: '📨' },
    new_message: { class: 'message', emoji: '💬' },
    workflow_update: { class: 'workflow', emoji: '✓' },
    deal_closed: { class: 'deal', emoji: '🤝' }
  };

  list.innerHTML = notifData.map(n => {
    const icon = iconMap[n.type] || { class: 'message', emoji: '🔔' };
    const safe = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    // الرابط قد يأتي من صف أنشأه مستخدم آخر — نقبل المسارات الداخلية فقط
    const safeLink = (s) => { const v = String(s == null ? '' : s); return /^\/[^\/\\]/.test(v) ? safe(v) : '#'; };
    return `
      <a href="${safeLink(n.link)}" class="notif-item ${n.is_read ? '' : 'unread'}" onclick="markAsRead('${n.id}', event)">
        <div class="notif-icon ${icon.class}">${icon.emoji}</div>
        <div class="notif-content">
          <div class="notif-title">${safe(n.title)}</div>
          ${n.message ? `<div class="notif-message">${safe(n.message)}</div>` : ''}
          <div class="notif-time">${formatNotifTime(n.created_at)}</div>
        </div>
        <div class="notif-dot ${n.is_read ? 'read' : ''}"></div>
      </a>
    `;
  }).join('');
}

function formatNotifTime(iso) {
  const date = new Date(iso);
  const now = new Date();
  const diff = (now - date) / 1000;
  if (diff < 60) return 'الآن';
  if (diff < 3600) return `قبل ${Math.floor(diff / 60)} دقيقة`;
  if (diff < 86400) return `قبل ${Math.floor(diff / 3600)} ساعة`;
  if (diff < 604800) return `قبل ${Math.floor(diff / 86400)} يوم`;
  return date.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' });
}

async function toggleNotifications(event) {
  if (event) event.stopPropagation();
  const dropdown = document.getElementById('notif-dropdown');
  if (!dropdown) return;
  dropdown.classList.toggle('show');
  if (dropdown.classList.contains('show')) {
    // نعرض البيانات الحالية فوراً (لو موجودة)
    renderNotifList();
    // نحدّث من القاعدة ثم نعلّمها كمقروءة (تثبت ولا ترجع غير مقروءة)
    await loadNotifications();
    markAllAsRead();
  }
}

async function markAsRead(notifId, event) {
  const notif = notifData.find(n => n.id === notifId);
  if (!notif || notif.is_read) return;

  notif.is_read = true;
  unreadCount = Math.max(0, unreadCount - 1);
  renderBell();
  renderNotifList();

  try {
    await supabaseClient
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notifId);
  } catch (err) {
    console.error('Failed to mark as read:', err);
  }
}

async function markAllAsRead() {
  const user = getCurrentUser();
  if (!user) return;

  notifData.forEach(n => n.is_read = true);
  unreadCount = 0;
  renderBell();
  renderNotifList();

  try {
    const { error } = await supabaseClient.rpc('mark_my_notifications_read');
    if (error) throw error;
  } catch (err) {
    console.error('Failed to mark all as read:', err);
  }
}

// إغلاق القائمة المنسدلة عند الضغط خارجها
document.addEventListener('click', (event) => {
  const dropdown = document.getElementById('notif-dropdown');
  const bell = document.getElementById('notif-bell-btn');
  if (!dropdown || !bell) return;
  if (!bell.contains(event.target) && !dropdown.contains(event.target)) {
    dropdown.classList.remove('show');
  }
});

// دالة إنشاء إشعار (تستخدم من أماكن أخرى)
async function createNotification(userId, type, title, message, link) {
  if (!window.supabaseClient) return;
  try {
    // نمرّ عبر دالة تتحقق من وجود علاقة فعلية بيني وبين المستقبِل،
    // بدل الكتابة المباشرة على الجدول (كانت تسمح لأي مستخدم بمراسلة أي مستخدم).
    const { error } = await supabaseClient.rpc('notify_user', {
      p_user: userId, p_type: type, p_title: title,
      p_message: message || null, p_link: link || null
    });
    if (error) throw error;
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
}

// ===== المطابقة الذكية: حدود النطاقات القديمة (للحملات المنشأة قبل التوحيد) =====
const SIMBL_FOLLOWER_BOUNDS = {
  '20-50k':   [20000, 50000],
  '50-200k':  [50000, 200000],
  '200-500k': [200000, 500000],
  '500k+':    [500000, Infinity]
};

// المطابقة 100٪: نطاقات الحملة الآن نفس قيم شرائح المؤثر الرقمية (10000، 20000 ...).
// القاعدة: شريحة المؤثر (followers) لازم تساوي إحدى الشرائح اللي اختارتها الشركة — تطابق تام.
// مع دعم خلفي: لو الحملة قديمة وفيها نطاق نصّي (مثل 200-500k) نرجع لفحص الحدود.
function simblFollowersMatch(followers, followerRange) {
  const f = parseInt(followers, 10);
  if (!f || isNaN(f)) return false;
  const tokens = String(followerRange || '').split(',').map(s => s.trim()).filter(Boolean);
  if (tokens.length === 0) return true; // الشركة ما حددت شريحة → الكل يطابق
  return tokens.some(tok => {
    const legacy = SIMBL_FOLLOWER_BOUNDS[tok];
    if (legacy) return f >= legacy[0] && f < legacy[1]; // نطاق قديم → فحص حدود
    const exact = parseInt(tok, 10);                     // شريحة رقمية → مساواة تامة
    return !isNaN(exact) && f === exact;
  });
}

// إشعار المؤثرين المطابقين فقط (فلتر 1: المنصة مطابقة · فلتر 2: المتابعون ضمن النطاق)
async function notifyMatchedCreators(campaign, brandName) {
  if (!window.supabaseClient || !campaign) return [];
  try {
    let q = supabaseClient
      .from('users')
      .select('id, followers, platform, country, city, creator_tier')
      .eq('role', 'creator')
      .eq('is_test', !!(getCurrentUser()?.is_test));

    // فلتر 1 — المنصة: مطابقة تامة لو الحملة محددة منصة
    if (campaign.platform) q = q.eq('platform', campaign.platform);

    const { data: creators } = await q;
    if (!creators || creators.length === 0) return [];

    // فلتر موحّد — نفس منطق العرض والدخول والوكيل (الدولة + المدينة + المنصة + نطاق المتابعين)
    // مصدر واحد للحقيقة: simblTargetMatch من supabase-config.js (يُحمّل قبل هذا الملف).
    let matched;
    if (typeof simblTargetMatch === 'function') {
      matched = creators.filter(c => simblTargetMatch(c, campaign));
    } else {
      const locMatch = (typeof simblLocationMatch === 'function') ? simblLocationMatch : () => true;
      matched = creators.filter(c =>
        simblFollowersMatch(c.followers, campaign.follower_range) && locMatch(c, campaign)
      );
    }
    if (matched.length === 0) return [];

    const ids = matched.map(c => c.id);
    // مدن المعلنين المطابقين — تستخدمها شاشة خريطة الإطلاق (بلا أعداد)
    try { ids.cities = [...new Set(matched.map(c => c.city).filter(Boolean))]; } catch (_) {}
    // دالة تتحقق أن المستدعي هو صاحب الحملة قبل أن ترسل لأي معلن
    const { error } = await supabaseClient.rpc('notify_campaign_matches', {
      p_campaign: campaign.id,
      p_creators: ids,
      p_title: `🎯 حملة جديدة تناسبك من ${brandName}`,
      p_message: campaign.title
    });
    if (error) throw error;
    return ids;
  } catch (err) {
    console.error('Failed to notify matched creators:', err);
    return [];
  }
}

// PWA Install banner
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallBanner();
});

function showInstallBanner() {
  // ما نعرض البانر لو المستخدم رفضه قبل
  if (localStorage.getItem('simbl_install_dismissed')) return;
  if (window.matchMedia('(display-mode: standalone)').matches) return;

  let banner = document.getElementById('install-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'install-banner';
    banner.className = 'install-banner';
    banner.innerHTML = `
      <div class="text">
        <h4>📱 ثبّت Flfluencer على شاشتك</h4>
        <p>وصول أسرع وإشعارات فورية</p>
      </div>
      <button onclick="installApp()">تثبيت</button>
      <button class="close-btn" onclick="dismissInstall()" aria-label="إغلاق">×</button>
    `;
    document.body.appendChild(banner);
  }
  setTimeout(() => banner.classList.add('show'), 1500);
}

async function installApp() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') {
    localStorage.setItem('simbl_install_dismissed', 'true');
  }
  deferredPrompt = null;
  document.getElementById('install-banner')?.classList.remove('show');
}

function dismissInstall() {
  localStorage.setItem('simbl_install_dismissed', 'true');
  document.getElementById('install-banner')?.classList.remove('show');
}

// تشخيص iOS: عرض تعليمات يدوية
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true;
}

if (isIOS() && !isStandalone() && !localStorage.getItem('simbl_ios_dismissed')) {
  setTimeout(() => {
    let banner = document.createElement('div');
    banner.className = 'install-banner show';
    banner.innerHTML = `
      <div class="text">
        <h4>📱 أضيفي Flfluencer لشاشتك</h4>
        <p>اضغطي زر المشاركة ⬆ ثم "Add to Home Screen"</p>
      </div>
      <button class="close-btn" onclick="this.parentElement.remove(); localStorage.setItem('simbl_ios_dismissed', 'true')" aria-label="إغلاق">×</button>
    `;
    document.body.appendChild(banner);
  }, 2500);
}

// تشغيل تلقائي
async function initNotifications(bellContainerId) {
  if (bellContainerId) {
    mountBell(bellContainerId);
  }
  // ننتظر استعادة الجلسة أولاً قبل تحميل الإشعارات
  if (typeof tryRestoreSession === 'function') {
    await tryRestoreSession();
  }
  // تحميل الإشعارات بعد ما نتأكد من المستخدم
  await loadNotifications();
  // تحديث كل دقيقة
  if (notifPollInterval) clearInterval(notifPollInterval);
  notifPollInterval = setInterval(function(){ if (!document.hidden) loadNotifications(); }, 60000);
  if (!window.__flfNotifVizHooked) {
    window.__flfNotifVizHooked = true;
    var __notifVizAt = 0;
    document.addEventListener('visibilitychange', function(){
      if (document.hidden) return;
      if (Date.now() - __notifVizAt < 45000) return;
      __notifVizAt = Date.now();
      loadNotifications();
    });
  }
}

/* ============================================================
   شاشة إطلاق الحملة — خريطة الوصول
   ترسم حدود المملكة بنقطة ضوء، ثم تطير النقاط لمدن المعلنين
   المطابقين، ثم تنبض لحظة وتنتقل تلقائيًا للخطوة التالية.
   الاستدعاء: showLaunchMap({cities, target, country}, onDone)
   ============================================================ */
const LM_OUTLINE = [
 [34.6,28.05],[34.9,29.35],[36.0,29.35],[37.0,30.0],[37.5,30.5],[38.0,30.5],[39.1,32.15],
 [40.4,31.9],[42.1,31.1],[44.7,29.2],[46.4,29.1],[47.45,29.0],[47.7,28.5],[48.4,28.55],
 [48.8,27.7],[49.6,27.35],[50.2,26.6],[50.1,25.9],[50.8,25.0],[51.3,24.6],[51.6,24.2],
 [52.6,23.0],[55.2,22.7],[55.7,22.0],[55.0,20.0],[52.0,19.0],[49.0,18.6],[47.0,17.0],
 [45.0,17.4],[43.4,17.4],[43.2,16.9],[42.8,16.4],[42.6,17.3],[41.8,18.6],[41.0,19.9],
 [40.0,20.6],[39.1,21.5],[38.4,22.6],[38.0,23.8],[37.2,25.0],[36.5,25.7],[35.6,27.0],[34.9,27.8]
];
const LM_CITIES = {
  riyadh:['الرياض',46.72,24.69], jeddah:['جدة',39.19,21.49], makkah:['مكة',39.83,21.39],
  madinah:['المدينة',39.61,24.47], dammam:['الدمام',50.10,26.43], khobar:['الخبر',50.21,26.28],
  dhahran:['الظهران',50.15,26.30], ahsa:['الأحساء',49.59,25.36], taif:['الطائف',40.42,21.27],
  buraidah:['بريدة',43.97,26.36], tabuk:['تبوك',36.57,28.38], hail:['حائل',41.69,27.52],
  abha:['أبها',42.51,18.22], khamis:['خميس مشيط',42.73,18.30], jazan:['جازان',42.55,16.89],
  najran:['نجران',44.13,17.49], yanbu:['ينبع',38.06,24.09], jubail:['الجبيل',49.66,27.01]
};
const LM_CSS = `
#lm-ov{position:fixed;inset:0;z-index:9999;background:#FFFFFF;display:none;opacity:0;
  transition:opacity .35s ease;font-family:var(--font-body,system-ui)}
#lm-ov.show{display:flex;opacity:1}
#lm-ov .lm-stage{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
  justify-content:center;padding:26px 18px;transition:opacity .55s ease, transform .55s cubic-bezier(.4,0,.6,1)}
#lm-ov .lm-stage.leave{opacity:0;transform:scale(1.08)}
#lm-ov .lm-kick{font-size:13px;color:#606A78;opacity:0;transition:opacity .5s}
#lm-ov .lm-kick.on{opacity:1}
#lm-ov .lm-ttl{font-family:var(--font-display,inherit);font-size:21px;font-weight:800;color:#0F1420;margin-top:4px}
#lm-ov .lm-scene{position:relative;width:min(340px,86vw);height:min(340px,86vw);margin-top:14px;overflow:hidden}
#lm-ov .lm-scene.glowpulse::after{content:'';position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(circle at 50% 50%,rgba(226,59,46,.10),rgba(226,59,46,0) 62%);
  animation:lmGlow 2.4s ease-in-out infinite}
@keyframes lmGlow{0%,100%{opacity:.25}50%{opacity:.85}}
#lm-ov .lm-cam{position:absolute;inset:0;transform-origin:50% 50%;transition:transform 1.5s cubic-bezier(.3,.85,.25,1)}
#lm-ov svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
#lm-ov .lm-labels{position:absolute;inset:0;pointer-events:none}
#lm-ov .lm-fill{fill:#F3F5F7;stroke:none;opacity:0;transition:opacity 1s ease;
  filter:drop-shadow(0 6px 16px rgba(15,20,32,.07))}
#lm-ov .lm-fill.on{opacity:1}
#lm-ov .lm-line{fill:none;stroke:#E23B2E;stroke-width:2.4;stroke-linejoin:round;stroke-linecap:round}
#lm-ov .lm-line.calm{stroke:#C9CFD8;stroke-width:1.4;transition:stroke 1s ease, stroke-width 1s ease}
#lm-ov .lm-comet{fill:#fff;stroke:#E23B2E;stroke-width:2;opacity:0;transition:opacity .35s}
#lm-ov .lm-halo{fill:#E23B2E;opacity:0;transition:opacity .35s}
#lm-ov .lm-trail{fill:none;stroke:#E23B2E;stroke-width:1.3;stroke-linecap:round;opacity:.34}
#lm-ov .lm-flyer{fill:#E23B2E}
#lm-ov .lm-ripple{fill:none;stroke:#E23B2E;stroke-width:1.6}
#lm-ov .lm-dot{fill:#E23B2E;opacity:0;transition:opacity .3s;transform-box:fill-box;transform-origin:center}
#lm-ov .lm-dot.on{opacity:1}
#lm-ov .lm-dot.breathe{animation:lmBreathe 2.4s ease-in-out infinite}
@keyframes lmBreathe{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.5);opacity:.72}}
#lm-ov .lm-lab{position:absolute;transform:translate(-50%,-140%) scale(.8);white-space:nowrap;background:#fff;
  border:1px solid #E8E4DC;border-radius:100px;padding:2px 9px;font-size:11px;font-weight:700;color:#0F1420;
  box-shadow:0 5px 14px rgba(15,20,32,.10);opacity:0;
  transition:opacity .4s, transform .45s cubic-bezier(.2,1.4,.35,1)}
#lm-ov .lm-lab.on{opacity:1;transform:translate(-50%,-160%) scale(1)}
#lm-ov .lm-cap{font-size:13.5px;color:#606A78;margin-top:12px;line-height:1.7;text-align:center;max-width:330px}
#lm-ov .lm-cap b{color:#0F1420;font-weight:700}
`;

function showLaunchMap(opts, onDone) {
  opts = opts || {};
  if (typeof opts === 'function') { onDone = opts; opts = {}; }
  const done = typeof onDone === 'function' ? onDone : function(){};

  // خارج السعودية: ما عندنا حدود مرسومة، نرجع للرادار القديم
  if ((opts.country || 'SA') !== 'SA') {
    if (typeof showLaunchRadar === 'function') return showLaunchRadar(done);
    return done();
  }

  const NS = 'http://www.w3.org/2000/svg';
  const W = 300, H = 300, PAD = 18;
  let timers = [], raf = [];
  const T = (fn, ms) => timers.push(setTimeout(fn, ms));
  const el = (t, a) => { const n = document.createElementNS(NS, t); for (const k in a) n.setAttribute(k, a[k]); return n; };
  const ease = t => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;

  if (!document.getElementById('lm-style')) {
    const st = document.createElement('style'); st.id = 'lm-style'; st.textContent = LM_CSS;
    document.head.appendChild(st);
  }
  let ov = document.getElementById('lm-ov');
  if (ov) ov.remove();
  ov = document.createElement('div');
  ov.id = 'lm-ov';
  ov.innerHTML =
    '<div class="lm-stage">' +
      '<div class="lm-kick">تم نشر حملتك</div>' +
      '<div class="lm-ttl">جارٍ رسم نطاق حملتك…</div>' +
      '<div class="lm-scene"><div class="lm-cam">' +
        '<svg viewBox="0 0 300 300" preserveAspectRatio="xMidYMid meet"></svg>' +
        '<div class="lm-labels"></div>' +
      '</div></div>' +
      '<div class="lm-cap">نجهّز قائمة المعلنين المطابقين…</div>' +
    '</div>';
  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('show'));

  const svg = ov.querySelector('svg'), cam = ov.querySelector('.lm-cam'),
        labels = ov.querySelector('.lm-labels'), stage = ov.querySelector('.lm-stage'),
        scene = ov.querySelector('.lm-scene'), ttl = ov.querySelector('.lm-ttl'),
        kick = ov.querySelector('.lm-kick'), cap = ov.querySelector('.lm-cap');

  const lons = LM_OUTLINE.map(p=>p[0]), lats = LM_OUTLINE.map(p=>p[1]);
  const a0=Math.min(...lons), b0=Math.max(...lons), c0=Math.min(...lats), d0=Math.max(...lats);
  const kk=Math.cos((c0+d0)/2*Math.PI/180), ww=(b0-a0)*kk, hh=(d0-c0);
  const ss=Math.min((W-PAD*2)/ww,(H-PAD*2)/hh), ox=(W-ww*ss)/2, oy=(H-hh*ss)/2;
  const toXY = ([lon,lat]) => [ ox+(b0-lon)*kk*ss, oy+(d0-lat)*ss ];

  function addLabel(x, y, text, delay) {
    const l = document.createElement('div');
    l.className = 'lm-lab';
    l.style.left = (x/W*100)+'%'; l.style.top = (y/H*100)+'%';
    l.textContent = text;
    labels.appendChild(l);
    T(() => l.classList.add('on'), delay);
  }

  function fly(from, to, delay, side) {
    const mx=(from[0]+to[0])/2, my=(from[1]+to[1])/2;
    const dx=to[0]-from[0], dy=to[1]-from[1], len=Math.hypot(dx,dy)||1, k=len*0.28*side;
    const cx=mx-dy/len*k, cy=my+dx/len*k;
    const d='M'+from[0]+' '+from[1]+' Q'+cx+' '+cy+' '+to[0]+' '+to[1];
    const trail=el('path',{d,class:'lm-trail'});
    const dot=el('circle',{r:2.8,class:'lm-flyer',cx:from[0],cy:from[1],opacity:0});
    svg.appendChild(trail); svg.appendChild(dot);
    const L=trail.getTotalLength();
    trail.style.strokeDasharray=L; trail.style.strokeDashoffset=L;
    T(function(){
      dot.setAttribute('opacity',1);
      const t0=performance.now();
      (function step(now){
        const p=Math.min(1,(now-t0)/620), e=ease(p);
        trail.style.strokeDashoffset=L*(1-e);
        const pt=trail.getPointAtLength(L*e);
        dot.setAttribute('cx',pt.x); dot.setAttribute('cy',pt.y);
        if(p<1) raf.push(requestAnimationFrame(step));
        else{
          dot.setAttribute('opacity',0);
          trail.style.transition='opacity .5s'; trail.style.opacity=0;
          const r=el('circle',{cx:to[0],cy:to[1],r:3,class:'lm-ripple',opacity:.75});
          svg.appendChild(r);
          const an=r.animate?r.animate([{r:3,opacity:.75},{r:16,opacity:0}],{duration:900,easing:'ease-out'}):null;
          if(an) an.onfinish=function(){r.remove();}; else T(function(){r.remove();},900);
          const cd=el('circle',{cx:to[0],cy:to[1],r:3.4,class:'lm-dot'});
          svg.appendChild(cd);
          requestAnimationFrame(function(){cd.classList.add('on');});
        }
      })(t0);
    }, delay);
  }

  function settleThenGo(at) {
    T(function(){
      scene.classList.add('glowpulse');
      svg.querySelectorAll('.lm-dot').forEach(function(d,i){
        d.style.animationDelay=(i*0.12)+'s'; d.classList.add('breathe');
      });
      [0,760].forEach(function(off){
        T(function(){
          svg.querySelectorAll('.lm-dot').forEach(function(d,i){
            T(function(){
              const r=el('circle',{cx:d.getAttribute('cx'),cy:d.getAttribute('cy'),r:4,class:'lm-ripple',opacity:.5});
              svg.appendChild(r);
              const an=r.animate?r.animate([{r:4,opacity:.5},{r:20,opacity:0}],{duration:1000,easing:'ease-out'}):null;
              if(an) an.onfinish=function(){r.remove();}; else T(function(){r.remove();},1000);
            }, i*70);
          });
        }, at+off);
      });
    }, at);
    T(function(){ ttl.textContent='نأخذك لحملتك…'; }, at+1150);
    T(function(){ stage.classList.add('leave'); }, at+1400);
    T(function(){
      raf.forEach(cancelAnimationFrame); timers.forEach(clearTimeout);
      ov.classList.remove('show');
      setTimeout(function(){ if(ov && ov.parentNode) ov.remove(); }, 400);
      done();
    }, at+1750);
  }

  // ---- الرسم ----
  const d = LM_OUTLINE.map(toXY).map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ')+' Z';
  const fill=el('path',{d,class:'lm-fill'}), line=el('path',{d,class:'lm-line'});
  const halo=el('circle',{r:9,class:'lm-halo'}), comet=el('circle',{r:3.6,class:'lm-comet'});
  svg.appendChild(fill); svg.appendChild(line); svg.appendChild(halo); svg.appendChild(comet);
  const L=line.getTotalLength();
  line.style.strokeDasharray=L; line.style.strokeDashoffset=L;
  T(function(){ comet.style.opacity=1; halo.style.opacity=.28; },20);

  const heart = toXY([45.0,24.2]);
  const known = (opts.cities||[]).filter(function(c){ return LM_CITIES[c]; });
  const list = known.length ? known : Object.keys(LM_CITIES).slice(0,8);
  const single = opts.target && opts.target !== 'all' && LM_CITIES[opts.target] ? opts.target : null;

  const t0=performance.now();
  (function step(now){
    const p=Math.min(1,(now-t0)/1200), e=ease(p);
    line.style.strokeDashoffset=L*(1-e);
    const pt=line.getPointAtLength(L*e);
    comet.setAttribute('cx',pt.x); comet.setAttribute('cy',pt.y);
    halo.setAttribute('cx',pt.x);  halo.setAttribute('cy',pt.y);
    if(p<1) raf.push(requestAnimationFrame(step));
    else{
      comet.style.opacity=0; halo.style.opacity=0;
      fill.classList.add('on');
      T(function(){ line.classList.add('calm'); },120);
      ttl.textContent='جارٍ إشعار المعلنين';
      kick.classList.add('on');
      cap.textContent='نرسل الإشعارات للمعلنين المطابقين لاستهدافك';

      if (single) {
        const to=toXY([LM_CITIES[single][1],LM_CITIES[single][2]]);
        const sx=(to[0]/W-0.5)*-100, sy=(to[1]/H-0.5)*-100;
        cam.style.transform='translate('+sx+'%,'+sy+'%) scale(2.3)';
        fly(heart,to,120,-1);
        addLabel(to[0],to[1],LM_CITIES[single][0],820);
        const k=14;
        for(let i=0;i<k;i++){
          const ang=Math.random()*Math.PI*2, dd=4+Math.random()*11;
          fly(to,[to[0]+Math.cos(ang)*dd,to[1]+Math.sin(ang)*dd],900+i*90,i%2?1:-1);
        }
        const end=900+k*90+800;
        T(function(){
          ttl.textContent='وصلت حملتك';
          cap.innerHTML='المعلنون المطابقون في <b>'+LM_CITIES[single][0]+'</b> استلموا إشعار حملتك';
        },end);
        settleThenGo(end+150);
      } else {
        list.forEach(function(slug,i){
          const c=LM_CITIES[slug]; if(!c) return;
          const to=toXY([c[1],c[2]]);
          fly(heart,to,i*160,i%2?1:-1);
          addLabel(to[0],to[1],c[0],i*160+640);
        });
        const end=list.length*160+900;
        T(function(){
          ttl.textContent='وصلت حملتك';
          cap.innerHTML='المعلنون المطابقون في <b>كل مناطق المملكة</b> استلموا إشعار حملتك';
        },end);
        settleThenGo(end+150);
      }
    }
  })(t0);
}
