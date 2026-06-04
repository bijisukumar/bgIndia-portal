/**
 * LVG Landing Page Tracking Snippet
 * Add this to www.luxuryvillasofguruvayur.com before </body>
 * Tracks campaign clicks and inquiry form conversions
 */
(function () {
  const API = 'https://manage.luxuryvillasofguruvayur.com/api';
  const SESSION_KEY = 'lvg_ref';

  // 1. Extract ?ref= token from URL
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');

  if (ref) {
    sessionStorage.setItem(SESSION_KEY, ref);
    // Fire click event
    fetch(API + '/trackCampaignClick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: ref, referrer: document.referrer }),
    }).catch(() => {});
    // Clean URL without reloading
    const clean = window.location.pathname + window.location.hash;
    window.history.replaceState({}, '', clean);
  }

  // 2. Track inquiry form submission
  // Adjust selector to match your actual inquiry form
  document.addEventListener('submit', function (e) {
    const form = e.target;
    const isInquiry = form.matches('[data-inquiry-form], #inquiry-form, .inquiry-form, #contact-form');
    if (!isInquiry) return;
    const token = sessionStorage.getItem(SESSION_KEY);
    if (!token) return;
    fetch(API + '/trackCampaignAction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, eventType: 'inquiry' }),
    }).catch(() => {});
  });

  // 3. Track WhatsApp CTA clicks (common on villa sites)
  document.addEventListener('click', function (e) {
    const el = e.target.closest('a[href*="wa.me"], a[href*="whatsapp"], [data-book-now]');
    if (!el) return;
    const token = sessionStorage.getItem(SESSION_KEY);
    if (!token) return;
    fetch(API + '/trackCampaignAction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, eventType: 'inquiry' }),
    }).catch(() => {});
  });
})();
