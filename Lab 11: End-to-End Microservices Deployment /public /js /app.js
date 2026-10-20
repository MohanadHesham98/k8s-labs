/* ============================================
   app.js — Landing Page Logic
   Small Steps Mental Health Booking
   ============================================ */

(function () {
  'use strict';

  // --- Nav scroll effect ---
  const nav = document.getElementById('mainNav');
  if (nav) {
    window.addEventListener('scroll', function () {
      if (window.scrollY > 20) {
        nav.classList.add('scrolled');
      } else {
        nav.classList.remove('scrolled');
      }
    });
  }

  // --- Mobile nav toggle ---
  const navToggle = document.getElementById('navToggle');
  if (navToggle) {
    navToggle.addEventListener('click', function () {
      var links = document.querySelector('.nav__links');
      links.classList.toggle('open');
    });
  }

  // --- Smooth scroll for nav links ---
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        var links = document.querySelector('.nav__links');
        if (links) links.classList.remove('open');
      }
    });
  });

  // --- Scroll reveal ---
  var revealElements = document.querySelectorAll('.tip-card, .about__mini-card, .footer__col');
  revealElements.forEach(function (el) {
    el.classList.add('reveal');
  });

  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    revealElements.forEach(function (el) {
      observer.observe(el);
    });
  } else {
    revealElements.forEach(function (el) {
      el.classList.add('visible');
    });
  }

  // --- Daily Affirmations ---
  var affirmations = [
    'You are enough, exactly as you are.',
    'Every small step forward is still progress.',
    'Your feelings are valid, and this moment will pass.',
    'You have survived 100% of your hardest days.',
    'Asking for help is a sign of strength, not weakness.',
    'You are allowed to take up space and be heard.',
    'Healing is not linear, and you are right on time.',
    'You deserve the same kindness you give to others.',
    'Today is a new opportunity to begin again.',
    'Your mental health is just as important as your physical health.',
    'You are not your thoughts; you are the observer of them.',
    'Rest is productive. You cannot pour from an empty cup.',
    'You have the courage to face whatever comes your way.',
    'Small steps still move you forward.',
    'You are worthy of love, care, and understanding.',
    'It is okay to not be okay. What matters is that you try.',
    'Your story is not over yet.',
    'You are stronger than the challenges you face.',
    'Peace begins with a single breath.',
    'You are doing better than you think you are.'
  ];

  var affirmationText = document.getElementById('affirmationText');
  var affirmationBtn = document.getElementById('newAffirmationBtn');

  function getDailyAffirmation() {
    var dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24)) % affirmations.length;
    return affirmations[dayIndex];
  }

  function showAffirmation(text) {
    if (!affirmationText) return;
    affirmationText.classList.add('fading');
    setTimeout(function () {
      affirmationText.textContent = text;
      affirmationText.classList.remove('fading');
    }, 300);
  }

  if (affirmationText) {
    affirmationText.textContent = getDailyAffirmation();
  }

  if (affirmationBtn) {
    affirmationBtn.addEventListener('click', function () {
      var current = affirmationText.textContent;
      var next;
      do {
        next = affirmations[Math.floor(Math.random() * affirmations.length)];
      } while (next === current && affirmations.length > 1);
      showAffirmation(next);
    });
  }

  // --- Animated stat counters ---
  var statNums = document.querySelectorAll('.hero__stat-num[data-count]');
  var statsAnimated = false;

  function animateStats() {
    if (statsAnimated) return;
    statsAnimated = true;
    statNums.forEach(function (el) {
      var target = parseInt(el.dataset.count, 10);
      if (isNaN(target)) return;
      var duration = 1500;
      var start = 0;
      var startTime = null;

      function step(timestamp) {
        if (!startTime) startTime = timestamp;
        var progress = Math.min((timestamp - startTime) / duration, 1);
        var value = Math.floor(progress * target);
        el.textContent = value + (el.textContent.includes('+') ? '+' : el.textContent.includes('%') ? '%' : '');
        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          el.textContent = target + (el.textContent.includes('+') ? '+' : el.textContent.includes('%') ? '%' : '');
        }
      }
      requestAnimationFrame(step);
    });
  }

  if (statNums.length > 0 && 'IntersectionObserver' in window) {
    var statObserver = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) {
        animateStats();
        statObserver.disconnect();
      }
    }, { threshold: 0.5 });
    statObserver.observe(statNums[0]);
  } else {
    animateStats();
  }

})();
