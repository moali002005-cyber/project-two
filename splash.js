// Splash Screen المشترك لكل صفحات Flfluencer
// يطلع شعار العين أول ما المستخدم يفتح أي صفحة لمدة ~3 ثواني ثم يختفي بـ زووم
// ملاحظة: هذا الملف يُستدعى داخل <head> قبل تحميل <body>، فنركّب السبلاش فورًا
// على <html> (documentElement) عشان يغطّي الشاشة من أول لحظة قبل ظهور أي محتوى.

(function() {
  // لا تظهر سبلاش لو المستخدم انتقل بين الصفحات بنفس الجلسة (تجربة أنعم)
  // فقط لما يدخل من برّا (تبويب جديد، إعادة تحميل، اختصار التطبيق)
  if (sessionStorage.getItem('simbl_splash_shown')) return;
  sessionStorage.setItem('simbl_splash_shown', '1');

  // إنشاء الـ CSS
  var style = document.createElement('style');
  style.textContent = `
    /* إخفاء المحتوى تحت السبلاش حتى لا يبين قبل الشعار */
    html.simbl-splash-active, html.simbl-splash-active body { overflow: hidden !important; }
    #simbl-splash {
      position: fixed;
      inset: 0;
      z-index: 99999;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: simblSplashOut 0.4s ease 2.65s forwards;
    }
    #simbl-splash .splash-lock {
      font-family: 'Outfit', system-ui, sans-serif;
      font-weight: 700;
      font-size: clamp(40px, 8vw, 60px);
      color: #16181F;
      letter-spacing: -0.01em;
      direction: ltr;
      animation: simblLockIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.15s both,
                 simblSplashZoom 1.1s cubic-bezier(0.7, 0, 0.3, 1) 1.5s forwards;
    }
    @keyframes simblLockIn {
      0% { opacity: 0; transform: scale(0.86); }
      100% { opacity: 1; transform: scale(1); }
    }
    @keyframes simblSplashZoom {
      0% { opacity: 1; transform: scale(1); }
      35% { opacity: 1; transform: scale(1); }
      100% { opacity: 0; transform: scale(11); }
    }
    @keyframes simblSplashOut {
      to { opacity: 0; visibility: hidden; }
    }
    @media (prefers-reduced-motion: reduce) {
      #simbl-splash .splash-lock { animation: none; }
      #simbl-splash { animation-delay: 0.5s; }
    }
  `;
  (document.head || document.documentElement).appendChild(style);

  // إنشاء عنصر السبلاش
  var splash = document.createElement('div');
  splash.id = 'simbl-splash';
  splash.setAttribute('aria-hidden', 'true');
  splash.innerHTML = `
    <span class="splash-lock">F<svg class="chili-l" viewBox="74 0 52 210" style="height:1.16em;vertical-align:-0.19em;margin:0 -0.02em;display:inline-block"><path d="M100 56 C96 34 86 30 78 18" fill="none" stroke="#2AA36B" stroke-width="11" stroke-linecap="round"/><path d="M88 34 C78 22 80 8 94 8 C96 22 95 31 88 34Z" fill="#2AA36B"/><path d="M88.1 45.5L88.5 48.9L88.9 52.4L89.2 55.9L89.5 59.3L89.8 62.8L90.0 66.3L90.2 69.7L90.3 73.2L90.4 76.7L90.5 80.2L90.6 83.6L90.7 87.1L90.7 90.6L90.7 94.1L90.7 97.6L90.6 101.1L90.6 104.6L90.5 108.1L90.4 111.5L90.4 115.0L90.3 118.5L90.1 122.0L90.0 125.6L89.9 129.1L89.8 132.6L89.7 136.1L89.6 139.6L89.5 143.1L89.4 146.6L89.3 150.2L89.3 153.7L89.3 157.2L89.3 160.7L89.4 164.3L89.5 167.8L89.7 171.4L90.0 174.9L90.5 178.5L91.3 182.1L94.0 186.0L94.0 186.0L97.6 183.0L99.3 179.7L100.7 176.3L101.9 172.9L103.0 169.5L104.0 166.1L104.9 162.6L105.7 159.1L106.5 155.7L107.3 152.2L108.0 148.6L108.7 145.1L109.3 141.6L109.9 138.0L110.4 134.5L110.9 130.9L111.4 127.3L111.9 123.7L112.3 120.1L112.6 116.5L113.0 112.8L113.3 109.2L113.5 105.5L113.8 101.9L114.0 98.2L114.1 94.5L114.2 90.9L114.3 87.2L114.3 83.5L114.3 79.8L114.3 76.1L114.2 72.4L114.1 68.6L113.9 64.9L113.7 61.2L113.4 57.5L113.1 53.7L112.8 50.0L112.4 46.3A12.0 12.0 0 0 0 88.1 45.5Z" fill="#E23B2E"/></svg>fluencer</span>
  `;

  // نركّب السبلاش فورًا على <html> (موجود دائمًا)، بدون انتظار <body>
  document.documentElement.classList.add('simbl-splash-active');
  document.documentElement.appendChild(splash);

  // إزالة السبلاش بعد انتهاء الأنيميشن
  function removeSplash() {
    document.documentElement.classList.remove('simbl-splash-active');
    if (splash.parentNode) splash.style.display = 'none';
  }
  setTimeout(removeSplash, 3050);

  // احتياط: لو لأي سبب تعطّل المؤقّت، نشيل القفل عند تحميل الصفحة بفترة كافية
  window.addEventListener('load', function() {
    setTimeout(function() {
      if (document.documentElement.classList.contains('simbl-splash-active')) {
        removeSplash();
      }
    }, 3200);
  });
})();
