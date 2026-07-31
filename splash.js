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
    #simbl-splash .splash-eye {
      width: clamp(120px, 26vw, 190px);
      height: clamp(120px, 26vw, 190px);
      animation: simblSplashZoom 1.3s cubic-bezier(0.7, 0, 0.3, 1) 1.35s forwards;
    }
    #simbl-splash .splash-eye .ln {
      stroke-dasharray: 300;
      stroke-dashoffset: 300;
      animation: simblSplashDraw 0.7s ease forwards;
    }
    #simbl-splash .splash-eye .ln2 { animation-delay: 0.28s; }
    #simbl-splash .splash-eye .eyeShape {
      stroke-dasharray: 120;
      stroke-dashoffset: 120;
      fill: transparent;
      animation: simblSplashDraw 0.45s ease 0.62s forwards, simblEyeFill 0.3s ease 1s forwards;
    }
    #simbl-splash .splash-eye .pupil {
      opacity: 0;
      transform-box: fill-box;
      transform-origin: center;
      animation: simblPupilIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) 0.98s forwards;
    }
    @keyframes simblSplashDraw { to { stroke-dashoffset: 0; } }
    @keyframes simblEyeFill { to { fill: #ffffff; } }
    @keyframes simblPupilIn {
      0% { opacity: 0; transform: scale(0); }
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
      #simbl-splash .splash-eye { animation-duration: 0.5s; }
      #simbl-splash { animation-delay: 0.5s; }
    }
  `;
  (document.head || document.documentElement).appendChild(style);

  // إنشاء عنصر السبلاش
  var splash = document.createElement('div');
  splash.id = 'simbl-splash';
  splash.setAttribute('aria-hidden', 'true');
  splash.innerHTML = `
    <svg class="splash-eye" viewBox="0 0 200 200">
      <g><path d="M112 62 C106 40 90 36 80 22" fill="none" stroke="#2AA36B" stroke-width="12" stroke-linecap="round"/><path d="M96 40 C86 28 88 14 102 12 C104 27 103 37 96 40Z" fill="#2AA36B"/><path d="M89.6 61.2L90.9 63.8L92.0 66.4L92.9 69.0L93.8 71.6L94.5 74.3L95.1 77.0L95.6 79.7L96.0 82.4L96.3 85.1L96.6 87.9L96.7 90.7L96.7 93.6L96.6 96.5L96.5 99.4L96.2 102.4L95.9 105.4L95.5 108.4L95.0 111.5L94.4 114.6L93.8 117.7L93.0 120.8L92.2 124.0L91.4 127.2L90.5 130.4L89.5 133.6L88.5 136.9L87.4 140.2L86.3 143.5L85.2 146.8L84.0 150.1L82.8 153.4L81.7 156.8L80.5 160.2L79.3 163.7L78.2 167.2L77.2 170.8L76.3 174.6L75.6 178.5L75.3 182.9L78.0 190.0L78.0 190.0L85.4 191.6L89.9 190.4L93.9 188.6L97.6 186.4L101.0 184.0L104.4 181.4L107.5 178.6L110.6 175.6L113.5 172.5L116.4 169.3L119.1 165.9L121.7 162.5L124.2 158.9L126.5 155.2L128.8 151.4L130.9 147.6L133.0 143.6L134.8 139.6L136.6 135.5L138.2 131.3L139.7 127.1L141.1 122.7L142.3 118.4L143.3 113.9L144.2 109.4L145.0 104.9L145.5 100.2L145.9 95.6L146.1 90.9L146.1 86.2L145.9 81.5L145.5 76.7L144.9 71.9L144.0 67.1L143.0 62.4L141.7 57.6L140.2 52.8L138.5 48.1L136.5 43.5A25.0 25.0 0 0 0 89.6 61.2Z" fill="#E23B2E"/></g>
    </svg>
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
