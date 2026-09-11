// RESET MCR — script.js
// Handles nav, header, and booking flow

const header = document.querySelector('[data-header]');
const toggle = document.querySelector('[data-nav-toggle]');
const nav = document.querySelector('[data-nav]');

// ── Header scroll ──────────────────────────────────────────────────────────
window.addEventListener('scroll', () => {
  header.style.background = window.scrollY > 30
    ? 'rgba(5,5,5,.92)'
    : 'linear-gradient(180deg,rgba(5,5,5,.92),rgba(5,5,5,.58),transparent)';
});

// ── Mobile nav ──────────────────────────────────────────────────────────────
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

// ── Booking State ────────────────────────────────────────────────────────────
const state = {
  step: 1,
  service_id: null,
  service_name: null,
  service_desc: null,
  staff_id: null,         // 'any' or UUID
  staff_name: null,
  date: null,
  time: null,
  duration_mins: null,
  customer_name: null,
  customer_mobile: null,
  customer_email: null,
  is_recurring: false,
  recurring_interval: null
};

// ── Static data (fetched or hardcoded for resilience) ────────────────────────
const SERVICES = [
  { id: 'svc-1', name: 'Haircut', desc: 'Skin fades, classic cuts, sharp finishing' },
  { id: 'svc-2', name: 'Hair + Beard', desc: 'Cut and beard shape or fade' },
  { id: 'svc-3', name: 'Beard Only', desc: 'Shape and style your beard' },
  { id: 'svc-4', name: 'Kids Cut', desc: 'Under 12s welcome' },
  { id: 'svc-5', name: 'Cut-Throat Shave', desc: 'Wet shave with cut-throat razor' },
  { id: 'svc-6', name: 'Haircut + Cut-Throat', desc: 'The full reset — cut and wet shave' }
];

const STAFF = [
  { id: 'staff-jack', name: 'Jack', role: 'Senior Barber', bio: 'Founder of Reset MCR — precision barber.' },
  { id: 'staff-jaden', name: 'Jaden', role: 'Apprentice', bio: 'Rising talent at Reset MCR.' }
];

// ── DOM refs ─────────────────────────────────────────────────────────────────
const bookingSection = document.getElementById('bookingSection');
const bookingNav = document.getElementById('bookingNav');
const bookingActions = document.getElementById('bookingActions');
const bookingBack = document.getElementById('bookingBack');

// Step elements
const stepEls = {
  1: document.getElementById('step1'),
  2: document.getElementById('step2'),
  3: document.getElementById('step3'),
  4: document.getElementById('step4'),
  5: document.getElementById('step5'),
  confirm: document.getElementById('stepConfirm'),
  cancel: document.getElementById('stepCancel')
};

// ── Check for cancel/reschedule query params ─────────────────────────────────
const urlParams = new URLSearchParams(window.location.search);
const cancelBookingId = urlParams.get('cancel');
const cancelEmail = urlParams.get('email');

if (cancelBookingId && cancelEmail) {
  showCancelView(cancelBookingId, cancelEmail);
} else {
  initBookingUI();
}

// ── Init booking UI ──────────────────────────────────────────────────────────
function initBookingUI() {
  renderServicePick();
  renderStaffPick();
  setupDateTimePick();
  setupDetailsForm();
  setupConfirmBtn();
  updateNavButtons();
  updateStepIndicators();
}

function showStep(n) {
  Object.values(stepEls).forEach(el => { if (el) el.style.display = 'none'; });
  const el = stepEls[n] || stepEls[1];
  if (el) el.style.display = 'block';
  state.step = n;
  updateStepIndicators();
  updateNavButtons();
  window.scrollTo({ top: document.getElementById('book').offsetTop - 90, behavior: 'smooth' });
}

function updateStepIndicators() {
  document.querySelectorAll('.booking-step-btn').forEach(btn => {
    const step = parseInt(btn.dataset.step);
    const isActive = step === state.step;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-current', isActive ? 'step' : 'false');
  });
}

function updateNavButtons() {
  bookingBack.style.display = state.step > 1 && state.step !== 'confirm' && state.step !== 'cancel' ? 'inline-flex' : 'none';
}

bookingBack?.addEventListener('click', () => {
  if (state.step > 1) showStep(state.step - 1);
});

// ── Step 1: Service ─────────────────────────────────────────────────────────
function renderServicePick() {
  const grid = document.getElementById('servicePickGrid');
  if (!grid) return;
  grid.innerHTML = SERVICES.map(svc => `
    <button class="service-pick-card${state.service_id === svc.id ? ' selected' : ''}" data-service-id="${svc.id}" type="button">
      <h4>${svc.name}</h4>
      <p>${svc.desc}</p>
    </button>
  `).join('');

  grid.querySelectorAll('.service-pick-card').forEach(btn => {
    btn.addEventListener('click', () => {
      const svc = SERVICES.find(s => s.id === btn.dataset.serviceId);
      state.service_id = svc.id;
      state.service_name = svc.name;
      state.service_desc = svc.desc;
      // Reset downstream
      state.staff_id = null;
      state.date = null;
      state.time = null;
      renderServicePick();
      showStep(2);
    });
  });
}

// ── Step 2: Staff ────────────────────────────────────────────────────────────
function renderStaffPick() {
  const grid = document.getElementById('staffPickGrid');
  if (!grid) return;

  const staffCards = STAFF.map(s => `
    <label class="staff-pick-card${state.staff_id === s.id ? ' selected' : ''}">
      <input type="radio" name="staff_pick" value="${s.id}" ${state.staff_id === s.id ? 'checked' : ''} />
      <div class="staff-photo-placeholder">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(184,155,117,0.45)" stroke-width="1.5">
          <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
        </svg>
        <span>${s.name}</span>
      </div>
      <h4>${s.name}</h4>
      <p>${s.role}</p>
    </label>
  `).join('');

  const anyCard = `
    <label class="staff-pick-any${state.staff_id === 'any' ? ' selected' : ''}">
      <input type="radio" name="staff_pick" value="any" ${state.staff_id === 'any' ? 'checked' : ''} />
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(184,155,117,0.7)" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
      </svg>
      <span>Any Available</span>
      <p style="color:var(--muted);font-size:13px;margin:0;">First available slot</p>
    </label>
  `;

  grid.innerHTML = staffCards + anyCard;

  grid.querySelectorAll('input[name="staff_pick"]').forEach(input => {
    input.addEventListener('change', () => {
      state.staff_id = input.value;
      const s = STAFF.find(x => x.id === input.value);
      state.staff_name = s ? s.name : 'Any Available';
      renderStaffPick();
      showStep(3);
    });
  });
}

// ── Step 3: Date & Time ─────────────────────────────────────────────────────
function setupDateTimePick() {
  const dateInput = document.getElementById('dateInput');
  const slotsGrid = document.getElementById('slotsGrid');
  const slotsHint = document.getElementById('slotsHint');

  if (!dateInput) return;

  // Set min date to today
  const today = new Date().toISOString().split('T')[0];
  dateInput.min = today;
  // Set max date to 4 weeks from now
  const maxDate = new Date(Date.now() + 28 * 86400000).toISOString().split('T')[0];
  dateInput.max = maxDate;

  dateInput.addEventListener('change', async () => {
    state.date = dateInput.value;
    state.time = null;
    await loadSlots(dateInput.value, slotsGrid, slotsHint);
  });
}

async function loadSlots(date, slotsGrid, slotsHint) {
  slotsGrid.style.display = 'none';
  slotsHint.textContent = 'Loading available times…';
  slotsHint.style.display = 'block';

  try {
    const params = new URLSearchParams({ date, service_id: state.service_id });
    if (state.staff_id !== 'any') {
      params.set('staff_id', state.staff_id);
    } else {
      params.set('staff_id', 'any');
    }

    const res = await fetch(`/api/availability?${params}`);
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Failed to load slots');

    const slots = data.slots || [];
    slotsHint.style.display = slots.length === 0 ? 'block' : 'none';
    slotsHint.textContent = slots.length === 0
      ? 'No slots available on this date. Try another day.'
      : `${slots.length} slot${slots.length !== 1 ? 's' : ''} available`;

    if (slots.length === 0) {
      slotsGrid.style.display = 'none';
      return;
    }

    slotsGrid.innerHTML = slots.map(slot => `
      <button class="slot-btn" data-time="${slot.time}" data-staff="${slot.staff_id}" data-duration="${slot.duration_mins}" type="button">
        ${slot.time}
      </button>
    `).join('');

    slotsGrid.style.display = 'grid';

    slotsGrid.querySelectorAll('.slot-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        slotsGrid.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        state.time = btn.dataset.time;
        state.duration_mins = parseInt(btn.dataset.duration);
        // Get staff name from slot
        const staffMember = STAFF.find(s => s.id === btn.dataset.staff);
        state.staff_name = staffMember ? staffMember.name : 'Any Available';
        if (state.staff_id === 'any') {
          state.staff_id = btn.dataset.staff;
        }
        showStep(4);
      });
    });
  } catch (err) {
    slotsHint.textContent = 'Could not load times. Please try again.';
    console.error(err);
  }
}

// ── Step 4: Details ─────────────────────────────────────────────────────────
function setupDetailsForm() {
  const form = document.getElementById('detailsForm');
  const recurringWrap = document.getElementById('recurringWrap');
  const recurringQ = document.getElementById('recurringQ');
  const intervalOptions = document.getElementById('intervalOptions');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    state.customer_name = formData.get('customer_name');
    state.customer_mobile = formData.get('customer_mobile');
    state.customer_email = formData.get('customer_email');

    // Check for blocked customer before proceeding
    try {
      const checkRes = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: state.service_id,
          staff_id: state.staff_id,
          start_datetime: `${state.date}T${state.time}:00`,
          customer_name: state.customer_name,
          customer_email: state.customer_email,
          customer_mobile: state.customer_mobile,
          validate_only: true
        })
      });
      const checkData = await checkRes.json();
      if (checkRes.status === 403) {
        alert(checkData.error || 'Online booking unavailable — please contact Reset MCR directly.');
        return;
      }
      if (checkRes.status === 409) {
        alert(checkData.error || 'This slot is already booked. Please go back and choose another time.');
        return;
      }
    } catch (_) {}

    // Recurring
    const recurringRadio = form.querySelector('input[name="recurring_interval"]:checked');
    state.is_recurring = !!recurringRadio;
    state.recurring_interval = recurringRadio?.value || null;

    renderSummary();
    showStep(5);
  });
}

// ── Step 5: Confirm ─────────────────────────────────────────────────────────
function renderSummary() {
  const summary = document.getElementById('bookingSummary');
  if (!summary) return;

  const dateFormatted = new Date(state.date + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  summary.innerHTML = `
    <table>
      <tr><td>Service</td><td>${state.service_name}</td></tr>
      <tr><td>Barber</td><td>${state.staff_name}</td></tr>
      <tr><td>Date</td><td>${dateFormatted}</td></tr>
      <tr><td>Time</td><td>${state.time}</td></tr>
      <tr><td>Duration</td><td>${state.duration_mins} min</td></tr>
      ${state.is_recurring ? `<tr><td>Repeat</td><td>${state.recurring_interval.charAt(0).toUpperCase() + state.recurring_interval.slice(1)}</td></tr>` : ''}
      <tr><td>Name</td><td>${state.customer_name}</td></tr>
      <tr><td>Email</td><td>${state.customer_email}</td></tr>
    </table>
  `;
}

function setupConfirmBtn() {
  const btn = document.getElementById('confirmBookingBtn');
  const status = document.getElementById('bookingStatus');

  btn?.addEventListener('click', async () => {
    btn.disabled = true;
    status.textContent = 'Confirming your booking…';

    try {
      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: state.service_id,
          staff_id: state.staff_id,
          start_datetime: `${state.date}T${state.time}:00`,
          customer_name: state.customer_name,
          customer_email: state.customer_email,
          customer_mobile: state.customer_mobile,
          is_recurring: state.is_recurring,
          recurring_interval: state.recurring_interval
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Booking failed');
      }

      showConfirmation(data.booking_id);
    } catch (err) {
      status.textContent = err.message || 'Something went wrong. Please try again or email hello@resetmcr.com';
      btn.disabled = false;
    }
  });
}

function showConfirmation(bookingId) {
  Object.values(stepEls).forEach(el => { if (el) el.style.display = 'none'; });
  stepEls.confirm.style.display = 'block';
  state.step = 'confirm';
  updateStepIndicators();
  bookingActions.style.display = 'none';
  bookingNav.style.display = 'none';

  document.getElementById('confirmEmail').textContent = state.customer_email;

  const dateFormatted = new Date(state.date + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  document.getElementById('confirmDetails').innerHTML = `
    <table>
      <tr><td>Service</td><td>${state.service_name}</td></tr>
      <tr><td>Barber</td><td>${state.staff_name}</td></tr>
      <tr><td>Date</td><td>${dateFormatted}</td></tr>
      <tr><td>Time</td><td>${state.time}</td></tr>
    </table>
  `;

  const cancelLink = `https://resetmcr.com/?cancel=${bookingId}&email=${encodeURIComponent(state.customer_email)}`;
  document.getElementById('confirmChangeLink').href = cancelLink;
}

// ── Cancel / Reschedule View ────────────────────────────────────────────────
async function showCancelView(bookingId, email) {
  Object.values(stepEls).forEach(el => { if (el) el.style.display = 'none'; });
  stepEls.cancel.style.display = 'block';
  bookingNav.style.display = 'none';
  bookingActions.style.display = 'none';

  const cancelView = document.getElementById('cancelView');
  cancelView.innerHTML = '<p style="color:var(--muted);">Loading booking details…</p>';

  try {
    // Fetch diary for this booking
    const res = await fetch(`/api/diary?date=2000-01-01&view=daily`);
    const data = await res.json();
    const booking = (data.bookings || []).find(b => b.id === bookingId && b.customer_email === email);

    if (!booking) {
      cancelView.innerHTML = '<p style="color:var(--red);">Booking not found. Check your link or email hello@resetmcr.com.</p>';
      return;
    }

    const apptTime = new Date(booking.start).getTime();
    const now = Date.now();
    const minsUntil = Math.round((apptTime - now) / 60000);
    const isTooLate = minsUntil <= 30;

    const dateStr = new Date(booking.start).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    const timeStr = new Date(booking.start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

    if (isTooLate) {
      cancelView.innerHTML = `
        <div class="cancel-closed">
          <p style="color:var(--gold2);font-weight:700;margin:0 0 8px;">Online changes closed</p>
          <p style="margin:0;">Your appointment is in less than 30 minutes. Please call us to make changes.</p>
        </div>
      `;
      return;
    }

    cancelView.innerHTML = `
      <div class="cancel-booking-card">
        <h3>Your appointment</h3>
        <table>
          <tr><td>Service</td><td>${booking.service_name}</td></tr>
          <tr><td>Barber</td><td>${booking.staff_name}</td></tr>
          <tr><td>Date</td><td>${dateStr}</td></tr>
          <tr><td>Time</td><td>${timeStr}</td></tr>
        </table>
      </div>
      <div class="cancel-actions">
        <button class="btn btn-primary" id="cancelBtn" type="button">Cancel booking</button>
        <button class="btn btn-ghost" id="rescheduleBtn" type="button">Reschedule</button>
      </div>
      <div id="cancelStatus" style="margin-top:16px;text-align:center;color:var(--gold2);font-size:14px;"></div>
    `;

    document.getElementById('cancelBtn')?.addEventListener('click', async () => {
      const statusEl = document.getElementById('cancelStatus');
      if (!confirm('Are you sure you want to cancel this booking?')) return;
      statusEl.textContent = 'Cancelling…';
      try {
        const r = await fetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ booking_id: bookingId, status: 'cancelled' })
        });
        if (r.ok) {
          statusEl.textContent = 'Booking cancelled. A confirmation has been sent to your email.';
          document.getElementById('cancelBtn').style.display = 'none';
          document.getElementById('rescheduleBtn').style.display = 'none';
        } else {
          statusEl.textContent = 'Cancellation failed. Email hello@resetmcr.com';
        }
      } catch (_) {
        statusEl.textContent = 'Error. Please call us.';
      }
    });

    document.getElementById('rescheduleBtn')?.addEventListener('click', () => {
      // Pre-fill state and go to step 3
      state.service_id = booking.service_id;
      state.service_name = booking.service_name;
      state.staff_id = booking.staff_id;
      state.staff_name = booking.staff_name;
      state.customer_email = email;
      // Navigate to booking section step 3
      window.location.hash = '#book';
      window.location.reload(); // simple reload to reset booking flow
    });
  } catch (err) {
    cancelView.innerHTML = '<p style="color:var(--red);">Could not load booking. Email hello@resetmcr.com</p>';
  }
}
