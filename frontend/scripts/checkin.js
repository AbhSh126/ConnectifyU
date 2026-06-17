/* ============================================================
   ConnectifyU — Check-in script  (checkin.js)

   Flow:
     1. Parse ?event_id= from URL → fetch event details
     2. Start webcam via getUserMedia()
     3. On "Mark attendance": capture JPEG + GPS + event_id
     4. POST multipart to /api/attendance/verify
     5. Update face / location / time status rows
     6. Show success or failure panel

   MOCK = true  → simulates API responses without a backend.
   Flip to false once backend is wired.
   ============================================================ */

const MOCK = true;

/* ── DOM refs ─────────────────────────────────────────────── */
const $ = id => document.getElementById(id);

const cam        = $('cam');
const canvas     = $('canvas');
const markBtn    = $('markBtn');
const retryBtn   = $('retryBtn');
const resultBox  = $('resultBox');
const toast      = $('toast');
const camError   = $('camError');
const geoError   = $('geoError');
const windowBanner = $('windowBanner');
const windowText   = $('windowText');

/* ── URL param ───────────────────────────────────────────── */
const params  = new URLSearchParams(location.search);
const eventId = params.get('event_id') || null;

/* ── Toast ───────────────────────────────────────────────── */
function showToast(msg, type) {
  if (!toast) return;
  toast.textContent = msg;
  toast.className = 'cc-toast show' + (type ? ' ' + type : '');
  clearTimeout(toast._tid);
  toast._tid = setTimeout(() => { toast.className = 'cc-toast'; }, 3000);
}

/* ── Status row helpers ──────────────────────────────────── */
function setRow(rowId, dotId, detailId, state, detailText) {
  const row  = $(rowId);
  const dot  = $(dotId);
  const det  = $(detailId);
  if (!row) return;
  row.classList.remove('ok', 'fail');
  if (state) row.classList.add(state);
  if (dot) dot.textContent = state === 'ok' ? '✓' : state === 'fail' ? '✗' : '●';
  if (det && detailText) det.textContent = detailText;
}

function resetRows() {
  setRow('rowFace', 'faceDot', 'faceDetail', '',  'Look straight at the camera');
  setRow('rowLoc',  'locDot',  'locDetail',  '',  'Inside the event geofence');
  setRow('rowTime', 'timeDot', 'timeDetail', '',  'Within attendance window');
  if (resultBox) resultBox.hidden = true;
}

/* Add dot IDs to the HTML rows so we can target them */
(function patchDots() {
  const map = {
    rowFace: ['faceDot', 'faceDetail'],
    rowLoc:  ['locDot',  'locDetail'],
    rowTime: ['timeDot', 'timeDetail'],
  };
  Object.entries(map).forEach(([rowId, [dotId, detId]]) => {
    const row = $(rowId);
    if (!row) return;
    const dot = row.querySelector('.cc-status-dot');
    const det = row.querySelector('.cc-status-detail');
    if (dot && !dot.id) dot.id = dotId;
    if (det && !det.id) det.id = detId;
  });
})();

/* ── Step 0: load event info ──────────────────────────────── */
async function loadEventInfo() {
  if (!eventId) return;

  let ev = null;
  try {
    if (MOCK) {
      ev = {
        title:    'AI & Machine Learning Workshop',
        date:     '18 June 2026',
        opens_at: '09:00',
        closes_at:'11:00',
      };
      await new Promise(r => setTimeout(r, 300));
    } else {
      const token = typeof auth !== 'undefined' ? auth.getToken() : null;
      const res   = await fetch(`/api/events/${eventId}`, {
        headers: token ? { 'Authorization': 'Bearer ' + token } : {}
      });
      if (!res.ok) throw new Error('Event not found');
      ev = await res.json();
    }
  } catch (err) {
    console.warn('Could not load event info:', err);
    return;
  }

  if (!ev) return;

  const eyebrow = $('eventEyebrow');
  const title   = $('eventTitle');
  const meta    = $('eventMeta');
  if (eyebrow) eyebrow.textContent = 'Today\'s event';
  if (title)   title.textContent   = ev.title || 'Mark your attendance';
  if (meta)    meta.textContent    = ev.date || '';

  if (ev.opens_at && ev.closes_at && windowBanner && windowText) {
    windowText.textContent = `Attendance window: ${ev.opens_at} – ${ev.closes_at}`;
    windowBanner.hidden = false;
  }
}

/* ── Step 1: start webcam ─────────────────────────────────── */
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    cam.srcObject = stream;
    cam.onloadedmetadata = () => {
      markBtn.disabled = false;
    };
    if (camError) camError.hidden = true;
  } catch (err) {
    console.error('Camera error:', err);
    if (camError) {
      const msgEl = $('camErrorMsg');
      if (msgEl) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          msgEl.textContent =
            'Camera access was denied. Click the camera icon in your browser address bar '
            + 'to allow access, then reload this page.';
        } else if (err.name === 'NotFoundError') {
          msgEl.textContent =
            'No camera found on this device. Please connect a webcam and reload.';
        } else {
          msgEl.textContent =
            'Could not access the camera (' + err.message + '). Please reload and try again.';
        }
      }
      camError.hidden = false;
    }
    markBtn.disabled = true;
    showToast('Camera access denied', 'error');
  }
}

/* ── Step 2: get GPS ──────────────────────────────────────── */
function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        acc: pos.coords.accuracy,
      }),
      err => reject(err),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  });
}

/* ── Step 3: capture JPEG from <video> ────────────────────── */
function captureJpeg() {
  canvas.width  = cam.videoWidth  || 640;
  canvas.height = cam.videoHeight || 480;
  canvas.getContext('2d').drawImage(cam, 0, 0);
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
}

/* ── Step 4: verify with backend ─────────────────────────── */
async function sendVerification(blob, lat, lng) {
  if (MOCK) {
    await new Promise(r => setTimeout(r, 900));
    /* Simulate: face ✓, location depends on GPS availability, time ✓ */
    return {
      face:     true,
      location: lat !== null,
      time:     true,
      messages: {
        face:     'Face matched successfully.',
        location: lat !== null ? 'Inside venue geofence.' : 'Location could not be determined.',
        time:     'Within attendance window.',
      }
    };
  }

  const fd = new FormData();
  fd.append('photo',    blob, 'checkin.jpg');
  fd.append('event_id', eventId || '');
  if (lat !== null) { fd.append('lat', lat); fd.append('lng', lng); }

  const token = typeof auth !== 'undefined' ? auth.getToken() : null;
  const res   = await fetch('/api/attendance/verify', {
    method:  'POST',
    headers: token ? { 'Authorization': 'Bearer ' + token } : {},
    body:    fd,
  });

  if (res.status === 409) {
    /* Already recorded — treat as full success */
    return { face: true, location: true, time: true, alreadyRecorded: true };
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Verification request failed.');
  }
  return res.json();
}

/* ── Step 5: render result ────────────────────────────────── */
function showResult(allPass, alreadyRecorded) {
  if (!resultBox) return;
  resultBox.hidden = false;

  if (alreadyRecorded) {
    resultBox.innerHTML = `
      <div class="cc-result-success">
        <div class="cc-result-icon">✅</div>
        <div class="cc-result-title">Already recorded</div>
        <p class="cc-result-text">Your attendance was already marked for this event.</p>
      </div>`;
    lockSuccess();
    return;
  }

  if (allPass) {
    resultBox.innerHTML = `
      <div class="cc-result-success">
        <div class="cc-result-icon">✅</div>
        <div class="cc-result-title">Attendance marked!</div>
        <p class="cc-result-text">
          You're all set. Your certificate will appear after the event ends.
        </p>
      </div>`;
    lockSuccess();
  } else {
    resultBox.innerHTML = `
      <div class="cc-result-fail">
        <div class="cc-result-icon">⚠️</div>
        <div class="cc-result-title">Couldn't verify</div>
        <p class="cc-result-text">Fix the failed checks above and try again.</p>
      </div>`;
    markBtn.hidden  = true;
    retryBtn.hidden = false;
    retryBtn.focus();
  }
}

function lockSuccess() {
  markBtn.hidden  = true;
  retryBtn.hidden = true;
  markBtn.disabled = true;
}

/* ── Mark attendance button ───────────────────────────────── */
markBtn?.addEventListener('click', async () => {
  markBtn.disabled = true;
  markBtn.textContent = 'Verifying…';
  markBtn.classList.add('loading');
  resetRows();

  /* Geolocation — warn but continue */
  let loc = null;
  try {
    loc = await getLocation();
    if (geoError) geoError.hidden = true;
  } catch (err) {
    console.warn('Geolocation error:', err.code, err.message);
    if (geoError) {
      const msgEl = $('geoErrorMsg');
      if (msgEl) {
        if (err.code === 1 /* PERMISSION_DENIED */) {
          msgEl.textContent =
            'Location permission was denied. Open your browser settings, '
            + 'allow location for this site, then reload.';
        } else if (err.code === 2 /* POSITION_UNAVAILABLE */) {
          msgEl.textContent = 'Your location could not be determined. Please try again.';
        } else if (err.code === 3 /* TIMEOUT */) {
          msgEl.textContent = 'Location request timed out. Move to a clear area and retry.';
        } else {
          msgEl.textContent = err.message || 'Location unavailable.';
        }
      }
      geoError.hidden = false;
    }
    /* loc remains null — backend will fail the location check */
  }

  /* Capture photo */
  let blob;
  try {
    blob = await captureJpeg();
  } catch (err) {
    console.error('Capture error:', err);
    showToast('Failed to capture photo. Please reload and try again.', 'error');
    markBtn.disabled    = false;
    markBtn.textContent = '📸 Mark attendance';
    markBtn.classList.remove('loading');
    return;
  }

  /* Send to backend */
  try {
    const result = await sendVerification(blob, loc?.lat ?? null, loc?.lng ?? null);

    const msgs = result.messages || {};

    setRow('rowFace', 'faceDot', 'faceDetail',
      result.face ? 'ok' : 'fail',
      result.face ? (msgs.face || 'Verified') : (msgs.face || 'Face not recognised')
    );
    setRow('rowLoc', 'locDot', 'locDetail',
      result.location ? 'ok' : 'fail',
      result.location
        ? (msgs.location || 'Inside geofence')
        : (msgs.location || 'Outside venue or location unavailable')
    );
    setRow('rowTime', 'timeDot', 'timeDetail',
      result.time ? 'ok' : 'fail',
      result.time ? (msgs.time || 'Within window') : (msgs.time || 'Outside attendance window')
    );

    const allPass = result.face && result.location && result.time;
    showResult(allPass, result.alreadyRecorded);

  } catch (err) {
    console.error('Verification error:', err);
    showToast(err.message || 'Verification failed. Please try again.', 'error');
    markBtn.disabled    = false;
    markBtn.textContent = '📸 Mark attendance';
  } finally {
    markBtn.classList.remove('loading');
  }
});

/* ── Retry button ─────────────────────────────────────────── */
retryBtn?.addEventListener('click', () => {
  resetRows();
  if (geoError) geoError.hidden = true;
  markBtn.hidden      = false;
  retryBtn.hidden     = true;
  markBtn.disabled    = false;
  markBtn.textContent = '📸 Mark attendance';
  markBtn.focus();
});

/* ── Boot ─────────────────────────────────────────────────── */
(async function init() {
  await loadEventInfo();
  await startCamera();
})();
