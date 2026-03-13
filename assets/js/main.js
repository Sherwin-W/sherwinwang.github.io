(function () {
  'use strict';

  // ── Mobile nav toggle ────────────────────────────────────────────────────
  var toggle = document.getElementById('nav-toggle');
  var links  = document.getElementById('nav-links');

  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var isOpen = links.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });

    // Close menu when a link is clicked
    links.querySelectorAll('.nav-link').forEach(function (link) {
      link.addEventListener('click', function () {
        links.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // ── Active nav link ───────────────────────────────────────────────────────
  var currentPath = window.location.pathname;
  document.querySelectorAll('.nav-link').forEach(function (link) {
    try {
      var linkPath = new URL(link.href).pathname;
      // Normalize trailing slash for root
      var normalizedCurrent = currentPath === '/' ? '/' : currentPath.replace(/\/$/, '');
      var normalizedLink    = linkPath   === '/' ? '/' : linkPath.replace(/\/$/, '');
      if (normalizedLink === normalizedCurrent) {
        link.classList.add('nav-link--active');
      }
    } catch (e) {
      // ignore malformed hrefs
    }
  });
}());
