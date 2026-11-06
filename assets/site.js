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
    // Only play while the hero is on screen (and the home tab is showing).
    var inView = true;
    var section = document.getElementById('heroSection');
    var sync = function () {
      var show = inView && section && section.offsetParent !== null;
      wrap.classList.toggle('is-offscreen', !show);
      if (show && !document.hidden) tryPlay();
      else if (!video.paused) video.pause();
    };
    if (section && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting; sync();
      }, { threshold: 0.01 }).observe(section);
    }
    // Scroll fallback (IntersectionObserver can be delayed in background tabs).
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking || !section) return;
      ticking = true;
      setTimeout(function () {
        ticking = false;
        var r = section.getBoundingClientRect();
        var vis = r.bottom > 0 && r.top < window.innerHeight;
        if (vis !== inView) { inView = vis; sync(); }
      }, 120);
    }, { passive: true });
    video.addEventListener('canplay', sync);
    sync();
    document.addEventListener('visibilitychange', sync);
    window.__heroVideoSync = sync;
    // iOS low-power mode blocks autoplay: start on first interaction instead.
    ['touchstart', 'click'].forEach(function (evt) {
      window.addEventListener(evt, function () { if (inView) tryPlay(); }, { once: true, passive: true });
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
      .from('.hero-media img, .hero-media video', { scale: 1.15, duration: 2.4, ease: 'expo.out' }, 0)
      .from('.hero-scrim', { autoAlpha: 0, duration: 1.2 }, 0);

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

    // One shared IntersectionObserver for card reveals: no per-card ScrollTriggers,
    // no layout-thrashing refreshes, and nothing left behind when grids re-render.
    var revealQueue = [];
    var flushScheduled = false;
    function flushReveals() {
      flushScheduled = false;
      if (!revealQueue.length) return;
      var batch = revealQueue.splice(0, revealQueue.length);
      gsap.to(batch, { autoAlpha: 1, y: 0, duration: .8, ease: ease, stagger: { each: .07, amount: Math.min(.5, batch.length * .07) }, overwrite: true, clearProps: 'transform,opacity,visibility' });
    }
    var cardIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        cardIO.unobserve(e.target);
        revealQueue.push(e.target);
      });
      if (revealQueue.length && !flushScheduled) { flushScheduled = true; requestAnimationFrame(flushReveals); }
    }, { rootMargin: '0px 0px -6% 0px' });

    function cardsIn(root) {
      var els = Array.prototype.filter.call(root.querySelectorAll(CARD_SEL), function (el) {
        return !el.dataset.anim && el.offsetParent !== null;
      });
      if (!els.length) return;
      els.forEach(function (el) { el.dataset.anim = '1'; });
      gsap.set(els, { autoAlpha: 0, y: 32 });
      els.forEach(function (el) { cardIO.observe(el); });
    }

    var refreshT;
    function refreshSoon() { clearTimeout(refreshT); refreshT = setTimeout(function () { ST.refresh(); }, 200); }

    function animateScope(root) {
      if (!root || root.offsetParent === null) return;
      headsIn(root);
      cardsIn(root);
      refreshSoon();
    }

    // Initial visible tab
    animateScope(document.querySelector('.tab-content.block') || document.getElementById('tab-home'));

    // Re-run when tabs change
    var origSwitch = window.switchTab;
    if (typeof origSwitch === 'function') {
      window.switchTab = function (id) {
        var r = origSwitch.apply(this, arguments);
        requestAnimationFrame(function () { animateScope(document.getElementById('tab-' + id)); if (window.__heroVideoSync) window.__heroVideoSync(); });
        return r;
      };
    }

    // Animate freshly rendered dynamic cards (products, projects)
    ['homeFeaturedProductsGrid', 'productsCatalogGrid', 'projectsGrid'].forEach(function (id) {
      var grid = document.getElementById(id);
      if (!grid) return;
      new MutationObserver(function (records) {
        records.forEach(function (r) {
          r.removedNodes.forEach(function (n) { if (n.nodeType === 1) cardIO.unobserve(n); });
        });
        clearTimeout(grid._animT);
        grid._animT = setTimeout(function () { cardsIn(grid); }, 30);
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
