/* ── State ─────────────────────────────────────────────────────────────────── */
let vehicles = [];
let chartInstance = null;

const state = {
  a: { name: 'Car A', make: '', model: '', year: '', fuelType: 'petrol', co2: 0, stars: null, safety: null, seats: null, bodyType: '', trans: '', cc: null, notes: '' },
  b: { name: 'Car B', make: '', model: '', year: '', fuelType: 'ev',     co2: 0, stars: null, safety: null, seats: null, bodyType: '', trans: '', cc: null, notes: '' }
};

/* ── Helpers ───────────────────────────────────────────────────────────────── */
function el(id) { return document.getElementById(id); }
function val(id) { return parseFloat(el(id).value) || 0; }
function txt(id) { return el(id).value.trim(); }

/* ── Theme ─────────────────────────────────────────────────────────────────── */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  el('theme-label').textContent = theme === 'dark' ? 'Dark' : 'Light';
  localStorage.setItem('theme', theme);
  if (chartInstance) updateChartTheme();
}

function updateChartTheme() {
  const dark = document.documentElement.dataset.theme === 'dark';
  const grid  = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const tick  = dark ? '#8b949e' : '#64748b';
  const bgTip = dark ? '#1c2128' : '#ffffff';
  const brTip = dark ? '#30363d' : '#e2e8f0';
  const ttTip = dark ? '#e6edf3' : '#0f172a';
  const bdTip = dark ? '#8b949e' : '#64748b';
  chartInstance.options.scales.x.ticks.color = tick;
  chartInstance.options.scales.y.ticks.color = tick;
  chartInstance.options.scales.x.grid.color  = grid;
  chartInstance.options.scales.y.grid.color  = grid;
  chartInstance.options.plugins.tooltip.backgroundColor = bgTip;
  chartInstance.options.plugins.tooltip.borderColor     = brTip;
  chartInstance.options.plugins.tooltip.titleColor      = ttTip;
  chartInstance.options.plugins.tooltip.bodyColor       = bdTip;
  chartInstance.update();
}

el('theme-toggle').addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});

/* ── km slider ─────────────────────────────────────────────────────────────── */
function updateKm() {
  const v = parseInt(el('km').value);
  el('km-display').textContent = v.toLocaleString();
  const pct = ((v - 5000) / (50000 - 5000)) * 100;
  el('km').style.background = `linear-gradient(to right, var(--teal) ${pct}%, var(--bg-4) ${pct}%)`;
}
el('km').addEventListener('input', updateKm);

/* ── Mode toggle ───────────────────────────────────────────────────────────── */
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const car  = btn.dataset.car;
    const mode = btn.dataset.mode;
    ['browse', 'plate', 'manual'].forEach(m => {
      el(car + '-' + m).classList.toggle('active', m === mode);
    });
    document.querySelectorAll(`#card-${car} .mode-btn`).forEach(b => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
  });
});

/* ── Browse / search dropdown ──────────────────────────────────────────────── */
const fuelChipClass = { petrol: 'fc-petrol', diesel: 'fc-diesel', ev: 'fc-ev', hybrid: 'fc-hybrid', phev: 'fc-phev' };

function renderList(car, query) {
  const q = query.toLowerCase().trim();
  const filtered = q
    ? vehicles.filter(v => (v.name + v.make + v.model + String(v.year) + v.fuelType).toLowerCase().includes(q))
    : vehicles;

  const html = filtered.slice(0, 14).map(v => {
    const chip    = fuelChipClass[v.fuelType] || '';
    const economy = v.l100 ? v.l100 + ' L/100km' : v.kwh ? v.kwh + ' kWh/100km' : '';
    return `<div class="dropdown-item" data-car="${car}" data-plate="${v.plate}">
      <div class="di-name">${v.name}<span class="fuel-chip ${chip}">${v.fuelType.toUpperCase()}</span></div>
      <div class="di-meta">${[v.bodyType, economy, '$' + v.price.toLocaleString()].filter(Boolean).join(' · ')}</div>
    </div>`;
  }).join('') || '<div class="dropdown-item"><div class="di-meta">No matches — try "Enter specs"</div></div>';

  el(car + '-list').innerHTML = html;

  el(car + '-list').querySelectorAll('.dropdown-item[data-plate]').forEach(item => {
    item.addEventListener('mousedown', () => selectVehicle(car, item.dataset.plate));
  });
}

function openList(car)  { el(car + '-list').classList.add('open'); }
function closeList(car) { el(car + '-list').classList.remove('open'); }

['a', 'b'].forEach(car => {
  el(car + '-search').addEventListener('input',  () => { renderList(car, el(car + '-search').value); openList(car); });
  el(car + '-search').addEventListener('focus',  () => openList(car));
  el(car + '-search').addEventListener('blur',   () => setTimeout(() => closeList(car), 150));
});

function selectVehicle(car, plate) {
  const v = vehicles.find(x => x.plate === plate);
  if (!v) return;

  Object.assign(state[car], {
    name: v.name, make: v.make, model: v.model, year: v.year,
    fuelType: v.fuelType, co2: v.co2 || 0, stars: v.stars,
    safety: v.safety, seats: v.seats, bodyType: v.bodyType,
    trans: v.trans, cc: v.cc, notes: v.notes
  });

  el(car + '-search').value = v.name;
  closeList(car);
  el(car + '-price').value = v.price;
  el(car + '-fuel').value  = v.fuelType;
  updateFuelUI(car);
  if (v.l100) el(car + '-l100').value = v.l100;
  if (v.kwh)  el(car + '-kwh').value  = v.kwh;
  if (v.fuelType === 'phev') {
    if (v.l100) el(car + '-pl100').value = v.l100;
    if (v.kwh)  el(car + '-pkwh').value  = v.kwh;
  }
  // Try to show a market price estimate for browsed vehicles
  const browsedPrice = lookupMarketPrice(v.make || '', v.model || '', String(v.year || ''));
  if (browsedPrice && !v.price) {
    el(car + '-price').value = browsedPrice;
    el(car + '-price-source').textContent = 'Price estimate from Trade Me averages — adjust if needed';
  } else if (v.price) {
    el(car + '-price-source').textContent = '';
  }
  buildInsuranceLinks(car, v.make || '', v.model || '', String(v.year || ''));
  showBanner(car, v);
  setStatus(car, '');
}

/* ── Plate lookup ──────────────────────────────────────────────────────────── */
async function lookupPlate(car) {
  const plate = el(car + '-plate-input').value.trim().toUpperCase().replace(/\s/g, '');
  if (!plate) return;

  const btn = el(car + '-lbtn');
  btn.disabled = true;
  btn.textContent = '…';
  setStatus(car, 'Looking up ' + plate + '…', 's-load');
  hideBanner(car);
  el(car + '-carjam').classList.add('hidden');

  try {
    const res = await fetch('/api/lookup/' + encodeURIComponent(plate));
    const v   = await res.json();
    if (!res.ok) throw new Error(v.error || 'Not found');

    Object.assign(state[car], {
      name:     v.name     || plate,
      make:     v.make     || '',
      model:    v.model    || '',
      year:     v.year     || '',
      fuelType: v.fuelType || 'petrol',
      co2:      v.co2      || 0,
      stars:    v.stars    || null,
      safety:   v.safety   || null,
      seats:    v.seats    || null,
      bodyType: v.bodyType || '',
      trans:    v.trans    || v.transmission || '',
      cc:       v.cc       || null,
      notes:    v.notes    || ''
    });

    // Auto-populate price: prefer server-returned price, fall back to local lookup
    const lookedUpPrice = v.price || lookupMarketPrice(v.make, v.model, v.year);
    if (lookedUpPrice) {
      el(car + '-price').value = lookedUpPrice;
      el(car + '-price-source').textContent = v._priceSource
        ? 'Price estimate: ' + v._priceSource + ' — adjust if needed'
        : 'Price estimate from Trade Me averages — adjust if needed';
    } else {
      el(car + '-price-source').textContent = 'No price estimate available — enter manually';
    }
    el(car + '-fuel').value  = v.fuelType || 'petrol';
    updateFuelUI(car);
    if (v.l100) el(car + '-l100').value = v.l100;
    if (v.kwh)  el(car + '-kwh').value  = v.kwh;

    showBanner(car, { ...v, ...state[car] });
    setStatus(car, '✓ Found' + (v._demo ? ' (demo data)' : ''), 's-ok');

    // Show Carjam link
    const carjamLink = el(car + '-carjam');
    carjamLink.href = 'https://www.carjam.co.nz/car/?plate=' + encodeURIComponent(plate);
    carjamLink.classList.remove('hidden');

  } catch (e) {
    setStatus(car, '✗ ' + e.message, 's-err');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Look up';
  }
}

el('a-lbtn').addEventListener('click', () => lookupPlate('a'));
el('b-lbtn').addEventListener('click', () => lookupPlate('b'));

['a', 'b'].forEach(car => {
  el(car + '-plate-input').addEventListener('keydown', e => { if (e.key === 'Enter') lookupPlate(car); });
  el(car + '-plate-input').addEventListener('input',   e => { e.target.value = e.target.value.toUpperCase(); });
});

/* ── Manual entry ──────────────────────────────────────────────────────────── */
function applyManual(car) {
  const make  = txt(car + '-make');
  const model = txt(car + '-model');
  const year  = txt(car + '-year');
  const body  = el(car + '-body').value;
  if (!make && !model) { setStatus(car, 'Enter at least a make or model', 's-err'); return; }
  const name = [year, make, model].filter(Boolean).join(' ');
  Object.assign(state[car], { name, make, model, year, bodyType: body, fuelType: el(car + '-fuel').value, co2: 0 });
  showBanner(car, state[car]);
  setStatus(car, '✓ Set — fill in price and fuel economy below', 's-ok');
}

el('a-manual-btn').addEventListener('click', () => applyManual('a'));
el('b-manual-btn').addEventListener('click', () => applyManual('b'));


/* ── Market price lookup ────────────────────────────────────────────────────── */
let pricesData = {};

async function loadPrices() {
  try {
    const res = await fetch('/prices.json');
    pricesData = await res.json();
  } catch (e) {
    console.warn('Could not load prices.json', e);
  }
}

function lookupMarketPrice(make, model, year) {
  if (!make || !model || !year || !pricesData) return null;
  const makeKey  = make.toLowerCase().trim();
  const modelKey = model.toLowerCase().trim();
  const yearNum  = parseInt(year);

  const makeData = pricesData[makeKey];
  if (!makeData) return null;

  let modelData = makeData[modelKey];
  if (!modelData) {
    const key = Object.keys(makeData).find(k => modelKey.includes(k) || k.includes(modelKey));
    modelData = key ? makeData[key] : null;
  }
  if (!modelData) return null;

  for (const [range, price] of Object.entries(modelData)) {
    if (range === '_note') continue;
    const [from, to] = range.split('-').map(Number);
    if (yearNum >= from && yearNum <= to) return price;
  }
  return null;
}

/* ── Insurance links ────────────────────────────────────────────────────────── */
function buildInsuranceLinks(car, make, model, year) {
  const q   = encodeURIComponent([year, make, model].filter(Boolean).join(' '));
  const mq  = encodeURIComponent(make  || '');
  const moq = encodeURIComponent(model || '');

  // Quashed — NZ insurance comparison
  el(car + '-ins-quashed').href = 'https://www.quashed.co.nz/';

  // AA Insurance — car quote page
  el(car + '-ins-aa').href = 'https://www.aainsurance.co.nz/car-insurance/get-a-quote';

  // AMI — car quote
  el(car + '-ins-ami').href = 'https://www.ami.co.nz/insurance/car-insurance/';

  // Tower — car insurance
  el(car + '-ins-tower').href = 'https://www.tower.co.nz/insurance/car-insurance/';

  el(car + '-insurance').style.display = 'block';
}

/* ── Banner ────────────────────────────────────────────────────────────────── */
const fuelLabels   = { petrol: 'Petrol', diesel: 'Diesel', ev: 'Electric', hybrid: 'Hybrid', phev: 'PHEV' };
const fuelTagClass = { petrol: 'tag-petrol', diesel: 'tag-diesel', ev: 'tag-ev', hybrid: 'tag-hybrid', phev: 'tag-phev' };

function showBanner(car, v) {
  const ft  = v.fuelType || 'petrol';
  const co2 = v.co2 || 0;
  const co2cls = co2 === 0 ? 'tag-co2-zero' : co2 < 120 ? 'tag-co2-low' : co2 < 180 ? 'tag-co2-mid' : 'tag-co2-high';
  const co2txt = co2 === 0 ? 'Zero emissions' : co2 + ' g/km CO₂';

  let stars = '';
  if (v.stars) {
    stars = '<span class="tag tag-neutral">';
    for (let i = 1; i <= 6; i++) stars += i <= v.stars ? '★' : '☆';
    stars += ' ' + v.stars + '/6</span>';
  }
  let safety = '';
  if (v.safety) {
    safety = '<span class="tag tag-neutral">Safety ';
    for (let i = 1; i <= 5; i++) safety += i <= v.safety ? '★' : '☆';
    safety += '</span>';
  }

  const meta = [
    v.bodyType && v.year ? v.year + ' ' + v.bodyType : (v.bodyType || v.year || ''),
    v.seats ? v.seats + ' seats' : '',
    v.cc    ? v.cc + 'cc'       : '',
    v.trans || ''
  ].filter(Boolean).join(' · ');

  el(car + '-vname').textContent = v.name || 'Unknown';
  el(car + '-vmeta').textContent = meta;
  el(car + '-vtags').innerHTML =
    `<span class="tag ${fuelTagClass[ft] || ''}">${fuelLabels[ft] || ft}</span>` +
    `<span class="tag ${co2cls}">${co2txt}</span>` +
    (v.notes ? `<span class="tag tag-neutral">${v.notes}</span>` : '') +
    stars + safety;

  const make  = (v.make  || '').toLowerCase().replace(/\s+/g, '-');
  const model = (v.model || '').toLowerCase().replace(/\s+/g, '-');
  el(car + '-trademe').href = make && model
    ? 'https://www.trademe.co.nz/a/motors/cars/' + make + '/' + model
    : make
    ? 'https://www.trademe.co.nz/a/motors/cars/' + make
    : 'https://www.trademe.co.nz/a/motors/cars';

  // Insurance links
  buildInsuranceLinks(car, v.make || '', v.model || '', v.year || '');

  el(car + '-banner').classList.add('show');
}

function hideBanner(car) {
  el(car + '-banner').classList.remove('show');
  el(car + '-price-source').textContent = '';
  el(car + '-insurance').style.display = 'none';
}

function setStatus(car, msg, cls) {
  el(car + '-status').textContent  = msg;
  el(car + '-status').className    = 'status-line' + (cls ? ' ' + cls : '');
}

/* ── Fuel UI ───────────────────────────────────────────────────────────────── */
function updateFuelUI(car) {
  const f = el(car + '-fuel').value;
  el(car + '-liq').classList.toggle('show',  ['petrol', 'diesel', 'hybrid'].includes(f));
  el(car + '-elec').classList.toggle('show', f === 'ev');
  el(car + '-phev').classList.toggle('show', f === 'phev');
}
el('a-fuel').addEventListener('change', () => updateFuelUI('a'));
el('b-fuel').addEventListener('change', () => updateFuelUI('b'));
updateFuelUI('a');
updateFuelUI('b');

/* ── Swap ──────────────────────────────────────────────────────────────────── */
el('swap-btn').addEventListener('click', () => {
  const tmp = { ...state.a };
  Object.assign(state.a, state.b);
  Object.assign(state.b, tmp);

  ['price', 'fuel', 'l100', 'kwh', 'pl100', 'pkwh', 'ppct'].forEach(f => {
    const a = el('a-' + f), b = el('b-' + f);
    if (a && b) { const t = a.value; a.value = b.value; b.value = t; }
  });

  ['a', 'b'].forEach(car => updateFuelUI(car));

  const sA = el('a-search').value, sB = el('b-search').value;
  el('a-search').value = sB;
  el('b-search').value = sA;

  if (el('a-banner').classList.contains('show')) showBanner('a', state.a);
  if (el('b-banner').classList.contains('show')) showBanner('b', state.b);
});

/* ── Tabs ──────────────────────────────────────────────────────────────────── */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b   => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + tab));
  });
});

/* ── Calculations ──────────────────────────────────────────────────────────── */
function runningCost(car) {
  const km = val('km'), pp = val('pp'), dp = val('dp'), ep = val('ep');
  const f  = el(car + '-fuel').value;
  if (f === 'ev')     return (val(car + '-kwh')  / 100) * km * ep + (km / 1000) * val('ruc-e');
  if (f === 'diesel') return (val(car + '-l100') / 100) * km * dp + (km / 1000) * val('ruc-d');
  if (f === 'hybrid') return (val(car + '-l100') / 100) * km * pp;
  if (f === 'phev') {
    const pct = val(car + '-ppct') / 100;
    return pct * (val(car + '-pkwh') / 100) * km * ep + (1 - pct) * (val(car + '-pl100') / 100) * km * pp;
  }
  return (val(car + '-l100') / 100) * km * pp;
}

function fuelDesc(car) {
  return {
    petrol:  'Petrol',
    diesel:  'Diesel + RUC',
    ev:      'Electricity + RUC',
    hybrid:  'Hybrid (petrol)',
    phev:    'PHEV blend'
  }[el(car + '-fuel').value] || '';
}

/* ── Animated counter ──────────────────────────────────────────────────────── */
function animateCounter(elem, target) {
  const duration = 600;
  const start    = performance.now();
  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const ease     = 1 - Math.pow(1 - progress, 3);
    elem.textContent = '$' + Math.round(ease * target).toLocaleString();
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ── Tree fact ─────────────────────────────────────────────────────────────── */
function treeFact(co2A, co2B, km) {
  const KG_PER_TREE = 21;
  const diffKg = Math.abs(co2A - co2B) * km / 1000;
  const trees  = Math.round(diffKg / KG_PER_TREE);
  const loName = co2A <= co2B ? state.a.name : state.b.name;
  const hiName = co2A <= co2B ? state.b.name : state.a.name;

  if (Math.max(co2A, co2B) === 0) {
    return '<span class="tree-num">Both zero! 🎉</span>Both vehicles produce zero tailpipe emissions.';
  }
  if (trees === 0) {
    return 'These vehicles have very similar CO₂ emissions — less than one tree\'s worth of difference per year.';
  }
  if (Math.min(co2A, co2B) === 0) {
    return `<span class="tree-num">${trees} trees/yr</span>The zero-emission vehicle saves ${Math.round(diffKg).toLocaleString()} kg of CO₂ every year versus the ${hiName}.`;
  }
  return `<span class="tree-num">${trees} trees/yr</span>Choosing the ${loName} over the ${hiName} avoids ${Math.round(diffKg).toLocaleString()} kg of CO₂ every year.`;
}

/* ── Compare ───────────────────────────────────────────────────────────────── */
el('compare-btn').addEventListener('click', compare);

function compare() {
  const yrs = Math.max(1, Math.round(val('yrs')));
  const km  = val('km');
  const pA  = val('a-price'), pB = val('b-price');
  const rA  = runningCost('a'), rB = runningCost('b');

  state.a.fuelType = el('a-fuel').value;
  state.b.fuelType = el('b-fuel').value;

  const nA = state.a.name, nB = state.b.name;
  el('leg-a').textContent = nA;
  el('leg-b').textContent = nB;

  // Break-even
  const labels = [], dA = [], dB = [];
  let breakEven = null;
  for (let y = 0; y <= yrs; y++) {
    labels.push('Yr ' + y);
    dA.push(Math.round(pA + rA * y));
    dB.push(Math.round(pB + rB * y));
    if (!breakEven && y > 0) {
      const prev = (pA + rA * (y - 1)) - (pB + rB * (y - 1));
      const curr = (pA + rA * y)       - (pB + rB * y);
      if (prev * curr < 0) breakEven = (y - 1 + Math.abs(prev) / Math.abs(rA - rB)).toFixed(1);
    }
  }

  const badge = el('be-badge');
  if (breakEven) {
    badge.textContent = 'Break-even at ' + breakEven + ' years';
    badge.className   = 'be-badge cross';
  } else {
    badge.textContent = ((pA + rA * yrs) <= (pB + rB * yrs) ? nA : nB) + ' cheaper over ' + yrs + ' yrs';
    badge.className   = 'be-badge nocross';
  }

  // Chart
  const dark  = document.documentElement.dataset.theme === 'dark';
  const grid  = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const tick  = dark ? '#8b949e' : '#64748b';
  const bgTip = dark ? '#1c2128' : '#ffffff';
  const brTip = dark ? '#30363d' : '#e2e8f0';
  const ttTip = dark ? '#e6edf3' : '#0f172a';
  const bdTip = dark ? '#8b949e' : '#64748b';

  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(el('chart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: nA, data: dA, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.08)',  tension: 0.4, pointRadius: 0, borderWidth: 2.5, fill: true },
        { label: nB, data: dB, borderColor: '#0ecfb0', backgroundColor: 'rgba(14,207,176,0.08)', tension: 0.4, pointRadius: 0, borderWidth: 2.5, fill: true }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: bgTip, borderColor: brTip, borderWidth: 1,
          titleColor: ttTip, bodyColor: bdTip,
          callbacks: { label: c => ' $' + c.parsed.y.toLocaleString() }
        }
      },
      scales: {
        x: { ticks: { color: tick, font: { size: 11 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 }, grid: { color: grid }, border: { display: false } },
        y: { ticks: { callback: v => '$' + (v / 1000).toFixed(0) + 'k', color: tick, font: { size: 11 } }, grid: { color: grid }, border: { display: false } }
      }
    }
  });

  // Summary metrics with animation
  const totalA = Math.round(pA + rA * yrs), totalB = Math.round(pB + rB * yrs);
  const aWins  = totalA <= totalB;
  animateCounter(el('sm-a'),    Math.round(rA));
  animateCounter(el('sm-b'),    Math.round(rB));
  animateCounter(el('sm-save'), Math.round(Math.abs(rA - rB)));
  animateCounter(el('sm-total'), Math.min(totalA, totalB));
  el('sm-a-sub').textContent     = fuelDesc('a');
  el('sm-b-sub').textContent     = fuelDesc('b');
  el('sm-save-sub').textContent  = (rA < rB ? nA : nB) + ' saves more/yr';
  el('sm-total-label').textContent = 'Best total over ' + yrs + ' yrs';
  el('sm-total-sub').textContent   = (aWins ? nA : nB) + ' wins';

  // Cost breakdown table
  const mid  = Math.round(yrs / 2);
  const cAm  = Math.round(pA + rA * mid), cBm = Math.round(pB + rB * mid);
  const aWm  = cAm <= cBm;
  const row  = (label, a, b, winA, winB) =>
    `<tr><td>${label}</td><td class="${winA ? 'win-a' : ''}">${a}</td><td class="${winB ? 'win-b' : ''}">${b}</td></tr>`;

  el('cost-table').innerHTML =
    `<tr><th>Item</th><th>${nA}</th><th>${nB}</th></tr>` +
    row('Purchase price',       '$' + pA.toLocaleString(), '$' + pB.toLocaleString(), false, false) +
    row('Running cost / yr',   '$' + Math.round(rA).toLocaleString(), '$' + Math.round(rB).toLocaleString(), rA < rB, rB < rA) +
    row('Running × ' + mid  + ' yrs', '$' + Math.round(rA * mid).toLocaleString(),  '$' + Math.round(rB * mid).toLocaleString(),  false, false) +
    row('Running × ' + yrs  + ' yrs', '$' + Math.round(rA * yrs).toLocaleString(),  '$' + Math.round(rB * yrs).toLocaleString(),  false, false) +
    `<tr class="total-row"><td><strong>Total over ${yrs} yrs</strong></td>
      <td class="${aWm ? 'win-a' : ''}">$${Math.round(pA + rA * yrs).toLocaleString()}</td>
      <td class="${!aWm ? 'win-b' : ''}">$${Math.round(pB + rB * yrs).toLocaleString()}</td>
    </tr>`;

  // CO2 + trees
  const co2A  = state.a.co2 || 0, co2B = state.b.co2 || 0;
  const maxCO2 = Math.max(co2A, co2B, 1);
  const annA   = Math.round(co2A * km / 1000), annB = Math.round(co2B * km / 1000);

  el('tree-km').textContent   = km.toLocaleString();
  el('tree-text').innerHTML   = treeFact(co2A, co2B, km);

  el('co2-bars').innerHTML =
    `<div class="co2-row">
      <div class="co2-lbl">${nA}</div>
      <div class="co2-track"><div class="co2-fill" style="width:${(co2A / maxCO2 * 100).toFixed(1)}%;background:#3b82f6">${co2A > 0 ? co2A + ' g/km' : ''}</div></div>
      <div class="co2-val">${co2A === 0 ? 'Zero 🌱' : annA.toLocaleString() + ' kg/yr'}</div>
    </div>
    <div class="co2-row">
      <div class="co2-lbl">${nB}</div>
      <div class="co2-track"><div class="co2-fill" style="width:${(co2B / maxCO2 * 100).toFixed(1)}%;background:#0ecfb0">${co2B > 0 ? co2B + ' g/km' : ''}</div></div>
      <div class="co2-val">${co2B === 0 ? 'Zero 🌱' : annB.toLocaleString() + ' kg/yr'}</div>
    </div>`;

  // Full comparison table
  const r2  = (l, a, b)  => `<tr><td>${l}</td><td>${a}</td><td>${b}</td></tr>`;
  const cat = l           => `<tr class="cat-hd"><td colspan="3">${l}</td></tr>`;
  const st  = (n, max)    => n ? Array.from({ length: max }, (_, i) => i < n ? '★' : '☆').join('') + ' ' + n + '/' + max : '—';

  el('detail-table').innerHTML =
    `<tr><th>Specification</th><th>${nA}</th><th>${nB}</th></tr>` +
    cat('Vehicle') +
    r2('Make',         state.a.make  || '—', state.b.make  || '—') +
    r2('Model',        state.a.model || '—', state.b.model || '—') +
    r2('Year',         state.a.year  || '—', state.b.year  || '—') +
    r2('Body type',    state.a.bodyType || '—', state.b.bodyType || '—') +
    r2('Seats',        state.a.seats || '—', state.b.seats || '—') +
    r2('Transmission', state.a.trans || '—', state.b.trans || '—') +
    r2('Engine size',  state.a.cc ? state.a.cc + 'cc' : '—', state.b.cc ? state.b.cc + 'cc' : '—') +
    cat('Economy & environment') +
    r2('Fuel type',           state.a.fuelType, state.b.fuelType) +
    r2('Fuel consumption',    val('a-l100') > 0 ? val('a-l100').toFixed(1) + ' L/100km' : '—', val('b-l100') > 0 ? val('b-l100').toFixed(1) + ' L/100km' : '—') +
    r2('Electric consumption',val('a-kwh')  > 0 ? val('a-kwh')  + ' kWh/100km' : '—',         val('b-kwh')  > 0 ? val('b-kwh')  + ' kWh/100km' : '—') +
    r2('CO₂ (tailpipe)',      co2A === 0 ? 'Zero 🌱' : co2A + ' g/km', co2B === 0 ? 'Zero 🌱' : co2B + ' g/km') +
    r2('Annual CO₂',          co2A === 0 ? 'Zero' : annA.toLocaleString() + ' kg',              co2B === 0 ? 'Zero' : annB.toLocaleString() + ' kg') +
    r2('Economy rating',      st(state.a.stars, 6),  st(state.b.stars, 6)) +
    cat('Safety') +
    r2('Safety rating', st(state.a.safety, 5), st(state.b.safety, 5)) +
    cat('Costs at ' + km.toLocaleString() + ' km/yr') +
    r2('Purchase price',    '$' + pA.toLocaleString(), '$' + pB.toLocaleString()) +
    r2('Annual running',    '$' + Math.round(rA).toLocaleString(), '$' + Math.round(rB).toLocaleString()) +
    r2('Cost per 100km',    '$' + (rA / km * 100).toFixed(2), '$' + (rB / km * 100).toFixed(2)) +
    r2('5-year total',      '$' + Math.round(pA + rA * 5).toLocaleString(), '$' + Math.round(pB + rB * 5).toLocaleString()) +
    r2(yrs + '-year total', '$' + Math.round(pA + rA * yrs).toLocaleString(), '$' + Math.round(pB + rB * yrs).toLocaleString());

  // Reveal results with animation
  const resultsEl = el('results');
  resultsEl.classList.remove('hidden');
  resultsEl.classList.remove('results-enter');
  void resultsEl.offsetWidth;
  resultsEl.classList.add('results-enter');
  setTimeout(() => resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
}

/* ── Share ─────────────────────────────────────────────────────────────────── */
el('share-btn').addEventListener('click', shareResults);

function shareResults() {
  const p = new URLSearchParams();
  p.set('km', val('km'));
  p.set('pp', val('pp'));
  p.set('dp', val('dp'));
  p.set('ep', val('ep'));
  p.set('yrs', val('yrs'));
  ['a', 'b'].forEach(car => {
    p.set(car + 'name',  state[car].name);
    p.set(car + 'make',  state[car].make  || '');
    p.set(car + 'model', state[car].model || '');
    p.set(car + 'co2',   state[car].co2   || 0);
    p.set(car + 'fuel',  el(car + '-fuel').value);
    p.set(car + 'price', val(car + '-price'));
    p.set(car + 'l100',  val(car + '-l100'));
    p.set(car + 'kwh',   val(car + '-kwh'));
  });
  p.set('go', '1');
  navigator.clipboard.writeText(location.origin + location.pathname + '?' + p.toString()).then(() => {
    const toast = el('share-toast');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  });
}

/* ── URL restore ───────────────────────────────────────────────────────────── */
function restoreFromURL() {
  const p = new URLSearchParams(location.search);
  if (!p.toString()) return;
  if (p.get('km'))  el('km').value  = p.get('km');
  if (p.get('pp'))  el('pp').value  = p.get('pp');
  if (p.get('dp'))  el('dp').value  = p.get('dp');
  if (p.get('ep'))  el('ep').value  = p.get('ep');
  if (p.get('yrs')) el('yrs').value = p.get('yrs');
  ['a', 'b'].forEach(car => {
    const fuel = p.get(car + 'fuel');
    if (fuel) { el(car + '-fuel').value = fuel; updateFuelUI(car); }
    if (p.get(car + 'price')) el(car + '-price').value = p.get(car + 'price');
    if (p.get(car + 'l100'))  el(car + '-l100').value  = p.get(car + 'l100');
    if (p.get(car + 'kwh'))   el(car + '-kwh').value   = p.get(car + 'kwh');
    if (p.get(car + 'name')) {
      state[car].name     = p.get(car + 'name');
      state[car].co2      = parseFloat(p.get(car + 'co2')) || 0;
      state[car].make     = p.get(car + 'make')  || '';
      state[car].model    = p.get(car + 'model') || '';
      state[car].fuelType = fuel || 'petrol';
      el(car + '-search').value = state[car].name;
      showBanner(car, state[car]);
    }
  });
  if (p.get('go') === '1') compare();
}

/* ── Init ──────────────────────────────────────────────────────────────────── */
async function init() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) applyTheme(savedTheme);

  try {
    await loadPrices();
    const res = await fetch('/api/vehicles');
    vehicles  = await res.json();
    renderList('a', '');
    renderList('b', '');
  } catch (e) {
    console.error('Failed to load vehicles:', e);
  }

  updateKm();
  restoreFromURL();
}

init();
