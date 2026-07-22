const header = document.querySelector('[data-header]');
const toggle = document.querySelector('[data-nav-toggle]');
const nav = document.querySelector('[data-nav]');
const form = document.querySelector('[data-booking-form]');
const statusEl = document.querySelector('[data-form-status]');

window.addEventListener('scroll', () => {
  header.style.background = window.scrollY > 30
    ? 'rgba(5,5,5,.92)'
    : 'linear-gradient(180deg,rgba(5,5,5,.92),rgba(5,5,5,.58),transparent)';
});

toggle?.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  toggle.setAttribute('aria-expanded', String(open));
});

nav?.addEventListener('click', event => {
  if (event.target.tagName === 'A') {
    nav.classList.remove('open');
    toggle?.setAttribute('aria-expanded', 'false');
  }
});

form?.addEventListener('submit', async event => {
  event.preventDefault();
  statusEl.textContent = 'Sending your request…';
  const button = form.querySelector('button');
  button.disabled = true;

  const payload = Object.fromEntries(new FormData(form).entries());
  payload.source = 'resetmcr.com';
  payload.createdAt = new Date().toISOString();

  try {
    const response = await fetch('/api/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Request failed');
    statusEl.textContent = result.emailConfigured
      ? 'Done — your request has been sent. We’ll be in touch shortly.'
      : 'Done — you’re on the early access list. Email automation is ready for production keys.';
    form.reset();
  } catch (error) {
    statusEl.textContent = 'Sorry, that did not send. Email hello@resetmcr.com or try again in a minute.';
  } finally {
    button.disabled = false;
  }
});
