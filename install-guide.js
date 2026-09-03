// ============ دليل التثبيت + تفعيل الإشعارات ============
// يعرض للمستخدم ما يخصّه فقط:
//   • مثبّت التطبيق أصلًا  → زر تفعيل واحد، بلا خطوات تثبيت.
//   • آيفون بلا تثبيت      → ثلاث خطوات مرسومة (آبل تشترط الإضافة للشاشة الرئيسية قبل السماح بالإشعارات).
//   • أندرويد / كمبيوتر    → زر تفعيل مباشر، ما يحتاج تثبيت.
(function () {
  var SKIP_KEY = 'simbl_install_skip';

  function isStandalone() {
    try { return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true; }
    catch (e) { return false; }
  }
  function isIOS() {
    try {
      var ua = navigator.userAgent || '';
      if (/iPad|iPhone|iPod/.test(ua)) return true;
      return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1; // آيباد بواجهة سطح المكتب
    } catch (e) { return false; }
  }
  function notifGranted() {
    try { return typeof Notification !== 'undefined' && Notification.permission === 'granted'; }
    catch (e) { return false; }
  }
  function notifDenied() {
    try { return typeof Notification !== 'undefined' && Notification.permission === 'denied'; }
    catch (e) { return false; }
  }
  function hasUser() {
    try { var u = JSON.parse(localStorage.getItem('simbl_current_user') || 'null'); return !!(u && u.id); }
    catch (e) { return false; }
  }
  function otherModalOpen() {
    return !!document.querySelector('#city-modal.on, #group-modal.on, #campaign-modal.show, #push-modal.on');
  }

  // ===== الرسوم: SVG مضمّن، بلا أي ملفات خارجية =====
  var SVG_NS = 'xmlns="http://www.w3.org/2000/svg"';

  // هاتف وفيه شريط سفاري السفلي وزر المشاركة معلَّم بدائرة حمراء
  function drawShare() {
    return '<svg ' + SVG_NS + ' viewBox="0 0 120 96" width="100%" height="100%" role="img" aria-label="زر المشاركة في سفاري">' +
      '<rect x="26" y="4" width="68" height="88" rx="11" fill="#fff" stroke="#D9DEE3" stroke-width="2"/>' +
      '<rect x="32" y="12" width="56" height="52" rx="5" fill="#F3F5F7"/>' +
      '<rect x="38" y="20" width="44" height="4" rx="2" fill="#DCE1E6"/>' +
      '<rect x="38" y="30" width="34" height="4" rx="2" fill="#E6EAEE"/>' +
      '<rect x="38" y="40" width="40" height="4" rx="2" fill="#E6EAEE"/>' +
      '<rect x="32" y="70" width="56" height="16" rx="6" fill="#F3F5F7"/>' +
      '<g stroke="#9AA4AE" stroke-width="1.8" stroke-linecap="round" fill="none">' +
        '<path d="M41 78h5"/><path d="M74 78h5"/>' +
      '</g>' +
      // أيقونة المشاركة
      '<g stroke="#E23B2E" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" fill="none">' +
        '<path d="M60 72v9"/><path d="M56.6 75.4 60 72l3.4 3.4"/>' +
        '<path d="M55 79.5v3a1.6 1.6 0 0 0 1.6 1.6h6.8a1.6 1.6 0 0 0 1.6-1.6v-3"/>' +
      '</g>' +
      '<circle cx="60" cy="78" r="13" fill="none" stroke="#E23B2E" stroke-width="2.4"/>' +
      '</svg>';
  }

  // قائمة المشاركة وفيها صف «إضافة إلى الشاشة الرئيسية»
  function drawAddHome() {
    return '<svg ' + SVG_NS + ' viewBox="0 0 120 96" width="100%" height="100%" role="img" aria-label="إضافة إلى الشاشة الرئيسية">' +
      '<rect x="10" y="10" width="100" height="76" rx="12" fill="#fff" stroke="#D9DEE3" stroke-width="2"/>' +
      '<rect x="20" y="22" width="80" height="14" rx="6" fill="#F3F5F7"/>' +
      '<rect x="34" y="27" width="44" height="4" rx="2" fill="#DCE1E6"/>' +
      '<rect x="20" y="42" width="80" height="14" rx="6" fill="#F3F5F7"/>' +
      '<rect x="34" y="47" width="34" height="4" rx="2" fill="#DCE1E6"/>' +
      // الصف المعلَّم
      '<rect x="16" y="60" width="88" height="20" rx="8" fill="#FDF0EE" stroke="#E23B2E" stroke-width="2"/>' +
      '<rect x="82" y="65" width="10" height="10" rx="3" fill="none" stroke="#E23B2E" stroke-width="1.9"/>' +
      '<path d="M87 67.6v4.8M84.6 70h4.8" stroke="#E23B2E" stroke-width="1.9" stroke-linecap="round"/>' +
      '<rect x="30" y="68" width="44" height="4" rx="2" fill="#E88C80"/>' +
      '</svg>';
  }

  // أيقونة التطبيق على الشاشة الرئيسية ومعها جرس
  function drawIcon() {
    return '<svg ' + SVG_NS + ' viewBox="0 0 120 96" width="100%" height="100%" role="img" aria-label="أيقونة فلفلونسر والسماح بالإشعارات">' +
      '<rect x="34" y="16" width="52" height="52" rx="14" fill="#E23B2E"/>' +
      '<path d="M60 32c-5.5 0-9 3.6-9 8.6 0 6.4-1.9 8-3 9.2-.5.5-.1 1.4.6 1.4h22.8c.7 0 1.1-.9.6-1.4-1.1-1.2-3-2.8-3-9.2 0-5-3.5-8.6-9-8.6z" fill="#fff"/>' +
      '<path d="M56.6 54.4a3.6 3.6 0 0 0 6.8 0" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>' +
      '<rect x="44" y="74" width="32" height="4" rx="2" fill="#DCE1E6"/>' +
      '<circle cx="86" cy="20" r="9" fill="#2BB673"/>' +
      '<path d="M82 20.2l2.8 2.8L90 17.8" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>';
  }

  function drawBell() {
    return '<svg ' + SVG_NS + ' viewBox="0 0 120 96" width="100%" height="100%" role="img" aria-label="تفعيل الإشعارات">' +
      '<circle cx="60" cy="46" r="34" fill="#FDF0EE"/>' +
      '<path d="M60 26c-8 0-13 5.2-13 12.4 0 9.2-2.8 11.6-4.4 13.3-.7.8-.2 2 .9 2h33c1.1 0 1.6-1.2.9-2-1.6-1.7-4.4-4.1-4.4-13.3C73 31.2 68 26 60 26z" fill="#E23B2E"/>' +
      '<path d="M55.2 58.6a4.8 4.8 0 0 0 9.6 0" fill="none" stroke="#E23B2E" stroke-width="3.2" stroke-linecap="round"/>' +
      '</svg>';
  }

  function styles() {
    return '#simbl-install-modal{position:fixed;inset:0;z-index:100000;background:rgba(12,26,24,.6);display:none;align-items:center;justify-content:center;padding:16px;font-family:inherit}' +
      '#simbl-install-modal.on{display:flex}' +
      '#simbl-install-modal .ig-box{background:#fff;border-radius:22px;max-width:400px;width:100%;max-height:92vh;overflow-y:auto;padding:26px 22px 20px;box-shadow:0 20px 50px rgba(0,0,0,.3);text-align:center;position:relative;direction:rtl}' +
      '#simbl-install-modal .ig-close{position:absolute;top:12px;left:14px;width:30px;height:30px;border:0;border-radius:50%;background:#f1f4f4;color:#5b5b5b;font-size:18px;cursor:pointer;line-height:1}' +
      '#simbl-install-modal .ig-hero{width:96px;height:78px;margin:0 auto 10px}' +
      '#simbl-install-modal h3{margin:0 0 6px;font-size:19px;color:#141414;font-weight:700}' +
      '#simbl-install-modal p{margin:0 0 18px;font-size:14px;color:#5b5b5b;line-height:1.7}' +
      '#simbl-install-modal .ig-steps{display:flex;flex-direction:column;gap:12px;margin:0 0 18px;text-align:right}' +
      '#simbl-install-modal .ig-step{display:flex;align-items:center;gap:12px}' +
      '#simbl-install-modal .ig-art{flex:0 0 78px;height:62px;background:#F7F9FA;border:1px solid #E7ECEF;border-radius:12px;padding:4px;box-sizing:border-box}' +
      '#simbl-install-modal .ig-body{flex:1;min-width:0}' +
      '#simbl-install-modal .ig-n{display:inline-block;font-size:11px;font-weight:800;color:#E23B2E;letter-spacing:.5px;margin-bottom:2px}' +
      '#simbl-install-modal .ig-t{font-size:14px;color:#22282F;line-height:1.6}' +
      '#simbl-install-modal .ig-t b{color:#C0231A;font-weight:700}' +
      '#simbl-install-modal .ig-cta{width:100%;padding:14px;border:0;border-radius:100px;background:#E23B2E;color:#fff;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer}' +
      '#simbl-install-modal .ig-cta:hover{filter:brightness(.97)}' +
      '#simbl-install-modal .ig-skip{display:inline-block;margin-top:12px;font-size:13px;color:#8a8a8a;cursor:pointer;text-decoration:underline}' +
      '#simbl-install-modal .ig-note{margin:12px 0 0;font-size:12px;color:#98a1a8;line-height:1.6}';
  }

  function step(n, art, text) {
    return '<div class="ig-step">' +
      '<div class="ig-art">' + art + '</div>' +
      '<div class="ig-body"><span class="ig-n">' + n + '</span><div class="ig-t">' + text + '</div></div>' +
      '</div>';
  }

  // يبني المحتوى حسب حالة المستخدم — كل حالة تشوف ما يخصّها فقط
  function buildContent() {
    var installed = isStandalone();
    var ios = isIOS();

    if (installed || !ios) {
      // مثبّت أصلًا، أو جهاز لا يشترط التثبيت (أندرويد/كمبيوتر) → خطوة واحدة
      return {
        hero: drawBell(),
        title: 'فعّل الإشعارات',
        lead: 'عشان توصلك عروض الحملات لحظة نزولها، حتى والتطبيق مغلق.',
        steps: '',
        cta: 'تفعيل الإشعارات',
        note: 'راح يطلب منك المتصفح إذنًا — اضغط <b>«السماح»</b>.',
        action: 'enable'
      };
    }

    // آيفون بلا تثبيت: آبل ما تسمح بالإشعارات إلا بعد إضافة الموقع للشاشة الرئيسية
    return {
      hero: '',
      title: 'ثبّت فلفلونسر على جوالك',
      lead: 'ثلاث خطوات، أقل من دقيقة — وبعدها توصلك العروض مباشرة.',
      steps:
        step('١', drawShare(), 'من متصفح <b>Safari</b>، اضغط زر <b>المشاركة</b> في الأسفل') +
        step('٢', drawAddHome(), 'انزل واختر <b>«إضافة إلى الشاشة الرئيسية»</b>') +
        step('٣', drawIcon(), 'افتح <b>فلفلونسر</b> من الأيقونة الجديدة، وفعّل الإشعارات'),
      cta: 'فهمت، بسويها',
      note: 'آبل تشترط هذي الخطوة — الإشعارات ما تشتغل من داخل المتصفح.',
      action: 'close'
    };
  }

  function inject() {
    if (document.getElementById('simbl-install-modal')) return;
    var st = document.createElement('style');
    st.textContent = styles();
    document.head.appendChild(st);

    var c = buildContent();
    var wrap = document.createElement('div');
    wrap.id = 'simbl-install-modal';
    wrap.setAttribute('data-action', c.action);
    wrap.innerHTML =
      '<div class="ig-box">' +
      '<button class="ig-close" aria-label="إغلاق">&times;</button>' +
      (c.hero ? '<div class="ig-hero">' + c.hero + '</div>' : '') +
      '<h3>' + c.title + '</h3>' +
      '<p>' + c.lead + '</p>' +
      (c.steps ? '<div class="ig-steps">' + c.steps + '</div>' : '') +
      '<button class="ig-cta">' + c.cta + '</button>' +
      '<div class="ig-skip">لاحقًا</div>' +
      (c.note ? '<p class="ig-note">' + c.note + '</p>' : '') +
      '</div>';
    document.body.appendChild(wrap);

    wrap.querySelector('.ig-close').addEventListener('click', skip);
    wrap.querySelector('.ig-skip').addEventListener('click', skip);
    wrap.querySelector('.ig-cta').addEventListener('click', function () {
      if (c.action === 'enable') enable(); else skip();
    });
  }

  function show() { inject(); var m = document.getElementById('simbl-install-modal'); if (m) m.classList.add('on'); }
  function skip() {
    try { sessionStorage.setItem(SKIP_KEY, '1'); } catch (e) {}
    var m = document.getElementById('simbl-install-modal'); if (m) m.classList.remove('on');
  }
  function enable() {
    skip();
    try {
      if (hasUser() && typeof manualEnablePush === 'function') { manualEnablePush(); return; }
    } catch (e) { console.warn('install-guide enable:', e); }
  }

  window.simblInstallGuide = { show: show, skip: skip, enable: enable };

  function maybe() {
    var force = location.search.indexOf('pushtest') !== -1;   // وضع المعاينة
    if (force) { show(); return; }
    if (isStandalone() && notifGranted()) return;             // مثبّت ومفعّل → لا شيء
    if (notifDenied() && !isIOS()) return;                    // رفض الإذن من المتصفح → الإلحاح بلا فائدة
    try { if (sessionStorage.getItem(SKIP_KEY) === '1') return; } catch (e) {}
    if (otherModalOpen()) return;
    show();
  }
  function start() { setTimeout(maybe, 2200); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
