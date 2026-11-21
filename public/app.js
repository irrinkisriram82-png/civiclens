const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const BC = { Critical: '#c62828', High: '#e07b00', Medium: '#b89400', Low: '#2e8b57' };
// UI strings (Telugu and Hindi should be reviewed by a native speaker before public launch)
const I18N = {
  en: {
    tag: 'Report civic problems. AI-assisted triage. Public accountability.',
    n_report: 'Report',
    n_map: 'Map',
    n_list: 'Issues',
    n_stats: 'Analytics',
    n_acc: 'Account',
    h1: '1. What did you see?',
    photo: 'Photo',
    drop: 'Tap to take or upload a photo',
    desc: 'Describe it in your language',
    mic: 'Dictate',
    h2: '2. Where is it?',
    gps: 'Use my location',
    go: '3. Run AI triage',
    pin: 'Or tap the map to drop a pin.',
    me2: 'Me too (+1)',
    letter: 'Complaint letter',
    submit: 'Submit report',
    verify: 'Upload "after" photo to verify',
    share: 'Copy link',
    signin: 'Sign in',
    signout: 'Sign out',
    register: 'Create account',
  },
  te: {
    tag: 'పౌర సమస్యలను నివేదించండి. AI సహాయంతో విశ్లేషణ. ప్రజా జవాబుదారీతనం.',
    n_report: 'నివేదించండి',
    n_map: 'మ్యాప్',
    n_list: 'సమస్యలు',
    n_stats: 'విశ్లేషణ',
    n_acc: 'ఖాతా',
    h1: '1. మీరు ఏమి చూశారు?',
    photo: 'ఫోటో',
    drop: 'ఫోటో తీయడానికి లేదా అప్‌లోడ్ చేయడానికి నొక్కండి',
    desc: 'మీ భాషలో వివరించండి',
    mic: 'మాట్లాడండి',
    h2: '2. ఇది ఎక్కడ ఉంది?',
    gps: 'నా స్థానాన్ని ఉపయోగించండి',
    go: '3. AI విశ్లేషణ ప్రారంభించండి',
    pin: 'లేదా మ్యాప్‌పై నొక్కి పిన్ పెట్టండి.',
    me2: 'నాకూ ఇదే సమస్య (+1)',
    letter: 'ఫిర్యాదు లేఖ',
    submit: 'నివేదికను సమర్పించండి',
    verify: '"తర్వాత" ఫోటో అప్‌లోడ్ చేయండి',
    share: 'లింక్ కాపీ చేయండి',
    signin: 'సైన్ ఇన్',
    signout: 'సైన్ అవుట్',
    register: 'ఖాతా సృష్టించండి',
  },
  hi: {
    tag: 'नागरिक समस्याओं की रिपोर्ट करें। AI सहायता से विश्लेषण। सार्वजनिक जवाबदेही।',
    n_report: 'रिपोर्ट',
    n_map: 'नक्शा',
    n_list: 'समस्याएँ',
    n_stats: 'विश्लेषण',
    n_acc: 'खाता',
    h1: '1. आपने क्या देखा?',
    photo: 'फोटो',
    drop: 'फोटो लेने या अपलोड करने के लिए टैप करें',
    desc: 'अपनी भाषा में बताएँ',
    mic: 'बोलकर लिखें',
    h2: '2. यह कहाँ है?',
    gps: 'मेरा स्थान उपयोग करें',
    go: '3. AI विश्लेषण चलाएँ',
    pin: 'या नक्शे पर टैप करके पिन लगाएँ।',
    me2: 'मुझे भी यही समस्या है (+1)',
    letter: 'शिकायत पत्र',
    submit: 'रिपोर्ट जमा करें',
    verify: '"बाद" की फोटो अपलोड करें',
    share: 'लिंक कॉपी करें',
    signin: 'साइन इन',
    signout: 'साइन आउट',
    register: 'खाता बनाएँ',
  },
};
let lang = localStorage.getItem('cl_lang') || 'en',
  CFG,
  issues = [],
  sel = null,
  draft = { image: null, pin: null, res: null },
  session = JSON.parse(localStorage.getItem('cl_session') || 'null');
let owned = JSON.parse(localStorage.getItem('cl_owned') || '{}'),
  pickMap,
  pubMap,
  pickMk,
  layer,
  myIds = [];
const t = (k) => (I18N[lang] || I18N.en)[k] || I18N.en[k] || k;
function applyLang() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i]').forEach((e) => (e.textContent = t(e.dataset.i)));
  document
    .querySelectorAll('.langs button')
    .forEach((b) => b.classList.toggle('on', b.dataset.l === lang));
  $('#pinst').textContent = draft.pin
    ? `${draft.pin.lat.toFixed(5)}, ${draft.pin.lng.toFixed(5)}`
    : t('pin');
}
document.querySelectorAll('.langs button').forEach(
  (b) =>
    (b.onclick = () => {
      lang = b.dataset.l;
      localStorage.setItem('cl_lang', lang);
      applyLang();
      if (issues.length) {
        drawAll();
        drawAccount();
      }
    }),
);

async function api(url, method = 'GET', body, ownerKey) {
  const h = { 'content-type': 'application/json' };
  if (session) h.authorization = 'Bearer ' + session.token;
  if (ownerKey) h['x-owner-key'] = ownerKey;
  let r;
  try {
    r = await fetch(url, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error('Network problem. Check your connection and try again.');
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 401 && session && !/login/.test(url)) {
      session = null;
      localStorage.removeItem('cl_session');
    }
    throw new Error(j.error || 'Request failed');
  }
  return j;
}
const toast = (m) => {
  const d = document.createElement('div');
  d.textContent = m;
  $('#toast').appendChild(d);
  setTimeout(() => d.remove(), 4200);
};
const pill = (x, c) => `<span class="pill" style="background:${c}">${esc(x)}</span>`;
const bars = (s) =>
  s.parts
    .map(
      (p) =>
        `<div class="br"><span>${esc(p.k)}</span><div class="bar"><i style="width:${(p.v / p.max) * 100}%"></i></div><b>${Math.round(p.v)}/${p.max}</b></div>`,
    )
    .join('');
const ago = (x) => {
  const d = Math.floor((Date.now() - x) / 864e5);
  return d < 1 ? 'today' : d + 'd ago';
};
const staff = () => session && ['officer', 'admin'].includes(session.user.role);
const canAct = (id) => staff() || owned[id] || myIds.includes(id);
const shrink = async (f) => {
  const bm = await createImageBitmap(f),
    k = Math.min(1, 1000 / Math.max(bm.width, bm.height)),
    c = document.createElement('canvas');
  c.width = bm.width * k;
  c.height = bm.height * k;
  c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.8);
};

function tab(x) {
  document.querySelectorAll('section').forEach((s) => s.classList.toggle('on', s.id === x));
  document
    .querySelectorAll('nav button')
    .forEach((b) => b.classList.toggle('on', b.dataset.t === x));
  setTimeout(() => {
    pickMap && pickMap.invalidateSize();
    pubMap && pubMap.invalidateSize();
  }, 60);
  if (x === 'stats') drawStats();
  if (x === 'account') drawAccount();
  window.scrollTo(0, 0);
}
document.querySelectorAll('nav button').forEach((b) => (b.onclick = () => tab(b.dataset.t)));

// ---------- maps ----------
function initMaps() {
  const c = [CFG.center.lat, CFG.center.lng],
    tiles = () => {
      const l = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      });
      let sw = false;
      l.on('tileerror', () => {
        if (sw) return;
        sw = true;
        l.options.subdomains = 'abcd';
        l.setUrl('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png');
      });
      return l;
    };
  pickMap = L.map('pickmap').setView(c, 15);
  tiles().addTo(pickMap);
  pickMap.on('click', (e) => setPin(e.latlng.lat, e.latlng.lng));
  pubMap = L.map('pubmap').setView(c, 14);
  tiles().addTo(pubMap);
  layer = L.layerGroup().addTo(pubMap);
  CFG.landmarks.forEach((l) =>
    L.circleMarker([l.lat, l.lng], { radius: 5, color: '#555', fillOpacity: 0.6 })
      .bindTooltip(l.name)
      .addTo(pubMap),
  );
}
function setPin(lat, lng) {
  draft.pin = { lat, lng };
  $('#pinst').textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  pickMk ? pickMk.setLatLng([lat, lng]) : (pickMk = L.marker([lat, lng]).addTo(pickMap));
}
$('#gps').onclick = () =>
  navigator.geolocation
    ? navigator.geolocation.getCurrentPosition(
        (p) => {
          setPin(p.coords.latitude, p.coords.longitude);
          pickMap.setView([p.coords.latitude, p.coords.longitude], 17);
        },
        () => ($('#pinst').textContent = 'Location blocked. Tap the map instead.'),
      )
    : 0;

// ---------- photo + voice ----------
$('#drop').onclick = () => $('#file').click();
$('#file').onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    draft.image = await shrink(f);
    $('#drop').innerHTML = `<img src="${draft.image}" alt="Preview"><div class="mut">✓</div>`;
  } catch {
    $('#drop').textContent = 'Could not read that image.';
  }
};
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;
if (!SR) $('#mic').hidden = true;
$('#mic').onclick = () => {
  if (rec) {
    rec.stop();
    return;
  }
  rec = new SR();
  rec.lang = $('#lang').value;
  rec.onresult = (e) => {
    $('#txt').value = ($('#txt').value + ' ' + e.results[0][0].transcript).trim();
  };
  rec.onend = () => {
    rec = null;
    $('#micst').textContent = '';
  };
  rec.onerror = () => {
    $('#micst').textContent = 'Voice not available here.';
  };
  rec.start();
  $('#micst').textContent = 'Listening…';
};

// ---------- triage + submit ----------
$('#go').onclick = async () => {
  if (!draft.pin) return ($('#prog').textContent = 'Place a pin on the map first.');
  $('#go').disabled = true;
  $('#result').innerHTML = '';
  $('#prog').innerHTML = '<span class="spin"></span> AI is reading your report…';
  try {
    draft.res = await api('/api/triage', 'POST', {
      text: $('#txt').value,
      image: draft.image,
      lat: draft.pin.lat,
      lng: draft.pin.lng,
    });
    showResult();
    $('#prog').textContent = '';
  } catch (e) {
    $('#prog').textContent = e.message;
  }
  $('#go').disabled = false;
};
function showResult() {
  const r = draft.res,
    a = r.assessment;
  if (!a.is_civic_issue) {
    $('#result').innerHTML =
      '<div class="card note">This does not look like a civic issue. Try a clearer photo.</div>';
    return;
  }
  $('#result').innerHTML =
    `<div class="card"><div class="row" style="justify-content:space-between;margin:0"><h2>AI-assisted assessment</h2><span id="bp">${pill(r.score.band + ' · ' + r.score.sev + '/10', BC[r.score.band])}</span></div>
  ${a.offline ? '<div class="note">AI unavailable right now: this is a rough offline estimate for human review.</div>' : ''}
  <label>Category (you can correct it)</label><select id="cat">${Object.entries(CFG.types)
    .map(
      ([k, v]) => `<option value="${k}" ${k === a.issue_type ? 'selected' : ''}>${esc(v)}</option>`,
    )
    .join('')}</select>
  <p><b>Routed to:</b> ${esc(r.dept)}<br><b>Language:</b> ${esc(a.language)} · <b>Confidence:</b> ${Math.round(a.confidence * 100)}%</p><p>${esc(a.english_summary)}</p><div class="mut">${esc(a.rationale)}</div>
  <h2 style="margin-top:12px">Priority breakdown</h2><div id="sc">${bars(r.score)}</div>
  <details class="whatif"><summary>Explore the score: what if it were different? (not saved)</summary>
   <label>Damage size: <b id="v1">${a.size}</b>/5</label><input type="range" id="w1" min="1" max="5" value="${a.size}">
   <label>Safety risk: <b id="v2">${a.safety}</b>/5</label><input type="range" id="w2" min="1" max="5" value="${a.safety}">
   <label>More citizens reporting: <b id="v3">1</b></label><input type="range" id="w3" min="1" max="10" value="1">
   <label>Road type</label><select id="w4"><option value="local" ${a.road === 'main' ? '' : 'selected'}>Local street</option><option value="main" ${a.road === 'main' ? 'selected' : ''}>Main road</option></select>
   <p class="mut">Watch the bars and the priority badge change. The submitted report uses the AI's own ratings.</p></details>
  ${r.duplicate ? `<div class="note">${r.reusedPhoto ? 'This photo was already used for' : 'A similar open issue is already reported nearby:'} ${esc(r.duplicate.id)}.</div>` : ''}
  <div class="row">${r.duplicate ? `<button class="btn" id="mer">Support existing issue</button>` : ''}${r.reusedPhoto ? '' : `<button class="btn ${r.duplicate ? 'sec' : ''}" id="sub">${r.duplicate ? 'Submit separately' : t('submit')}</button>`}</div></div>`;
  // Interactive what-if explorer: recalculate the score on the server whenever a control moves.
  const refresh = async () => {
    const q = {
      lat: draft.pin.lat,
      lng: draft.pin.lng,
      size: +$('#w1').value,
      safety: +$('#w2').value,
      count: +$('#w3').value,
      road: $('#w4').value,
    };
    $('#v1').textContent = q.size;
    $('#v2').textContent = q.safety;
    $('#v3').textContent = q.count;
    try {
      const s = await api('/api/score-preview', 'POST', q);
      $('#sc').innerHTML = bars(s);
      $('#bp').innerHTML = pill(s.band + ' · ' + s.sev + '/10', BC[s.band]);
    } catch (e) {
      toast(e.message);
    }
  };
  ['#w1', '#w2', '#w3', '#w4'].forEach((id) => ($(id).oninput = refresh));
  const done = async (body) => {
    try {
      const x = await api('/api/reports', 'POST', { triageId: r.triageId, ...body });
      if (x.ownerKey) {
        owned[x.id] = x.ownerKey;
        localStorage.setItem('cl_owned', JSON.stringify(owned));
      }
      sel = x.id;
      $('#result').innerHTML =
        `<div class="card"><h2>Submitted ✓</h2><p>Ticket <b>${esc(x.id)}</b> is live on the public map with status "${esc(x.status)}". Save it to track progress.</p><button class="btn" id="v">View on map</button></div>`;
      $('#v').onclick = () => {
        tab('map');
        focus(x.id);
      };
      draft = { image: null, pin: null, res: null };
      $('#txt').value = '';
      $('#drop').textContent = t('drop');
      $('#pinst').textContent = t('pin');
      await load();
    } catch (e) {
      $('#prog').textContent = e.message;
    }
  };
  if ($('#sub')) $('#sub').onclick = () => done({ category: $('#cat').value });
  if (r.duplicate) $('#mer').onclick = () => done({ mergeWith: r.duplicate.id });
}

// ---------- map, list, detail (with filters) ----------
const vis = () => {
  const q = $('#fq').value.toLowerCase(),
    c = $('#fcat').value,
    s = $('#fstat').value,
    b = $('#fband').value;
  return issues.filter(
    (r) =>
      (!c || r.type === c) &&
      (!s || r.status === s) &&
      (!b || r.score.band === b) &&
      (!q || (r.summary + r.id + r.typeLabel).toLowerCase().includes(q)),
  );
};
function drawMap() {
  layer.clearLayers();
  vis().forEach((r) => {
    const done = r.status === 'Resolved';
    L.circleMarker([r.lat, r.lng], {
      radius: done ? 8 : 11,
      color: r.escalated && !done ? '#000' : '#fff',
      weight: 2,
      fillColor: done ? BC.Low : BC[r.score.band],
      fillOpacity: 0.95,
    })
      .bindTooltip(`${r.typeLabel} · ${r.score.sev}/10`)
      .on('click', () => {
        sel = r.id;
        drawDetail();
      })
      .addTo(layer);
  });
  const open = issues.filter((r) => r.status !== 'Resolved');
  $('#stats1').innerHTML =
    `<div><b>${open.length}</b><span class="mut">Open</span></div><div><b>${issues.length - open.length}</b><span class="mut">Resolved</span></div><div><b>${open.filter((r) => r.escalated).length}</b><span class="mut">Escalated</span></div>`;
}
function focus(id) {
  const r = issues.find((x) => x.id === id);
  if (r) {
    sel = id;
    pubMap.setView([r.lat, r.lng], 17);
    drawDetail();
  }
}
async function drawDetail() {
  if (!sel) {
    $('#detail').innerHTML = '';
    return;
  }
  let r;
  try {
    r = await api('/api/issues/' + sel);
  } catch {
    return;
  }
  const i = CFG.steps.indexOf(r.status),
    act = canAct(r.id);
  $('#detail').innerHTML =
    `<div class="card"><div class="row" style="justify-content:space-between;margin:0"><h2>${esc(r.typeLabel)}</h2>${pill(r.score.band + ' · ' + r.score.sev + '/10', BC[r.score.band])}</div>
  <div class="mut">${esc(r.id)} · ${esc(r.dept)}${r.assignee ? ' · assigned to ' + esc(r.assignee) : ''} · ${r.count} report(s) · ${ago(r.created)} · target ${r.slaDays}d ${r.escalated ? '· <b>ESCALATED</b>' : ''} ${r.reopened ? '· reopened' : ''}</div>
  <p>${esc(r.summary)}</p>${r.before ? `<p class="mut">Before</p><img src="${r.before}" alt="Before">` : ''}${r.after ? `<p class="mut">After</p><img src="${r.after}" alt="After">` : ''}
  <div class="steps">${CFG.steps.map((x, k) => `<span class="${k <= i ? 'd' : ''}">${x}</span>`).join('')}</div>
  <h2>Why this score</h2>${bars(r.score)}<div class="mut">${esc(r.rationale)}</div>
  <h2 style="margin-top:12px">Timeline</h2><div class="tl">${r.history.map((h) => `<div><b>${esc(h.s)}</b> <span class="mut">${new Date(h.t).toLocaleString()}</span><br>${esc(h.note)}</div>`).join('')}</div>
  <div class="row"><button class="btn sec" id="sup">${t('me2')}</button><button class="btn sec" id="lt">${t('letter')}</button><button class="btn sec" id="cp">${t('share')}</button>${act ? `<button class="btn sec" id="vf">${t('verify')}</button>` : ''}${act && r.status === 'Resolved' ? '<button class="btn sec" id="ok">Confirm fixed</button><button class="btn sec" id="no">Dispute: still broken</button>' : ''}</div>
  <input id="vfile" type="file" accept="image/*" hidden><div id="vout"></div><div id="lout"></div></div>`;
  $('#sup').onclick = async () => {
    try {
      await api(`/api/issues/${r.id}/support`, 'POST');
      toast('Thanks, your support was added.');
      await load();
    } catch (e) {
      toast(e.message);
    }
  };
  $('#lt').onclick = () => {
    $('#lout').innerHTML =
      `<pre>${esc(r.letter)}</pre>${r.escLetter ? `<h2>Escalation letter</h2><pre>${esc(r.escLetter)}</pre>` : ''}`;
  };
  $('#cp').onclick = () => {
    const u = location.origin + location.pathname + '#' + r.id;
    navigator.clipboard
      ? navigator.clipboard.writeText(u).then(() => toast('Link copied'))
      : prompt('Copy this link', u);
  };
  if (act) {
    $('#vf').onclick = () => $('#vfile').click();
    $('#vfile').onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      $('#vout').innerHTML = '<p><span class="spin"></span> AI is comparing before and after…</p>';
      try {
        const x = await api(
          `/api/issues/${r.id}/verify`,
          'POST',
          { image: await shrink(f) },
          owned[r.id],
        );
        $('#vout').innerHTML =
          `<div class="note"><b>Verdict: ${esc(x.verdict.verdict)}</b> (${Math.round(x.verdict.confidence * 100)}%). ${esc(x.verdict.reasoning)}</div>`;
        await load(false);
      } catch (er) {
        $('#vout').innerHTML = `<div class="note">${esc(er.message)}</div>`;
      }
    };
  }
  if ($('#ok')) {
    $('#ok').onclick = () => cf(true);
    $('#no').onclick = () => cf(false);
  }
  async function cf(ok) {
    try {
      await api(`/api/issues/${r.id}/confirm`, 'POST', { ok }, owned[r.id]);
      await load();
    } catch (e) {
      toast(e.message);
    }
  }
}
function drawList() {
  const a = [...vis()].sort((x, y) => y.score.total - x.score.total);
  $('#items').innerHTML =
    a
      .map(
        (r) =>
          `<div class="item" tabindex="0" data-id="${esc(r.id)}"><div class="th" style="background:${BC[r.score.band]};color:#fff">${r.score.sev}</div><div style="flex:1"><b>${esc(r.typeLabel)}</b><div class="mut">${esc(r.summary)}</div><div class="mut">${esc(r.status)} · ${r.count} report(s) ${r.escalated ? '· escalated' : ''}</div></div>${pill(r.score.band, BC[r.score.band])}</div>`,
      )
      .join('') || '<div class="card mut">No issues match.</div>';
  document.querySelectorAll('.item').forEach(
    (e) =>
      (e.onclick = () => {
        tab('map');
        focus(e.dataset.id);
      }),
  );
}
const drawAll = () => {
  drawMap();
  drawList();
};

// ---------- analytics ----------
async function drawStats() {
  const a = await api('/api/analytics'),
    mx = (o) => Math.max(1, ...Object.values(o)),
    ch = (h, o) =>
      `<div class="card"><h2>${h}</h2>${
        Object.entries(o)
          .map(
            ([k, v]) =>
              `<div class="br"><span>${esc(k)}</span><div class="bar"><i style="width:${(v / mx(o)) * 100}%"></i></div><b>${v}</b></div>`,
          )
          .join('') || '<span class="mut">No data</span>'
      }</div>`;
  $('#an').innerHTML =
    `<div class="stats"><div><b>${a.open}</b><span class="mut">Open</span></div><div><b>${a.avgFixDays ?? '-'}</b><span class="mut">Avg fix (days)</span></div><div><b>${a.slaBreaches}</b><span class="mut">Past target</span></div></div>${ch('Issues by category', a.byType)}${ch('By status', a.byStatus)}${ch('Open backlog by department', a.openByDept)}<div class="card"><h2>Most ignored open issues</h2>${a.mostIgnored.map((r) => `<p><b>${esc(r.typeLabel)}</b> · ${esc(r.id)} · open ${ago(r.created)}</p>`).join('') || '<span class="mut">None</span>'}</div>`;
}

// ---------- account: citizen + officer + admin ----------
function setSession(x) {
  session = x;
  localStorage.setItem('cl_session', JSON.stringify(x));
  loadMine();
  drawAccount();
}
async function loadMine() {
  myIds = [];
  if (session)
    try {
      myIds = (await api('/api/my-issues')).map((r) => r.id);
    } catch {}
}
async function drawAccount() {
  if (!session) {
    $('#acc').innerHTML =
      `<div class="card"><div class="tabs2"><button class="btn" id="tl">${t('signin')}</button><button class="btn sec" id="tr">${t('register')}</button></div><div id="af"></div><p class="mut">Demo accounts: officer@civiclens.demo / Officer@123 · admin@civiclens.demo / Admin@123 · citizen@civiclens.demo / Citizen@123</p></div>`;
    const form = (reg) => {
      $('#tl').className = 'btn' + (reg ? ' sec' : '');
      $('#tr').className = 'btn' + (reg ? '' : ' sec');
      $('#af').innerHTML =
        `${reg ? '<label>Name</label><input id="nm" autocomplete="name">' : ''}<label>Email</label><input id="em" type="email" autocomplete="email"><label>Password</label><input id="pw" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}"><div class="row"><button class="btn" id="sb">${reg ? t('register') : t('signin')}</button></div><div id="er" class="mut"></div>`;
      $('#sb').onclick = async () => {
        try {
          setSession(
            await api(reg ? '/api/register' : '/api/login', 'POST', {
              name: reg ? $('#nm').value : undefined,
              email: $('#em').value,
              password: $('#pw').value,
            }),
          );
        } catch (e) {
          $('#er').textContent = e.message;
        }
      };
    };
    $('#tl').onclick = () => form(false);
    $('#tr').onclick = () => form(true);
    form(false);
    return;
  }
  const u = session.user;
  let html = `<div class="card"><div class="row" style="justify-content:space-between;margin:0"><h2>${esc(u.name)} · ${esc(u.role)}</h2><button class="btn sec" id="lo">${t('signout')}</button></div></div>`;
  if (!staff()) {
    const mine = issues.filter((r) => myIds.includes(r.id) || owned[r.id]);
    html += `<div class="card"><h2>My reports</h2>${mine.map((r) => `<div class="item" data-id="${esc(r.id)}"><div class="th" style="background:${BC[r.score.band]};color:#fff">${r.score.sev}</div><div style="flex:1"><b>${esc(r.typeLabel)}</b><div class="mut">${esc(r.id)} · ${esc(r.status)}</div></div></div>`).join('') || '<span class="mut">You have not reported anything yet.</span>'}</div>`;
  } else
    html +=
      `<div class="card"><h2>Work queue</h2><p class="mut">Sorted by AI-assisted priority. Officials make the final decision.</p></div>` +
      [...issues]
        .sort((x, y) => y.score.total - x.score.total)
        .map(
          (
            r,
          ) => `<div class="card"><div class="row" style="justify-content:space-between;margin:0"><b>${esc(r.typeLabel)} · ${esc(r.id)}</b>${pill(r.score.band + ' ' + r.score.sev + '/10', BC[r.score.band])}</div><div class="mut">${esc(r.dept)} · ${r.count} report(s) · ${esc(r.status)} ${r.escalated ? '· ESCALATED' : ''}</div><p>${esc(r.summary)}</p>
   <div class="row"><select data-s="${r.id}">${CFG.steps.map((s) => `<option ${s === r.status ? 'selected' : ''}>${s}</option>`).join('')}</select><select data-c="${r.id}">${Object.entries(
     CFG.types,
   )
     .map(([k, v]) => `<option value="${k}" ${k === r.type ? 'selected' : ''}>${esc(v)}</option>`)
     .join('')}</select></div>
   <div class="row"><input data-a="${r.id}" placeholder="Assign to (field officer name)" value="${esc(r.assignee || '')}"><input data-n="${r.id}" placeholder="Note for the public timeline"><button class="btn" data-u="${r.id}">Update</button></div></div>`,
        )
        .join('');
  if (u.role === 'admin')
    html += `<div class="card"><h2>Administrator tools</h2><button class="btn sec" id="esc">Run escalation agent now (demo: escalate all open)</button> <span id="eout" class="mut"></span><h2 style="margin-top:14px">Routing rules</h2><div id="rt"></div><h2 style="margin-top:14px">Audit log</h2><div id="au" class="mut"></div></div>`;
  $('#acc').innerHTML = html;
  $('#lo').onclick = () => {
    session = null;
    myIds = [];
    localStorage.removeItem('cl_session');
    drawAccount();
  };
  document.querySelectorAll('#acc .item').forEach(
    (e) =>
      (e.onclick = () => {
        tab('map');
        focus(e.dataset.id);
      }),
  );
  document.querySelectorAll('[data-u]').forEach(
    (b) =>
      (b.onclick = async () => {
        const id = b.dataset.u,
          q = (k) => document.querySelector(`[data-${k}="${id}"]`).value;
        try {
          await api(`/api/issues/${id}/status`, 'PATCH', {
            status: q('s'),
            category: q('c'),
            assignee: q('a'),
            note: q('n'),
          });
          toast('Updated ' + id);
          await load(false);
          drawAccount();
        } catch (e) {
          toast(e.message);
        }
      }),
  );
  if (u.role === 'admin') {
    $('#esc').onclick = async () => {
      const x = await api('/api/admin/escalate', 'POST', { force: true });
      $('#eout').textContent = x.escalated + ' issue(s) escalated.';
      await load(false);
    };
    const rt = await api('/api/routing');
    $('#rt').innerHTML =
      Object.entries(CFG.types)
        .map(
          ([k, v]) =>
            `<div class="row"><span style="width:200px">${esc(v)}</span><input data-r="${k}" value="${esc(rt[k])}"></div>`,
        )
        .join('') + '<div class="row"><button class="btn" id="sr">Save routing</button></div>';
    $('#sr').onclick = async () => {
      const b = {};
      document.querySelectorAll('[data-r]').forEach((i) => (b[i.dataset.r] = i.value));
      await api('/api/routing', 'PUT', b);
      toast('Routing saved');
    };
    const au = await api('/api/audit');
    $('#au').innerHTML =
      au
        .map(
          (a) =>
            `<div>${new Date(a.t).toLocaleString()} · ${esc(a.actor)} · ${esc(a.action)} · ${esc(a.entity)} ${esc(a.detail)}</div>`,
        )
        .join('') || 'No entries yet.';
  }
}

// ---------- live updates (server-sent events) ----------
function live() {
  const es = new EventSource('/api/stream'),
    b = $('#live');
  es.onopen = () => {
    b.textContent = 'live';
    b.style.background = '#0d8f85';
  };
  es.onerror = () => {
    b.textContent = 'reconnecting';
    b.style.background = '#b89400';
  };
  es.onmessage = (e) => {
    try {
      toast(JSON.parse(e.data).msg);
    } catch {}
    load();
  };
}
async function load(redetail = true) {
  try {
    issues = await api('/api/issues');
    drawAll();
    if (redetail && sel) drawDetail();
  } catch (e) {
    toast(e.message);
  }
}
['#fq', '#fcat', '#fstat', '#fband'].forEach((s) => ($(s).oninput = drawAll));
window.addEventListener('hashchange', () => {
  const id = location.hash.slice(1);
  if (id) {
    tab('map');
    focus(id);
  }
});
(async () => {
  applyLang();
  CFG = await api('/api/config');
  const b = $('#aib');
  b.textContent = CFG.ai ? 'AI-assisted' : 'AI offline fallback';
  $('#aimodel').textContent =
    CFG.provider === 'gemini'
      ? 'Google Gemini'
      : CFG.provider === 'anthropic'
        ? 'Anthropic Claude'
        : 'none configured (offline keyword fallback)';
  if (CFG.provider === 'gemini')
    $('#privextra').textContent =
      'On the free Gemini tier, Google may use submitted content to improve its products.';
  $('#aboutbtn').onclick = () => tab('about');
  b.style.background = CFG.ai ? '#0d8f85' : '#b89400';
  $('#fcat').innerHTML =
    '<option value="">All categories</option>' +
    Object.entries(CFG.types)
      .map(([k, v]) => `<option value="${k}">${esc(v)}</option>`)
      .join('');
  $('#fstat').innerHTML =
    '<option value="">All statuses</option>' +
    CFG.steps.map((s) => `<option>${s}</option>`).join('');
  initMaps();
  await loadMine();
  await load();
  live();
  if (location.hash.length > 1) {
    tab('map');
    focus(location.hash.slice(1));
  }
})();
