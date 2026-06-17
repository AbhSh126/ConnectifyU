/* ============================================================
   ConnectifyU — Organiser JS  (organiser.js)

   Handles: organiser-dashboard, create-event,
            manage-event, dispatch

   MOCK = true  → uses local fixture data, no backend calls.
   Flip to false once the backend is live.
   ============================================================ */


   const MOCK = true;

/* ── Shared helpers ──────────────────────────────────────── */

function showToast(msg, type) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'cc-toast show' + (type ? ' ' + type : '');
  clearTimeout(t._tid);
  t._tid = setTimeout(() => { t.className = 'cc-toast'; }, 3200);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function setBtnLoading(id, loading, originalLabel) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.disabled = loading;
  if (loading) {
    btn.classList.add('loading');
    if (originalLabel) btn.dataset.origLabel = originalLabel;
  } else {
    btn.classList.remove('loading');
    const lbl = btn.dataset.origLabel || originalLabel;
    if (lbl) btn.textContent = lbl;
  }
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function authHeaders() {
  const token = (typeof auth !== 'undefined') ? auth.getToken() : null;
  return token ? { 'Authorization': 'Bearer ' + token } : {};
}

/* ── Mock fixtures ───────────────────────────────────────── */

const MOCK_EVENTS = [
  { id:'e1', title:'AI & Machine Learning Workshop', date:'18 June 2026',
    venue:'Auditorium A',  capacity:120, registered:91,  checkedIn:47, status:'live' },
  { id:'e2', title:'Cloud Native Bootcamp',          date:'25 June 2026',
    venue:'Lab Block 3',   capacity:80,  registered:54,  checkedIn:0,  status:'upcoming' },
  { id:'e3', title:'BuildFest Hackathon',            date:'04 May 2026',
    venue:'Main Hall',     capacity:200, registered:200, checkedIn:188, status:'ended' },
  { id:'e4', title:'Cyber Security Talk',            date:'02 July 2026',
    venue:'Seminar Hall',  capacity:90,  registered:21,  checkedIn:0,  status:'upcoming' },
  { id:'e5', title:'UX Design Sprint',               date:'10 Aug 2026',
    venue:'Design Lab',    capacity:40,  registered:0,   checkedIn:0,  status:'draft' },
];

const MOCK_REGS = [
  { id:'r1', name:'Abhinav S.',  roll:'CSE21001', dept:'CSE', checkedIn:true },
  { id:'r2', name:'Priya R.',    roll:'CSE21002', dept:'CSE', checkedIn:true },
  { id:'r3', name:'Rohan M.',    roll:'IT21015',  dept:'IT',  checkedIn:false },
  { id:'r4', name:'Sneha K.',    roll:'CSE21030', dept:'CSE', checkedIn:true },
  { id:'r5', name:'Dev T.',      roll:'EC21008',  dept:'EC',  checkedIn:false },
  { id:'r6', name:'Meera V.',    roll:'IT21022',  dept:'IT',  checkedIn:false },
];

const MOCK_MENTORS = [
  { id:'m1', name:'Dr. Ashish Gupta',   dept:'CSE', email:'agupta@college.edu',   mentees:3 },
  { id:'m2', name:'Prof. Rekha Sharma', dept:'IT',  email:'rsharma@college.edu',  mentees:2 },
  { id:'m3', name:'Dr. Vijay Nair',     dept:'EC',  email:'vnair@college.edu',    mentees:1 },
  { id:'m4', name:'Prof. Anita Mehta',  dept:'CSE', email:'amehta@college.edu',   mentees:4 },
  { id:'m5', name:'Dr. Suresh Patil',   dept:'ME',  email:'spatil@college.edu',   mentees:2 },
  { id:'m6', name:'Prof. Kavya Iyer',   dept:'IT',  email:'kiyer@college.edu',    mentees:1 },
];

/* ── Page router ─────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  const p = location.pathname;
  if (p.includes('organiser-dashboard')) initDashboard();
  else if (p.includes('create-event'))   initCreateEvent();
  else if (p.includes('manage-event'))   initManageEvent();
  else if (p.includes('dispatch'))       initDispatch();
});

/* ── Organiser Dashboard ─────────────────────────────────── */

/* Category display map */
const CATEGORY_LABELS = {
  expert_talk:'Expert Talk', workshop:'Workshop', technical:'Technical',
  cultural:'Cultural', sports:'Sports', seminar:'Seminar'
};

function initDashboard() {
  const role = localStorage.getItem("role");


  async function load() {
    let events = [];
    if (MOCK) {
      await delay(500);
      events = MOCK_EVENTS;
    } else {
      const res = await fetch('/api/events', { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed to load events');
      events = await res.json();
    }

    /* ── stats ── */
    const totalRegs  = events.reduce((s, e) => s + (e.registered || 0), 0);
    const liveCount  = events.filter(e => e.status === 'live').length;
    const certCount  = events.filter(e => e.status === 'ended')
                             .reduce((s, e) => s + (e.checkedIn || 0), 0);

    setText('statEvents', events.length);
    setText('statRegs',   totalRegs);
    setText('statLive',   liveCount);
    setText('statCerts',  certCount);

    /* ── event cards strip ── */
    const cardsWrap = document.getElementById('eventCardsWrap');
    if (cardsWrap && events.length) {
      const featured = events.filter(e => e.status === 'live' || e.status === 'upcoming').slice(0, 4);
      const toShow   = featured.length ? featured : events.slice(0, 4);
      cardsWrap.innerHTML = toShow.map(e => {
        const pct      = e.capacity ? Math.round((e.registered / e.capacity) * 100) : 0;
        const catLabel = CATEGORY_LABELS[e.category] || (e.category ? escHtml(e.category) : '');
        return `
          <a href="./manage-event.html?id=${escHtml(e.id)}" class="ev-card"
             aria-label="Manage ${escHtml(e.title)}">
            <div class="ev-card-top">
              <span class="status ${escHtml(e.status)}">${escHtml(e.status)}</span>
              ${catLabel ? `<span class="ev-card-cat">${catLabel}</span>` : ''}
            </div>
            <div class="ev-card-title">${escHtml(e.title)}</div>
            <div class="ev-card-meta">
              <span>📅 ${escHtml(e.date || '—')}</span>
              <span>📍 ${escHtml(e.venue || '—')}</span>
            </div>
            <div class="ev-card-footer">
              <div class="ev-card-fill">
                <div class="ev-card-fill-bar">
                  <div class="ev-card-fill-inner" style="width:${pct}%"></div>
                </div>
                <span class="ev-card-fill-label">${e.registered ?? 0}/${e.capacity ?? 0}</span>
              </div>
            </div>
          </a>`;
      }).join('');
      document.getElementById('eventCardsSection').hidden = false;
    }

    /* ── table ── */
    const loading = document.getElementById('tableLoading');
    const table   = document.getElementById('eventsTable');
    const empty   = document.getElementById('eventsEmpty');
    const body    = document.getElementById('eventsBody');
    const counter = document.getElementById('tableEventCount');

    if (loading) loading.hidden = true;
    if (counter) counter.textContent = `${events.length} event${events.length !== 1 ? 's' : ''}`;

    if (!events.length) {
      if (empty) empty.hidden = false;
      return;
    }

    if (body) {
      body.innerHTML = events.map(e => {
        const pct = e.capacity ? Math.round((e.registered / e.capacity) * 100) : 0;
        const fillColor = pct >= 90 ? 'var(--c-danger)' : pct >= 60 ? 'var(--c-warning)' : 'var(--c-success)';
        return `
          <tr>
            <td>
              <div class="row-title">${escHtml(e.title)}</div>
              ${e.category ? `<div class="row-sub">${CATEGORY_LABELS[e.category] || escHtml(e.category)}</div>` : ''}
            </td>
            <td class="td-compact">${escHtml(e.date || '—')}</td>
            <td class="td-compact">${escHtml(e.venue || '—')}</td>
            <td class="td-compact">
              <div class="reg-fill-wrap">
                <span class="reg-count">${e.registered ?? 0}<span class="reg-cap"> / ${e.capacity ?? 0}</span></span>
                <div class="reg-fill-bar">
                  <div style="width:${pct}%;background:${fillColor}"></div>
                </div>
              </div>
            </td>
            <td class="td-compact"><span class="status ${escHtml(e.status)}">${escHtml(e.status)}</span></td>
            <td>
              <div class="row-actions">
                <a href="./manage-event.html?id=${escHtml(e.id)}"
                   class="cc-btn cc-btn-primary cc-btn-sm"
                   aria-label="Manage event: ${escHtml(e.title)}">Manage</a>
              </div>
            </td>
          </tr>`;
      }).join('');
    }
    if (table) table.hidden = false;
  }

  load().catch(err => {
    console.error(err);
    showToast('Failed to load dashboard.', 'error');
    const loading = document.getElementById('tableLoading');
    if (loading) loading.hidden = true;
  });
}

/* ── Create Event ────────────────────────────────────────── */

function initCreateEvent() {
  const form = document.getElementById('createEventForm');
  if (!form) return;

  /* field / error helpers */
  function fieldEl(id) { return document.getElementById(id)?.closest('.cc-field') || null; }
  function setErr(id, msg) {
    const f = fieldEl(id);
    if (!f) return;
    const e = f.querySelector('.cc-error-msg');
    if (msg) {
      if (e) e.textContent = msg;
      f.classList.add('has-error');
    } else {
      f.classList.remove('has-error');
    }
  }
  function clearErr(id) { setErr(id, null); }

  /* poster upload + preview */
  const poster  = document.getElementById('poster');
  const preview = document.getElementById('posterPreview');
  const ALLOWED_MIME   = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_POSTER     = 5 * 1024 * 1024;
  const MAX_SPEAKER    = 2 * 1024 * 1024;

  if (poster && preview) {
    poster.addEventListener('change', () => {
      const file = poster.files[0];
      if (!file) { clearErr('poster'); preview.style.display = 'none'; return; }
      if (!ALLOWED_MIME.includes(file.type)) {
        setErr('poster', 'Only PNG, JPG, or WEBP images are allowed.');
        poster.value = ''; preview.style.display = 'none'; return;
      }
      if (file.size > MAX_POSTER) {
        setErr('poster', 'Image must be 5 MB or smaller.');
        poster.value = ''; preview.style.display = 'none'; return;
      }
      clearErr('poster');
      preview.src = URL.createObjectURL(file);
      preview.style.display = 'block';
    });
  }

  /* drag-and-drop poster */
  const uploadArea = document.querySelector('.cc-upload');
  if (uploadArea && poster) {
    uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.style.borderColor = 'var(--c-primary)'; });
    uploadArea.addEventListener('dragleave', () => { uploadArea.style.borderColor = ''; });
    uploadArea.addEventListener('drop', e => {
      e.preventDefault(); uploadArea.style.borderColor = '';
      const file = e.dataTransfer?.files[0];
      if (file) {
        const dt = new DataTransfer(); dt.items.add(file); poster.files = dt.files;
        poster.dispatchEvent(new Event('change'));
      }
    });
  }

  /* speaker photo */
  const spPhoto  = document.getElementById('speakerPhoto');
  const spAvatar = document.getElementById('speakerAvatar');
  const spLabel  = document.getElementById('speakerAvatarLabel');
  if (spAvatar && spPhoto) {
    spAvatar.addEventListener('click',  () => spPhoto.click());
    spAvatar.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') spPhoto.click(); });
    spPhoto.addEventListener('change', () => {
      const file = spPhoto.files[0];
      if (!file) return;
      if (!ALLOWED_MIME.includes(file.type) || file.size > MAX_SPEAKER) {
        showToast('Speaker photo must be JPG/PNG/WEBP under 2 MB.', 'error');
        spPhoto.value = ''; return;
      }
      const url = URL.createObjectURL(file);
      spAvatar.style.backgroundImage = `url(${url})`;
      spAvatar.style.backgroundSize  = 'cover';
      if (spLabel) spLabel.textContent = '';
    });
  }

  /* live error-clear on input */
  const watchIds = ['title','category','date','startTime','venue',
                    'capacity','registrationDeadline','opensAt','closesAt','geofence'];
  watchIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const evt = (el.tagName === 'SELECT') ? 'change' : 'input';
    el.addEventListener(evt, () => {
      if (el.value.trim()) clearErr(id);
      if (id === 'opensAt' || id === 'closesAt') validateTimeWindow(false);
      if (id === 'geofence') validateGeofence(false);
    });
  });

  function validateTimeWindow(report) {
    const opens  = document.getElementById('opensAt')?.value;
    const closes = document.getElementById('closesAt')?.value;
    if (!opens || !closes) return true;
    if (closes <= opens) {
      if (report) setErr('closesAt', '"Closes at" must be after "Opens at".');
      return false;
    }
    clearErr('closesAt');
    return true;
  }

  function validateGeofence(report) {
    const el  = document.getElementById('geofence');
    if (!el || el.value === '') return true;
    const val = parseFloat(el.value);
    if (isNaN(val) || val < 10) {
      if (report) setErr('geofence', 'Geo-fence radius must be at least 10 metres.');
      return false;
    }
    clearErr('geofence');
    return true;
  }

  function validateForm() {
    let ok = true;
    const required = ['title','category','date','startTime','venue',
                      'capacity','registrationDeadline','opensAt','closesAt'];
    required.forEach(id => {
      const el = document.getElementById(id);
      if (!el || !el.value.trim()) {
        const msg = el?.closest('.cc-field')?.querySelector('.cc-error-msg')?.textContent
                    || 'This field is required.';
        setErr(id, msg);
        ok = false;
      } else {
        clearErr(id);
      }
    });
    const cap = document.getElementById('capacity');
    if (cap && cap.value.trim() && parseInt(cap.value, 10) < 1) {
      setErr('capacity', 'Capacity must be at least 1.'); ok = false;
    }
    if (!validateTimeWindow(true)) ok = false;
    if (!validateGeofence(true))   ok = false;
    return ok;
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validateForm()) {
      showToast('Please fix the highlighted fields.', 'error');
      const first = form.querySelector('.cc-field.has-error');
      if (first) first.scrollIntoView({ behavior:'smooth', block:'center' });
      return;
    }
    setBtnLoading('submitBtn', true, 'Publish event');
    try {
      if (MOCK) {
        await delay(900);
        showToast('Event published! (mock)', 'success');
        setTimeout(() => { location.href = './organiser-dashboard.html'; }, 1200);
      } else {
        const fd = new FormData(form);
        const res = await fetch('/api/events', {
          method: 'POST', headers: authHeaders(), body: fd
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || 'Server error');
        }
        showToast('Event published!', 'success');
        setTimeout(() => { location.href = './organiser-dashboard.html'; }, 1200);
      }
    } catch (err) {
      showToast(err.message || 'Failed to publish. Try again.', 'error');
      setBtnLoading('submitBtn', false, 'Publish event');
    }
  });
}

/* ── Manage Event ────────────────────────────────────────── */

function initManageEvent() {
  const params = new URLSearchParams(location.search);
  const evId   = params.get('id') || 'e1';
  let pollTimer = null;

  /* Wire dispatch link to pass event_id */
  const dispLink = document.getElementById('dispatchLink');
  if (dispLink) dispLink.href = `./dispatch.html?event_id=${encodeURIComponent(evId)}`;

  async function load() {
    let ev, regs;
    if (MOCK) {
      await delay(400);
      ev   = MOCK_EVENTS.find(e => e.id === evId) || MOCK_EVENTS[0];
      regs = MOCK_REGS;
    } else {
      const [evRes, regRes] = await Promise.all([
        fetch(`/api/events/${evId}`, { headers: authHeaders() }),
        fetch(`/api/events/${evId}/registrations`, { headers: authHeaders() }),
      ]);
      if (!evRes.ok)  throw new Error('Event not found');
      if (!regRes.ok) throw new Error('Failed to load registrations');
      [ev, regs] = await Promise.all([evRes.json(), regRes.json()]);
    }

    /* header */
    const evTitle  = document.getElementById('evTitle');
    const evMeta   = document.getElementById('evMeta');
    const evStatus = document.getElementById('evStatus');
    if (evTitle)  evTitle.textContent  = ev.title || '—';
    if (evMeta)   evMeta.textContent   = `${ev.date || '—'} · ${ev.venue || '—'} · Capacity ${ev.capacity || 0}`;
    if (evStatus) evStatus.textContent = (ev.status || '').toUpperCase();

    /* stats */
    const live = regs.filter(r => r.checkedIn).length;
    setText('liveCount', live);
    setText('regCount',  regs.length);
    setText('capCount',  ev.capacity || 0);

    /* progress */
    const pct  = ev.capacity ? Math.round((regs.length / ev.capacity) * 100) : 0;
    const fill = document.getElementById('progFill');
    const lbl  = document.getElementById('progLabel');
    const frac = document.getElementById('progFraction');
    const bar  = document.getElementById('progBar');
    if (fill) fill.style.width = pct + '%';
    if (lbl)  lbl.textContent  = pct + '%';
    if (frac) frac.textContent = `${regs.length} / ${ev.capacity || 0}`;
    if (bar)  bar.setAttribute('aria-valuenow', pct);

    /* registrations table */
    const body  = document.getElementById('regBody');
    const empty = document.getElementById('regEmpty');
    if (!regs.length) {
      if (body)  body.innerHTML = '';
      if (empty) empty.hidden   = false;
    } else {
      if (empty) empty.hidden = true;
      if (body) {
        body.innerHTML = regs.map(r => `
          <tr>
            <td class="row-title">${escHtml(r.name)}</td>
            <td>${escHtml(r.roll || '—')}</td>
            <td>${escHtml(r.dept || '—')}</td>
            <td>${r.checkedIn
              ? '<span class="status live">✓ Checked in</span>'
              : '<span class="status ended">Pending</span>'}</td>
          </tr>
        `).join('');
      }
    }

    /* start / stop polling for live events */
    if (ev.status === 'live' && !MOCK) {
      if (!pollTimer) pollTimer = setInterval(load, 10000);
      const hint = document.getElementById('regTableSub');
      if (hint) hint.textContent = 'Auto-refreshes every 10 s while live.';
      const liveHint = document.getElementById('liveHint');
      if (liveHint) liveHint.textContent = '▲ updating live';
    } else if (MOCK) {
      /* simulate live refresh in mock mode */
      if (!pollTimer) pollTimer = setInterval(load, 8000);
    }
  }

  load().catch(err => {
    console.error(err);
    showToast('Failed to load event data.', 'error');
  });

  /* Excel download */
  document.getElementById('excelBtn')?.addEventListener('click', () => {
    if (MOCK) { showToast('Excel downloaded (mock)', 'success'); return; }
    window.location.href = `/api/events/${evId}/reports/attendance?format=xlsx`;
  });

  /* Issue certificates */
  document.getElementById('certBtn')?.addEventListener('click', async () => {
    setBtnLoading('certBtn', true, '🎓 Issue certificates');
    try {
      if (MOCK) {
        await delay(1000);
        showToast('Certificates issued! (mock)', 'success');
      } else {
        const res = await fetch(`/api/events/${evId}/certificates`, {
          method: 'POST', headers: authHeaders()
        });
        if (res.status === 200) {
          const data = await res.json().catch(() => ({}));
          const msg  = data.message || `Certificates issued: ${data.issued_count ?? 0}`;
          showToast(msg, 'success');
        } else {
          throw new Error('Failed to issue certificates');
        }
      }
    } catch (err) {
      showToast(err.message || 'Failed. Try again.', 'error');
    } finally {
      setBtnLoading('certBtn', false, '🎓 Issue certificates');
    }
  });
}

/* ── Dispatch ────────────────────────────────────────────── */

function initDispatch() {
  const params  = new URLSearchParams(location.search);
  const evId    = params.get('event_id') || null;
  let selected  = new Set();
  let mentorData = [];

  const sendBtn = document.getElementById('sendBtn');

  function initials(name) {
    return String(name).split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  }

  function updateCount() {
    const el = document.getElementById('selectionCount');
    if (el) el.textContent = selected.size + ' selected';
    if (sendBtn) sendBtn.disabled = selected.size === 0;
  }

  function renderMentors(mentors) {
    const loading = document.getElementById('mentorLoading');
    const list    = document.getElementById('mentorList');
    const empty   = document.getElementById('mentorEmpty');
    const selAll  = document.getElementById('selectAll');

    if (loading) loading.hidden = true;

    if (!mentors.length) {
      if (empty)  empty.hidden  = false;
      if (selAll) selAll.hidden = true;
      if (sendBtn) sendBtn.disabled = true;
      return;
    }

    if (list) {
      list.hidden = false;
      list.innerHTML = mentors.map(m => `
        <div class="cc-mentor-card" data-id="${escHtml(m.id)}"
             role="checkbox" aria-checked="false" tabindex="0"
             aria-label="${escHtml(m.name)}, ${escHtml(m.dept)}">
          <div class="cc-mentor-avatar" aria-hidden="true">${escHtml(initials(m.name))}</div>
          <div>
            <div class="cc-mentor-name">${escHtml(m.name)}</div>
            <div class="cc-mentor-dept">${escHtml(m.dept)} · ${escHtml(m.email)}
              ${m.mentees ? ` · ${m.mentees} mentee${m.mentees !== 1 ? 's' : ''}` : ''}</div>
          </div>
          <div class="cc-mentor-check" aria-hidden="true">✓</div>
        </div>
      `).join('');

      list.querySelectorAll('.cc-mentor-card').forEach(card => {
        function toggle() {
          const id = card.dataset.id;
          if (selected.has(id)) {
            selected.delete(id);
            card.classList.remove('selected');
            card.setAttribute('aria-checked', 'false');
          } else {
            selected.add(id);
            card.classList.add('selected');
            card.setAttribute('aria-checked', 'true');
          }
          updateCount();
        }
        card.addEventListener('click', toggle);
        card.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
        });
      });
    }
    updateCount();
  }

  /* Select all */
  document.getElementById('selectAll')?.addEventListener('click', function () {
    const cards     = document.querySelectorAll('.cc-mentor-card');
    const allChosen = cards.length > 0 && cards.length === selected.size;
    selected.clear();
    cards.forEach(c => {
      c.classList.remove('selected');
      c.setAttribute('aria-checked', 'false');
      if (!allChosen) {
        selected.add(c.dataset.id);
        c.classList.add('selected');
        c.setAttribute('aria-checked', 'true');
      }
    });
    this.textContent   = allChosen ? 'Select all' : 'Deselect all';
    this.setAttribute('aria-pressed', String(!allChosen));
    updateCount();
  });

  /* Load mentors */
  async function loadMentors() {
    if (MOCK) {
      await delay(500);
      mentorData = MOCK_MENTORS;
    } else {
      const url = evId
        ? `/api/events/${evId}/dispatch/preview`
        : '/api/mentors';
      const res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed to load mentors');
      const data = await res.json();
      mentorData = data.mentors || data;
    }
    renderMentors(mentorData);
  }

  loadMentors().catch(err => {
    console.error(err);
    showToast('Failed to load mentors.', 'error');
    const loading = document.getElementById('mentorLoading');
    if (loading) loading.hidden = true;
  });

  /* Send report */
  sendBtn?.addEventListener('click', async () => {
    if (!selected.size) { showToast('Select at least one mentor.', 'error'); return; }
    setBtnLoading('sendBtn', true, '📨 Send report');
    try {
      if (MOCK) {
        await delay(1000);
        showToast(`Report sent to ${selected.size} mentor(s)! (mock)`, 'success');
        selected.clear();
        document.querySelectorAll('.cc-mentor-card').forEach(c => {
          c.classList.remove('selected');
          c.setAttribute('aria-checked', 'false');
        });
        updateCount();
      } else {
        const url = evId ? `/api/events/${evId}/dispatch` : '/api/dispatch';
        const res = await fetch(url, {
          method:  'POST',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body:    JSON.stringify({ mentors: [...selected] }),
        });
        if (res.status === 422) {
          showToast('No eligible mentors for this event.', 'error'); return;
        }
        if (!res.ok) throw new Error('Dispatch failed');
        const data = await res.json().catch(() => ({}));
        showToast(`Reports sent to ${data.sent_count ?? selected.size} mentor(s)!`, 'success');
        selected.clear();
        document.querySelectorAll('.cc-mentor-card').forEach(c => {
          c.classList.remove('selected');
          c.setAttribute('aria-checked', 'false');
        });
        updateCount();
      }
    } catch (err) {
      showToast(err.message || 'Send failed. Try again.', 'error');
    } finally {
      setBtnLoading('sendBtn', false, '📨 Send report');
    }
  });
}
