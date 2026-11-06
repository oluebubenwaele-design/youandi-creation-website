/* You And I Creation — hero video loader, admin entry and GSAP entrance motion */
(function () {
  'use strict';

  /* ---------- Hero video: poster image shows until the video is playing ---------- */
  function initHeroVideo() {
    var wrap = document.getElementById('heroMedia');
    var video = document.getElementById('heroVideo');
    if (!wrap || !video) return;
    video.muted = true; video.defaultMuted = true; video.playsInline = true;
    var markPlaying = function () { wrap.classList.add('is-playing'); };
    video.addEventListener('playing', markPlaying);
    if (!video.paused && video.readyState > 2) markPlaying();
    var tryPlay = function () {
      if (!video.paused) return;
      var p = video.play();
      if (p && typeof p.catch === 'function') p.catch(function () {});
    };
    video.addEventListener('canplay', tryPlay);
    tryPlay();
    document.addEventListener('visibilitychange', function () { if (!document.hidden) tryPlay(); });
    // iOS low-power mode blocks autoplay: start on first interaction instead.
    ['touchstart', 'click'].forEach(function (evt) {
      window.addEventListener(evt, tryPlay, { once: true, passive: true });
    });
  }

  /* ---------- Admin portal entry (the header switch button was removed) ---------- */
  function initAdminEntry() {
    var open = function () {
      if (/^#admin$/i.test(location.hash) && typeof window.toggleAppMode === 'function') {
        window.toggleAppMode(true);
      }
    };
    open();
    window.addEventListener('hashchange', open);
  }

  /* ---------- GSAP entrance animations ---------- */
  function initMotion() {
    var gsap = window.gsap;
    if (!gsap || !window.ScrollTrigger) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.registerPlugin(window.ScrollTrigger);
    var ST = window.ScrollTrigger;
    var ease = 'power3.out';

    // Header
    gsap.from(['.logo-group', '#customerNav > *', '.nav-actions > *'], {
      y: -14, autoAlpha: 0, duration: .8, ease: ease, stagger: .05, clearProps: 'all'
    });

    // Hero
    var tl = gsap.timeline({ defaults: { ease: ease } });
    tl.from('.hero-line', { yPercent: 110, duration: 1.15, stagger: .12, ease: 'power4.out' }, .15)
      .from('.hero-copy', { y: 18, autoAlpha: 0, duration: .9 }, '-=.75')
      .from('.hero-cta > *', { y: 14, autoAlpha: 0, duration: .7, stagger: .1, clearProps: 'transform' }, '-=.6')
      .from('.hero-media', { clipPath: 'inset(100% 0% 0% 0% round 1.5rem)', duration: 1.5, ease: 'expo.out' }, .1)
      .from('.hero-media img, .hero-media video', { scale: 1.3, duration: 2, ease: 'expo.out' }, .1);

    var HEAD_SEL = 'h1, h2, .tracking-\\[0\\.3em\\]';
    var CARD_SEL = '.glass-card, .product-card, .cat-btn, .proj-btn';

    function headsIn(root) {
      root.querySelectorAll(HEAD_SEL).forEach(function (el) {
        if (el.dataset.anim || el.closest('#tab-home > .hero') || el.closest('.glass-card')) return;
        el.dataset.anim = '1';
        gsap.from(el, {
          y: 28, autoAlpha: 0, duration: 1, ease: ease, clearProps: 'transform',
          scrollTrigger: { trigger: el, start: 'top 88%', once: true }
        });
      });
    }

    function cardsIn(root) {
      var els = Array.prototype.filter.call(root.querySelectorAll(CARD_SEL), function (el) {
        return !el.dataset.anim && el.offsetParent !== null;
      });
      if (!els.length) return;
      els.forEach(function (el) { el.dataset.anim = '1'; });
      gsap.set(els, { autoAlpha: 0, y: 40 });
      ST.batch(els, {
        start: 'top 92%',
        once: true,
        onEnter: function (batch) {
          gsap.to(batch, { autoAlpha: 1, y: 0, duration: .9, ease: ease, stagger: .08, overwrite: true, clearProps: 'transform' });
        }
      });
    }

    function animateScope(root) {
      if (!root || root.offsetParent === null) return;
      headsIn(root);
      cardsIn(root);
      ST.refresh();
    }

    // Initial visible tab
    animateScope(document.querySelector('.tab-content.block') || document.getElementById('tab-home'));

    // Re-run when tabs change
    var origSwitch = window.switchTab;
    if (typeof origSwitch === 'function') {
      window.switchTab = function (id) {
        var r = origSwitch.apply(this, arguments);
        requestAnimationFrame(function () { animateScope(document.getElementById('tab-' + id)); });
        return r;
      };
    }

    // Animate freshly rendered dynamic cards (products, projects)
    ['homeFeaturedProductsGrid', 'productsCatalogGrid', 'projectsGrid'].forEach(function (id) {
      var grid = document.getElementById(id);
      if (!grid) return;
      new MutationObserver(function () {
        clearTimeout(grid._animT);
        grid._animT = setTimeout(function () { cardsIn(grid); ST.refresh(); }, 30);
      }).observe(grid, { childList: true });
    });

    window.addEventListener('load', function () { ST.refresh(); });
  }

  function boot() {
    initHeroVideo();
    initAdminEntry();
    initMotion();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
