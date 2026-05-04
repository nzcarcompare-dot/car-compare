/* ── Cascade vehicle selector ───────────────────────────────────────────────── */
// State per car: tracks what's been selected at each step
const cascadeState = {
  a: { make: null, model: null, year: null },
  b: { make: null, model: null, year: null },
};
let fleetMakes = null; // loaded once

async function loadFleetMakes() {
  if (fleetMakes) return;
  try {
    const res = await fetch('/api/fleet/makes');
    fleetMakes = await res.json();
  } catch (e) { console.warn('Fleet makes load failed', e); fleetMakes = {}; }
}

function cascadeShow(car, step) {
  ['make','model','year','variant'].forEach(s => {
    const el_s = el(car + '-step-' + s);
    if (el_s) el_s.classList.toggle('hidden', s !== step && !['make'].includes(s) && step !== s);
  });
}

function cascadeReset(car) {
  cascadeState[car] = { make: null, model: null, year: null };
  ['model','year','variant'].forEach(s => {
    const e = el(car + '-step-' + s);
    if (e) e.classList.add('hidden');
  });
  const stepMake = el(car + '-step-make');
  if (stepMake) stepMake.classList.remove('hidden');
  const makeInput = el(car + '-make-input');
  if (makeInput) { makeInput.value = ''; makeInput.focus(); }
  const resetBtn = el(car + '-cascade-reset');
  if (resetBtn) resetBtn.classList.add('hidden');
  const makeList = el(car + '-make-list');
  if (makeList) makeList.classList.remove('open');
  hideBanner(car);
  clearPriceSource(car);
  setStatus(car, '');
}

function renderCascadeMakes(car, query) {
  if (!fleetMakes) {
    loadFleetMakes().then(() => renderCascadeMakes(car, query));
    return;
  }
  const q = query.toLowerCase().trim();
  const makes = Object.keys(fleetMakes).sort();
  const filtered = q ? makes.filter(m => m.toLowerCase().includes(q)) : makes;
  const list = el(car + '-make-list');
  if (!filtered.length) {
    list.innerHTML = '<div class="cascade-opt"><span style="color:var(--tx-2);font-size:12px">No matches</span></div>';
  } else {
    list.innerHTML = filtered.slice(0, 30).map(make => {
      const count = fleetMakes[make].length;
      return `<div class="cascade-opt" data-make="${make}">
        <span>${make}</span>
        <span class="cascade-opt-sub">${count} model${count>1?'s':''}</span>
      </div>`;
    }).join('');
    list.querySelectorAll('.cascade-opt[data-make]').forEach(opt => {
      opt.addEventListener('mousedown', () => selectCascadeMake(car, opt.dataset.make));
    });
  }
  list.classList.add('open');
}

function selectCascadeMake(car, make) {
  cascadeState[car].make = make;
  el(car + '-make-input').value = make;
  el(car + '-make-list').classList.remove('open');
  // Show model step
  el(car + '-crumb-make').innerHTML =
    `${make} <button class="cascade-crumb-btn" onclick="cascadeReset('${car}')">change</button>`;
  el(car + '-step-model').classList.remove('hidden');
  el(car + '-model-input').value = '';
  el(car + '-cascade-reset').classList.remove('hidden');
  renderCascadeModels(car, '');
  setTimeout(() => el(car + '-model-input').focus(), 50);
}

function renderCascadeModels(car, query) {
  const make = cascadeState[car].make;
  if (!make || !fleetMakes[make]) return;
  const q = query.toLowerCase().trim();
  const models = fleetMakes[make].sort();
  const filtered = q ? models.filter(m => m.toLowerCase().includes(q)) : models;
  const list = el(car + '-model-list');
  if (!filtered.length) {
    list.innerHTML = '<div class="cascade-opt"><span style="color:var(--tx-2);font-size:12px">No matches</span></div>';
  } else {
    list.innerHTML = filtered.slice(0, 30).map(model =>
      `<div class="cascade-opt" data-model="${model}"><span>${model}</span></div>`
    ).join('');
    list.querySelectorAll('.cascade-opt[data-model]').forEach(opt => {
      opt.addEventListener('mousedown', () => selectCascadeModel(car, opt.dataset.model));
    });
  }
  list.classList.add('open');
}

async function selectCascadeModel(car, model) {
  cascadeState[car].model = model;
  el(car + '-model-input').value = model;
  el(car + '-model-list').classList.remove('open');
  const make = cascadeState[car].make;
  el(car + '-crumb-model').innerHTML =
    `${make} › ${model} <button class="cascade-crumb-btn" onclick="selectCascadeMake('${car}','${make}')">change model</button>`;
  // Fetch years
  try {
    const res = await fetch(`/api/fleet/years?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`);
    const years = await res.json();
    const sel = el(car + '-year-select');
    if (!years.length) {
      sel.innerHTML = '<option value="">No years available</option>';
    } else {
      sel.innerHTML = '<option value="">Select a year…</option>' +
        years.map(y => `<option value="${y}">${y}</option>`).join('');
      sel.onchange = () => {
        const y = parseInt(sel.value);
        if (y) selectCascadeYear(car, y);
      };
    }
    el(car + '-step-year').classList.remove('hidden');
    setTimeout(() => sel.focus(), 50);
  } catch(e) { console.error('Year fetch failed', e); }
}

async function selectCascadeYear(car, year) {
  cascadeState[car].year = year;
  const make  = cascadeState[car].make;
  const model = cascadeState[car].model;
  el(car + '-crumb-year').innerHTML =
    `${make} › ${model} › ${year} <button class="cascade-crumb-btn" onclick="selectCascadeModel('${car}','${model}')">change year</button>`;
  // Fetch variants
  try {
    const res = await fetch(`/api/fleet/variants?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&year=${year}`);
    const variants = await res.json();
    const list = el(car + '-variant-list');

    const fuelLabels = { petrol:'Petrol', diesel:'Diesel', hybrid:'Hybrid', ev:'Electric', phev:'PHEV' };
    const fuelClass  = { petrol:'fc-petrol', diesel:'fc-diesel', hybrid:'fc-hybrid', ev:'fc-ev', phev:'fc-phev' };

    if (!variants.length) {
      list.innerHTML = '<div class="cascade-empty">No variants found for this year</div>';
    } else {
      // If only one variant, auto-select it
      if (variants.length === 1) {
        el(car + '-step-variant').classList.remove('hidden');
        selectCascadeVariant(car, variants[0], make, model, year);
        return;
      }
      list.innerHTML = variants.map((v, i) => {
        const fuelLbl = fuelLabels[v.f] || v.f;
        const chip    = fuelClass[v.f]  || '';
        const meta = [v.b, v.t, v.s ? v.s + ' seats' : null, v.c ? v.c + 'cc' : null]
          .filter(Boolean).join(' · ');
        const fcHtml = v.fc
          ? `<span class="cv-fc">${v.fc}<span class="cv-fc-unit"> L/100km</span></span>`
          : `<span class="cv-fc" style="font-size:13px;color:var(--tx-3)">—</span>`;
        return `<div class="cascade-variant" data-idx="${i}">
          <div class="cv-top">
            <span class="fuel-chip ${chip}">${fuelLbl.toUpperCase()}</span>
            ${fcHtml}
          </div>
          <div class="cv-meta">${meta || 'Details not available'}</div>
          ${v.su ? `<div class="cv-sub">${v.su}</div>` : ''}
        </div>`;
      }).join('');
      list.querySelectorAll('.cascade-variant[data-idx]').forEach(card => {
        card.addEventListener('click', () => {
          selectCascadeVariant(car, variants[parseInt(card.dataset.idx)], make, model, year);
        });
      });
    }
    el(car + '-step-variant').classList.remove('hidden');
  } catch(e) { console.error('Variant fetch failed', e); }
}

function selectCascadeVariant(car, v, make, model, year) {
  const fuelMap  = { petrol:'petrol', diesel:'diesel', hybrid:'hybrid', ev:'ev', phev:'phev' };
  const fuelType = fuelMap[v.f] || 'petrol';
  const displayName = `${year} ${make} ${model}`;

  // Calculate CO2 from fuel consumption — standard emission factors (g CO2 per litre)
  // Petrol: 2.31 kg/L, Diesel: 2.68 kg/L  (source: EECA / drivingtests.co.nz)
  // Formula: FC (L/100km) × kg_per_litre × 1000 / 100 = g/km
  function calcCO2(fc, fuel) {
    if (!fc || fuel === 'ev') return 0;
    const kgPerL = fuel === 'diesel' ? 2.68 : 2.31; // petrol, hybrid, phev all use petrol rate
    return Math.round(fc * kgPerL * 10); // = fc/100 * kgPerL * 1000
  }

  const co2 = calcCO2(v.fc, fuelType);

  Object.assign(state[car], {
    name:     displayName,
    make:     make,
    model:    model,
    year:     year,
    fuelType: fuelType,
    co2:      co2,
    stars:    null,
    safety:   null,
    seats:    v.s || null,
    bodyType: v.b || '',
    trans:    v.t || '',
    cc:       v.c || null,
    kw:       v.k || null,
    notes:    v.su || '',
    odometer: null,
  });

  // Populate fuel economy
  el(car + '-fuel').value = fuelType;
  updateFuelUI(car);
  if (fuelType === 'ev' && v.fc) {
    el(car + '-kwh').value = v.fc;
  } else if (fuelType === 'phev' && v.fc) {
    el(car + '-pl100').value = v.fc;
  } else if (v.fc) {
    el(car + '-l100').value = v.fc;
  }

  // Price estimate
  const price = lookupMarketPrice(make, model, String(year));
  if (price) {
    const salePrice = Math.round(price * 0.92 / 500) * 500;
    el(car + '-price').value = salePrice;
    setPriceSource(car, true);
  } else {
    clearPriceSource(car);
  }

  const co2Label = co2 > 0 ? ` · ${co2} g/km CO₂ (calculated)` : '';
  buildInsuranceLinks(car, make, model, String(year));
  showBanner(car, { ...state[car], l100: v.fc, power: v.k ? v.k + 'kW' : null });
  setStatus(car, v.fc ? `✓ ${v.fc} L/100km${co2Label}` : '✓ Selected', 's-ok');
}

// Initialise cascade event listeners — called once at startup
// Elements always exist in DOM (even if hidden), so listeners attach fine
function initCascade(car) {
  const makeInput  = el(car + '-make-input');
  const modelInput = el(car + '-model-input');
  const makeList   = el(car + '-make-list');
  const modelList  = el(car + '-model-list');
  const resetBtn   = el(car + '-cascade-reset');

  if (!makeInput) { console.warn('initCascade: missing elements for', car); return; }

  makeInput.addEventListener('input',  () => renderCascadeMakes(car, makeInput.value));
  makeInput.addEventListener('focus',  () => {
    if (fleetMakes) renderCascadeMakes(car, makeInput.value);
    else loadFleetMakes().then(() => renderCascadeMakes(car, makeInput.value));
  });
  makeInput.addEventListener('blur',   () => setTimeout(() => makeList.classList.remove('open'), 180));
  makeInput.addEventListener('keydown', e => { if (e.key === 'Escape') makeList.classList.remove('open'); });

  modelInput.addEventListener('input',  () => renderCascadeModels(car, modelInput.value));
  modelInput.addEventListener('focus',  () => renderCascadeModels(car, modelInput.value));
  modelInput.addEventListener('blur',   () => setTimeout(() => modelList.classList.remove('open'), 180));
  modelInput.addEventListener('keydown', e => { if (e.key === 'Escape') modelList.classList.remove('open'); });

  resetBtn.addEventListener('click', () => cascadeReset(car));
}

/* ── State ─────────────────────────────────────────────────────────────────── */
let chartInstance = null;

const state = {
  a: { name: 'Car A', make: '', model: '', year: '', submodel: '', fuelType: 'petrol', co2: 0, co2Stars: null, stars: null, safety: null, safetyTest: '', seats: null, bodyType: '', trans: '', cc: null, power: null, owners: null, origin: null, electricRange: null, yearlyCo2: null, notes: '' },
  b: { name: 'Car B', make: '', model: '', year: '', submodel: '', fuelType: 'ev',     co2: 0, co2Stars: null, stars: null, safety: null, safetyTest: '', seats: null, bodyType: '', trans: '', cc: null, power: null, owners: null, origin: null, electricRange: null, yearlyCo2: null, notes: '' }
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
    ['browse', 'plate'].forEach(m => {
      const panel = el(car + '-' + m);
      if (panel) panel.classList.toggle('active', m === mode);
    });
    document.querySelectorAll(`#card-${car} .mode-btn`).forEach(b => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
    // Clear state when switching tabs
    hideBanner(car);
    clearPriceSource(car);
    setStatus(car, '');
    const cjl = el(car + '-carjam'); if (cjl) cjl.classList.add('hidden');
    // When switching to browse, reset cascade and focus make input
    if (mode === 'browse') {
      cascadeReset(car);
      // Ensure fleet data is ready
      if (!fleetMakes) loadFleetMakes().catch(() => {});
    }
  });
});

/* ── Fuel chip classes (used by cascade variant cards) ─────────────────────── */
const fuelChipClass = { petrol: 'fc-petrol', diesel: 'fc-diesel', ev: 'fc-ev', hybrid: 'fc-hybrid', phev: 'fc-phev' };



/* ── Plate lookup ──────────────────────────────────────────────────────────── */
async function lookupPlate(car, retryCount = 0) {
  const plate = el(car + '-plate-input').value.trim().toUpperCase().replace(/\s/g, '');
  if (!plate) return;

  const btn = el(car + '-lbtn');
  btn.disabled = true;
  btn.textContent = retryCount > 0 ? 'Retrying…' : '…';
  setStatus(car, retryCount > 0 ? 'Waking up server, retrying ' + plate + '…' : 'Looking up ' + plate + '…', 's-load');
  hideBanner(car);
  const cjl = el(car + '-carjam'); if (cjl) cjl.classList.add('hidden');

  try {
    const res = await fetch('/api/lookup/' + encodeURIComponent(plate));
    const v   = await res.json();
    // Retry once on server errors (cold start / timeout) — up to 2 retries
    if (!res.ok && retryCount < 2 && (res.status === 502 || res.status === 503 || res.status === 504)) {
      btn.disabled = false;
      btn.textContent = 'Look up';
      setTimeout(() => lookupPlate(car, retryCount + 1), 2500);
      return;
    }
    if (!res.ok) throw new Error(v.error || 'Not found');

    Object.assign(state[car], {
      name:         v.name         || plate,
      make:         v.make         || '',
      model:        v.model        || '',
      submodel:     v.submodel     || '',
      year:         v.year         || '',
      fuelType:     v.fuelType     || 'petrol',
      co2:          v.co2          || 0,
      co2Stars:     v.co2Stars     || null,
      stars:        v.stars        || null,
      safety:       v.safety       || null,
      safetyTest:   v.safetyTest   || '',
      seats:        v.seats        || null,
      bodyType:     v.bodyType     || '',
      trans:        v.trans        || v.transmission || '',
      cc:           v.cc           || null,
      power:        v.power        || null,
      owners:       v.owners       || null,
      origin:       v.origin       || null,
      electricRange:v.electricRange|| null,
      yearlyCo2:    v.yearlyCo2    || null,
      odometer:     v.odometer     || null,
      notes:        v.notes        || ''
    });

    // Auto-populate price: use odometer-adjusted price if available, else base lookup
    const adjustedPrice = v.adjustedPrice || v.price || lookupMarketPrice(v.make, v.model, v.year);
    if (adjustedPrice) {
      el(car + '-price').value = adjustedPrice;
      const src = el(car + '-price-source');
      if (src) {
        if (v.adjustedPrice && v.odometer) {
          const km = parseInt(v.odometer).toLocaleString();
          src.textContent = '✓ Estimated & adjusted for ' + km + ' km odometer';
          src.className = 'price-source ps-found';
        } else {
          setPriceSource(car, true);
        }
      }
    } else {
      setPriceSource(car, false);
    }
    el(car + '-fuel').value  = v.fuelType || 'petrol';
    updateFuelUI(car);
    if (v.l100) el(car + '-l100').value = v.l100;
    if (v.kwh)  el(car + '-kwh').value  = v.kwh;

    showBanner(car, { ...v, ...state[car] });
    setStatus(car, '✓ Found' + (v._demo ? ' (demo data)' : ''), 's-ok');

    // Show Carjam link (only if element exists — it's inside the plate panel)
    const carjamLink = el(car + '-carjam');
    if (carjamLink) {
      carjamLink.href = 'https://www.carjam.co.nz/car/?plate=' + encodeURIComponent(plate);
      carjamLink.classList.remove('hidden');
    }

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

/* ── Manual entry removed — Enter specs tab removed from UI ── */


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

/* ── Price source helper ────────────────────────────────────────────────────── */
function setPriceSource(car, found) {
  const el_ps = el(car + '-price-source');
  if (!el_ps) return;
  if (found) {
    el_ps.textContent = '✓ Estimated from Trade Me averages';
    el_ps.className = 'price-source ps-found';
  } else {
    el_ps.textContent = '⚠ No estimate — enter price manually';
    el_ps.className = 'price-source ps-missing';
  }
}
function clearPriceSource(car) {
  const el_ps = el(car + '-price-source');
  if (!el_ps) return;
  el_ps.textContent = '';
  el_ps.className = 'price-source';
}

/* ── Live fuel prices ───────────────────────────────────────────────────────── */
async function loadFuelPrices() {
  try {
    const res = await fetch('/api/fuel-prices');
    if (!res.ok) return;
    const fp = await res.json();

    // Populate the assumption fields with current prices
    if (fp.petrol)      el('pp').value    = fp.petrol;
    if (fp.diesel)      el('dp').value    = fp.diesel;
    if (fp.electricity) el('ep').value    = fp.electricity;
    if (fp.ruc_diesel)  el('ruc-d').value = fp.ruc_diesel;
    if (fp.ruc_ev)      el('ruc-e').value = fp.ruc_ev;

    // Show the updated date next to the section title
    if (fp.updated) {
      const dateEl = document.getElementById('fuel-prices-date');
      if (dateEl) {
        const d = new Date(fp.updated);
        dateEl.textContent = 'Updated ' + d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' });
      }
    }
  } catch (e) {
    console.warn('Could not load fuel prices:', e);
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
  // Safe setter — only update elements that exist in the DOM
  function safeHref(id, url) {
    const elem = el(id);
    if (elem) elem.href = url;
  }

  safeHref(car + '-ins-quashed', 'https://www.quashed.co.nz/');
  // AA, AMI, Tower commented out in HTML until working links confirmed
  // safeHref(car + '-ins-aa',      'https://www.aainsurance.co.nz/car-insurance/get-a-quote');
  // safeHref(car + '-ins-ami',     'https://www.ami.co.nz/insurance/car-insurance/');
  // safeHref(car + '-ins-tower',   'https://www.tower.co.nz/insurance/car-insurance/');

  const insEl = el(car + '-insurance');
  if (insEl) insEl.style.display = 'block';
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

  // Submodel as subtitle if available
  el(car + '-vname').textContent = v.name || 'Unknown';
  const odoDisplay = v.odometer && parseInt(v.odometer) > 0
    ? parseInt(v.odometer).toLocaleString() + ' km on clock'
    : null;
  el(car + '-vmeta').textContent = [
    v.submodel || '',
    v.bodyType ? v.bodyType : '',
    v.seats    ? v.seats + ' seats' : '',
    v.cc       ? v.cc + 'cc' : '',
    v.power    ? v.power : '',
    v.trans    ? v.trans : '',
    odoDisplay || '',
    v.owners   ? v.owners + ' prev. owners' : '',
    v.origin   ? 'Made in ' + v.origin : ''
  ].filter(Boolean).join(' · ');

  // CO2 stars
  let co2StarsHtml = '';
  if (v.co2Stars) {
    co2StarsHtml = '<span class="tag tag-neutral">CO₂ ';
    for (let i = 1; i <= 6; i++) co2StarsHtml += i <= v.co2Stars ? '★' : '☆';
    co2StarsHtml += ' ' + v.co2Stars + '/6</span>';
  }

  // Economy & fuel info pills
  let econHtml = '';
  if (v.l100 && v.l100 > 0) econHtml += `<span class="tag tag-neutral">${v.l100} L/100km</span>`;
  if (v.kwh  && v.kwh  > 0) econHtml += `<span class="tag tag-neutral">${v.kwh} kWh/100km</span>`;
  if (v.electricRange && v.electricRange > 0) econHtml += `<span class="tag tag-ev">${v.electricRange}km range</span>`;

  // Safety test note
  let safetyNote = '';
  if (v.safetyTest) safetyNote = `<div class="banner-safety-note">${v.safetyTest}</div>`;

  el(car + '-vtags').innerHTML =
    `<span class="tag ${fuelTagClass[ft] || ''}">${fuelLabels[ft] || ft}</span>` +
    `<span class="tag ${co2cls}">${co2txt}</span>` +
    econHtml +
    (v.notes ? `<span class="tag tag-neutral">${v.notes}</span>` : '') +
    stars + safety + co2StarsHtml +
    safetyNote;

  const make  = (v.make  || '').toLowerCase().replace(/\s+/g, '-');
  const model = (v.model || '').toLowerCase().replace(/\s+/g, '-');
  const tmEl = el(car + '-trademe');
  if (tmEl) {
    tmEl.href = make && model
      ? 'https://www.trademe.co.nz/a/motors/cars/' + make + '/' + model
      : make
      ? 'https://www.trademe.co.nz/a/motors/cars/' + make
      : 'https://www.trademe.co.nz/a/motors/cars';
  }

  // Insurance links
  buildInsuranceLinks(car, v.make || '', v.model || '', v.year || '');

  el(car + '-banner').classList.add('show');
}

function hideBanner(car) {
  el(car + '-banner').classList.remove('show');
  clearPriceSource(car);
  el(car + '-insurance').style.display = 'none';
}

function setStatus(car, msg, cls) {
  el(car + '-status').textContent  = msg;
  el(car + '-status').className    = 'status-line' + (cls ? ' ' + cls : '');
}

/* ── Fuel UI ───────────────────────────────────────────────────────────────── */
function updateFuelUI(car) {
  const fuelSel = el(car + '-fuel');
  if (!fuelSel) return;
  const f = fuelSel.value;
  const liq  = el(car + '-liq');
  const elec = el(car + '-elec');
  const phev = el(car + '-phev');
  if (liq)  liq.classList.toggle('show',  ['petrol','diesel','hybrid'].includes(f));
  if (elec) elec.classList.toggle('show', f === 'ev');
  if (phev) phev.classList.toggle('show', f === 'phev');
  // Show/hide EV info panel for main cards only
  if (car === 'a' || car === 'b') {
    const panel = el(car + '-ev-panel');
    if (panel) panel.classList.toggle('hidden', f !== 'ev' && f !== 'phev');
  }
}
el('a-fuel').addEventListener('change', () => updateFuelUI('a'));
el('b-fuel').addEventListener('change', () => updateFuelUI('b'));
updateFuelUI('a');
updateFuelUI('b');


/* ── EV Info Panel ──────────────────────────────────────────────────────────── */
const EV_FAQ = [
  { q: 'Do I need special equipment at home?', a: 'Every EV comes with a standard 3-pin plug charger — you can use any household socket. For faster charging, a wallbox installed by a licensed electrician is recommended. A 7kW wallbox charges most EVs overnight and costs around $800–$1,500 installed. EECA maintains an <a href="https://www.eeca.govt.nz/regulations/voluntary-guidance/ev-smart-charger-approved-list/" target="_blank" rel="noopener">approved list of smart home chargers</a>.' },
  { q: 'What if I live in an apartment or rental?', a: "Relying on public charging is workable in cities but less convenient than home charging. Check with your body corporate or landlord — new rules from 2026 make it easier to install EV chargers in apartment buildings. Ask before you buy." },
  { q: 'Where do I find public charging stations?', a: 'Use <a href="https://www.plugshare.com/" target="_blank" rel="noopener">PlugShare</a> (shows all charger types, community-updated) or <a href="https://www.chargenet.nz/map" target="_blank" rel="noopener">ChargeNet map</a> (NZ&#39;s largest fast-charging network). NZ has around 1,800 public charge points, with the government targeting 10,000 by 2030.' },
  { q: 'What happens if I run the battery to 0%?', a: "EVs don't let the battery reach true 0% — they reserve a buffer and warn you well before empty. If you do run out, roadside assistance will tow you to a charger. In practice this is rare; most owners charge at home nightly and never come close to empty." },
  { q: 'How does real-world range compare to the rated figure?', a: 'Expect 10–25% less than the WLTP-rated range in everyday driving. Cold weather, motorway speeds, and heating/AC all reduce range. If a car is rated 400km, plan around 300–340km between charges to be comfortable.' },
  { q: 'What does it actually cost to charge?', a: 'Home charging off-peak can cost the equivalent of around $1.00–$1.50/litre of petrol. Public fast chargers cost more — roughly equivalent to $2.00–$2.50/litre. The comparison above calculates this using your electricity rate.' },
  { q: 'What about battery longevity?', a: "Most manufacturers warranty the battery for 8 years or 160,000km at a minimum of 70% capacity. To extend battery life, avoid routinely charging to 100% — charging to 80% for daily use is common practice." },
  { q: 'For PHEVs — how does the split work?', a: "A PHEV has a plug-in battery (typically 30–80km of pure electric range) plus a petrol engine. If you charge regularly and your daily trips are short, you can run mostly on electricity. For longer trips the petrol engine kicks in automatically." },
];

function initEVPanel(car) {
  const toggle = el(car + '-ev-toggle');
  const body   = el(car + '-ev-body');
  if (!toggle || !body) return;
  body.innerHTML = '<div class="ev-faq">' +
    EV_FAQ.map(item =>
      '<div class="ev-faq-item"><div class="ev-faq-q">' + item.q + '</div><div class="ev-faq-a">' + item.a + '</div></div>'
    ).join('') + '</div>' +
    '<div class="ev-links">' +
    '<a class="ev-link-btn" href="https://www.genless.govt.nz/for-everyone/on-the-move/electric-vehicles/" target="_blank" rel="noopener">⚡ EECA EV Guide</a>' +
    '<a class="ev-link-btn" href="https://www.chargenet.nz/map" target="_blank" rel="noopener">🗺 ChargeNet Map</a>' +
    '<a class="ev-link-btn" href="https://www.plugshare.com/" target="_blank" rel="noopener">🔌 PlugShare</a>' +
    '</div>';
  toggle.addEventListener('click', () => {
    const isOpen = !body.classList.contains('hidden');
    body.classList.toggle('hidden', isOpen);
    const arrow = toggle.querySelector('.ev-panel-arrow');
    if (arrow) arrow.classList.toggle('open', !isOpen);
  });
}
initEVPanel('a');
initEVPanel('b');

/* ── Multi-car comparison ────────────────────────────────────────────────────── */
const extraCars = [];
const MAX_EXTRA = 3;
const EXTRA_COLOURS = ['#c084fc','#f59e0b','#f87171'];
const EXTRA_LABELS  = ['Car C','Car D','Car E'];

function addExtraCar() {
  if (extraCars.length >= MAX_EXTRA) return;
  const idx = extraCars.length;
  const id  = 'x' + idx;
  const col = EXTRA_COLOURS[idx];
  const lbl = EXTRA_LABELS[idx];
  extraCars.push({ id, label: lbl, colour: col });

  const card = document.createElement('div');
  card.className = 'car-card-extra';
  card.id = 'card-' + id;
  card.innerHTML =
    '<div class="extra-card-stripe" style="background:linear-gradient(90deg,' + col + ',' + col + '44)"></div>' +
    '<button class="remove-car-btn" data-id="' + id + '">✕ Remove</button>' +
    '<div class="extra-card-top">' +
      '<div class="car-pill" style="background:' + col + '18;color:' + col + ';border:1px solid ' + col + '44;margin-bottom:10px">⬤ ' + lbl + '</div>' +
      '<div class="plate-row" style="margin-bottom:6px">' +
        '<input class="plate-input" id="' + id + '-plate-input" placeholder="Enter plate…" maxlength="8" autocomplete="off">' +
        '<button class="action-btn" id="' + id + '-lbtn" style="background:' + col + '18;color:' + col + '">Look up</button>' +
      '</div>' +
      '<div class="status-line" id="' + id + '-status"></div>' +
      '<div class="vbanner" id="' + id + '-banner" style="display:none">' +
        '<div class="vb-name" id="' + id + '-vname"></div>' +
        '<div class="vb-meta" id="' + id + '-vmeta"></div>' +
      '</div>' +
    '</div>' +
    '<div class="extra-card-fields">' +
      '<div class="field"><label>Purchase price (NZD)</label><input type="number" id="' + id + '-price" value="30000" step="500" min="0"></div>' +
      '<div class="field"><label>Fuel type</label><select id="' + id + '-fuel">' +
        '<option value="petrol">Petrol</option><option value="diesel">Diesel</option>' +
        '<option value="ev">Electric (EV)</option><option value="hybrid">Hybrid</option>' +
        '<option value="phev">Plug-in Hybrid (PHEV)</option>' +
      '</select></div>' +
      '<div class="fsub show" id="' + id + '-liq"><div class="field"><label>Fuel use (L/100km)</label><input type="number" id="' + id + '-l100" value="7.5" step="0.1" min="0"></div></div>' +
      '<div class="fsub" id="' + id + '-elec"><div class="field"><label>Electricity use (kWh/100km)</label><input type="number" id="' + id + '-kwh" value="17" step="0.5" min="0"></div></div>' +
      '<div class="fsub" id="' + id + '-phev">' +
        '<div class="field"><label>Petrol use (L/100km)</label><input type="number" id="' + id + '-pl100" value="5" step="0.1" min="0"></div>' +
        '<div class="field"><label>kWh/100km electric</label><input type="number" id="' + id + '-pkwh" value="18" step="0.5" min="0"></div>' +
        '<div class="field"><label>% driven on electric</label><input type="number" id="' + id + '-ppct" value="50" step="5" min="0" max="100"></div>' +
      '</div>' +
    '</div>';

  el('extra-cars-grid').appendChild(card);
  el(id + '-fuel').addEventListener('change', () => updateFuelUI(id));
  el(id + '-lbtn').addEventListener('click', () => lookupExtraPlate(id));
  el(id + '-plate-input').addEventListener('keydown', e => { if (e.key === 'Enter') lookupExtraPlate(id); });
  el(id + '-plate-input').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase(); });
  card.querySelector('.remove-car-btn').addEventListener('click', () => removeExtraCar(id));
  if (extraCars.length >= MAX_EXTRA) {
    el('add-car-btn').disabled = true;
    el('add-car-hint').textContent = 'Maximum of 5 cars reached';
  }
}

async function lookupExtraPlate(id) {
  const plate = el(id + '-plate-input').value.trim().toUpperCase().replace(/\s/g, '');
  if (!plate) return;
  const btn = el(id + '-lbtn');
  btn.disabled = true; btn.textContent = '…';
  el(id + '-status').textContent = 'Looking up ' + plate + '…';
  el(id + '-status').className = 'status-line s-load';
  try {
    const res = await fetch('/api/lookup/' + encodeURIComponent(plate));
    const v = await res.json();
    if (!res.ok) throw new Error(v.error || 'Not found');
    el(id + '-vname').textContent = v.name || plate;
    el(id + '-vmeta').textContent = [v.bodyType, v.trans, v.seats ? v.seats + ' seats' : ''].filter(Boolean).join(' · ');
    el(id + '-banner').style.display = 'block';
    el(id + '-fuel').value = v.fuelType || 'petrol';
    updateFuelUI(id);
    if (v.adjustedPrice || v.price) el(id + '-price').value = v.adjustedPrice || v.price;
    if (v.l100) el(id + '-l100').value = v.l100;
    if (v.kwh)  el(id + '-kwh').value  = v.kwh;
    el(id + '-status').textContent = '✓ Found'; el(id + '-status').className = 'status-line s-ok';
  } catch(e) {
    el(id + '-status').textContent = '✗ ' + e.message; el(id + '-status').className = 'status-line s-err';
  } finally { btn.disabled = false; btn.textContent = 'Look up'; }
}

function removeExtraCar(id) {
  const idx = extraCars.findIndex(c => c.id === id);
  if (idx !== -1) extraCars.splice(idx, 1);
  const card = el('card-' + id);
  if (card) card.remove();
  el('add-car-btn').disabled = false;
  el('add-car-hint').textContent = 'Compare up to 5 cars — Car A is always the baseline';
  const section = document.getElementById('multi-results-section');
  if (section && extraCars.length === 0) section.remove();
}

function runningCostById(id) {
  const km = val('km'), pp = val('pp'), dp = val('dp'), ep = val('ep');
  const f = el(id + '-fuel') ? el(id + '-fuel').value : 'petrol';
  if (f === 'ev')     return (val(id+'-kwh')/100)*km*ep + (km/1000)*val('ruc-e');
  if (f === 'diesel') return (val(id+'-l100')/100)*km*dp + (km/1000)*val('ruc-d');
  if (f === 'hybrid') return (val(id+'-l100')/100)*km*pp;
  if (f === 'phev') { const p=val(id+'-ppct')/100; return p*(val(id+'-pkwh')/100)*km*ep+(1-p)*(val(id+'-pl100')/100)*km*pp; }
  return (val(id+'-l100')/100)*km*pp;
}

function renderMultiResults(yrs, km, pA, rA, pB, rB) {
  const allCars = [
    { label: state.a.name || 'Car A', total: Math.round(pA+rA*yrs), annual: Math.round(rA), price: pA, colour: '#3b82f6' },
    { label: state.b.name || 'Car B', total: Math.round(pB+rB*yrs), annual: Math.round(rB), price: pB, colour: '#0ecfb0' },
    ...extraCars.map(c => {
      const rc = runningCostById(c.id);
      const p  = val(c.id+'-price');
      return { label: c.label, total: Math.round(p+rc*yrs), annual: Math.round(rc), price: p, colour: c.colour };
    })
  ];
  if (allCars.length <= 2) { const s=document.getElementById('multi-results-section'); if(s) s.remove(); return; }

  const ranked = allCars.slice().sort((a,b) => a.total - b.total);
  const badges = ['badge-1','badge-2','badge-3','badge-4','badge-5'];

  const rows =
    '<tr><th>Metric</th>' + allCars.map((c,i) => {
      const rank = ranked.findIndex(r => r.label===c.label)+1;
      const name = c.label.length>16 ? c.label.slice(0,14)+'…' : c.label;
      return '<th style="color:' + c.colour + '">' + name + ' <span class="multi-rank-badge ' + badges[rank-1] + '">#' + rank + '</span></th>';
    }).join('') + '</tr>' +
    '<tr><td>Purchase price</td>' + allCars.map(c=>'<td>$'+c.price.toLocaleString()+'</td>').join('') + '</tr>' +
    '<tr><td>Annual running</td>' + allCars.map(c=>'<td>$'+c.annual.toLocaleString()+'</td>').join('') + '</tr>' +
    '<tr class="total-row"><td><strong>Total over '+yrs+' yrs</strong></td>' + allCars.map(c => {
      const rank = ranked.findIndex(r=>r.label===c.label)+1;
      return '<td class="'+(rank===1?'multi-rank-1':'')+'">$'+c.total.toLocaleString()+'</td>';
    }).join('') + '</tr>' +
    '<tr><td>vs best option</td>' + allCars.map(c => {
      const diff = c.total - ranked[0].total;
      return diff===0 ? '<td class="multi-rank-1">Best ✓</td>' : '<td style="color:#f87171">+$'+diff.toLocaleString()+'</td>';
    }).join('') + '</tr>';

  let section = document.getElementById('multi-results-section');
  if (!section) {
    section = document.createElement('div');
    section.id = 'multi-results-section';
    section.className = 'multi-results';
    const tabsCard = document.querySelector('.tabs-card');
    if (tabsCard) tabsCard.parentNode.insertBefore(section, tabsCard);
  }
  section.innerHTML = '<div class="multi-results-title">All cars ranked — ' + yrs + ' year projection at ' + km.toLocaleString() + ' km/yr</div><div style="overflow-x:auto"><table class="multi-table">' + rows + '</table></div>';
}

el('add-car-btn').addEventListener('click', addExtraCar);

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
  // Labels are now drawn inline on the chart canvas

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

  // Inline label plugin — draws car names at the end of each line
  const inlineLabelPlugin = {
    id: 'inlineLabels',
    afterDatasetsDraw(chart) {
      const ctx    = chart.ctx;
      const meta0  = chart.getDatasetMeta(0);
      const meta1  = chart.getDatasetMeta(1);
      const last0  = meta0.data[meta0.data.length - 1];
      const last1  = meta1.data[meta1.data.length - 1];
      if (!last0 || !last1) return;

      const isDark = document.documentElement.dataset.theme === 'dark';
      const labelBg = isDark ? 'rgba(22,27,34,0.88)' : 'rgba(255,255,255,0.88)';

      [[last0, '#3b82f6', nA], [last1, '#0ecfb0', nB]].forEach(([pt, colour, name], i) => {
        const x = pt.x;
        const y = pt.y;

        // Determine vertical offset — push apart if lines are close at the end
        const gap = last0.y - last1.y;
        let yOff = i === 0
          ? (gap > -30 ? -28 : -14)   // Car A label above its line end
          : (gap < 30  ?  28 :  14);   // Car B label below its line end

        // Dot at line end
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = colour;
        ctx.fill();

        // Small vertical tick from dot to label
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + yOff * 0.55);
        ctx.strokeStyle = colour;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 2]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Measure label text
        const label    = name.length > 22 ? name.slice(0, 20) + '…' : name;
        const fontSize = 11;
        ctx.font       = `700 ${fontSize}px DM Sans, sans-serif`;
        const tw       = ctx.measureText(label).width;
        const pad      = 6;
        const lx       = Math.min(x - tw / 2, chart.width - tw - pad * 2 - 4);
        const ly       = y + yOff;

        // Pill background
        ctx.beginPath();
        ctx.roundRect(lx - pad, ly - fontSize / 2 - pad * 0.6, tw + pad * 2, fontSize + pad * 1.2, 4);
        ctx.fillStyle = labelBg;
        ctx.fill();
        ctx.strokeStyle = colour;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Label text
        ctx.fillStyle = colour;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, lx, ly);

        ctx.restore();
      });
    }
  };

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
      layout: { padding: { right: 16 } },
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
    },
    plugins: [inlineLabelPlugin]
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

  // Helper to highlight the better value in green
  const better = (aVal, bVal, lowerIsBetter=true) => {
    if (!aVal || !bVal || aVal === '—' || bVal === '—') return ['',''];
    const aN = parseFloat(String(aVal).replace(/[^0-9.]/g,'')),
          bN = parseFloat(String(bVal).replace(/[^0-9.]/g,''));
    if (isNaN(aN) || isNaN(bN) || aN === bN) return ['',''];
    const aWins = lowerIsBetter ? aN < bN : aN > bN;
    return aWins ? ['win-a',''] : ['','win-b'];
  };

  el('detail-table').innerHTML =
    `<tr><th>Specification</th><th>${nA}</th><th>${nB}</th></tr>` +

    cat('🚗 Vehicle details') +
    r2('Make',            state.a.make     || '—', state.b.make     || '—') +
    r2('Model',           state.a.model    || '—', state.b.model    || '—') +
    r2('Variant',         state.a.submodel || '—', state.b.submodel || '—') +
    r2('Year',            state.a.year     || '—', state.b.year     || '—') +
    r2('Body type',       state.a.bodyType || '—', state.b.bodyType || '—') +
    r2('Seats',           state.a.seats    || '—', state.b.seats    || '—') +
    r2('Transmission',    state.a.trans    || '—', state.b.trans    || '—') +
    r2('Engine size',     state.a.cc  ? state.a.cc  + 'cc' : '—', state.b.cc  ? state.b.cc  + 'cc' : '—') +
    r2('Power output',    state.a.power || '—', state.b.power || '—') +
    r2('Country of origin',state.a.origin || '—', state.b.origin || '—') +
    r2('Previous owners', state.a.owners || '—', state.b.owners || '—') +

    cat('⛽ Economy & environment') +
    r2('Fuel type',            state.a.fuelType, state.b.fuelType) +
    (() => { const [wa,wb]=better(val('a-l100')||null,val('b-l100')||null,true); return `<tr><td>Fuel consumption</td><td class="${wa}">${val('a-l100')>0?val('a-l100').toFixed(1)+' L/100km':'—'}</td><td class="${wb}">${val('b-l100')>0?val('b-l100').toFixed(1)+' L/100km':'—'}</td></tr>`; })() +
    (() => { const [wa,wb]=better(val('a-kwh')||null,val('b-kwh')||null,true); return `<tr><td>Electric consumption</td><td class="${wa}">${val('a-kwh')>0?val('a-kwh')+' kWh/100km':'—'}</td><td class="${wb}">${val('b-kwh')>0?val('b-kwh')+' kWh/100km':'—'}</td></tr>`; })() +
    r2('Electric range',       state.a.electricRange ? state.a.electricRange+'km' : '—', state.b.electricRange ? state.b.electricRange+'km' : '—') +
    (() => { const [wa,wb]=better(co2A||null,co2B||null,true); return `<tr><td>CO₂ (tailpipe)</td><td class="${wa}">${co2A===0?'Zero 🌱':co2A+' g/km'}</td><td class="${wb}">${co2B===0?'Zero 🌱':co2B+' g/km'}</td></tr>`; })() +
    (() => { const [wa,wb]=better(annA||null,annB||null,true); return `<tr><td>Annual CO₂</td><td class="${wa}">${co2A===0?'Zero':annA.toLocaleString()+' kg'}</td><td class="${wb}">${co2B===0?'Zero':annB.toLocaleString()+' kg'}</td></tr>`; })() +
    r2('Annual CO₂ (tonnes)',  state.a.yearlyCo2 ? state.a.yearlyCo2+'t' : '—', state.b.yearlyCo2 ? state.b.yearlyCo2+'t' : '—') +
    (() => { const [wa,wb]=better(state.a.stars||null,state.b.stars||null,false); return `<tr><td>Economy rating</td><td class="${wa}">${st(state.a.stars,6)}</td><td class="${wb}">${st(state.b.stars,6)}</td></tr>`; })() +
    (() => { const [wa,wb]=better(state.a.co2Stars||null,state.b.co2Stars||null,false); return `<tr><td>CO₂ rating</td><td class="${wa}">${st(state.a.co2Stars,6)}</td><td class="${wb}">${st(state.b.co2Stars,6)}</td></tr>`; })() +

    cat('🛡 Safety') +
    (() => { const [wa,wb]=better(state.a.safety||null,state.b.safety||null,false); return `<tr><td>Safety rating (ANCAP)</td><td class="${wa}">${st(state.a.safety,5)}</td><td class="${wb}">${st(state.b.safety,5)}</td></tr>`; })() +
    r2('Safety test basis',   state.a.safetyTest ? `<span style="font-size:11px">${state.a.safetyTest}</span>` : '—', state.b.safetyTest ? `<span style="font-size:11px">${state.b.safetyTest}</span>` : '—') +

    cat('💰 Costs at ' + km.toLocaleString() + ' km/yr') +
    r2('Purchase price',    '$' + pA.toLocaleString(), '$' + pB.toLocaleString()) +
    (() => { const [wa,wb]=better(rA,rB,true); return `<tr><td>Annual running cost</td><td class="${wa}">$${Math.round(rA).toLocaleString()}</td><td class="${wb}">$${Math.round(rB).toLocaleString()}</td></tr>`; })() +
    (() => { const [wa,wb]=better(rA/km*100,rB/km*100,true); return `<tr><td>Cost per 100km</td><td class="${wa}">$${(rA/km*100).toFixed(2)}</td><td class="${wb}">$${(rB/km*100).toFixed(2)}</td></tr>`; })() +
    (() => { const tA=Math.round(pA+rA*5),tB=Math.round(pB+rB*5); const [wa,wb]=better(tA,tB,true); return `<tr><td>5-year total</td><td class="${wa}">$${tA.toLocaleString()}</td><td class="${wb}">$${tB.toLocaleString()}</td></tr>`; })() +
    (() => { const tA=Math.round(pA+rA*yrs),tB=Math.round(pB+rB*yrs); const [wa,wb]=better(tA,tB,true); return `<tr class="total-row"><td>${yrs}-year total</td><td class="${wa}">$${tA.toLocaleString()}</td><td class="${wb}">$${tB.toLocaleString()}</td></tr>`; })();

  // Reveal results with animation
  const resultsEl = el('results');
  resultsEl.classList.remove('hidden');
  resultsEl.classList.remove('results-enter');
  void resultsEl.offsetWidth;
  resultsEl.classList.add('results-enter');
  setTimeout(() => resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);

  // Multi-car ranked table (only shown when extra cars exist)
  renderMultiResults(yrs, km, pA, rA, pB, rB);
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
    await loadFuelPrices();
  } catch (e) {
    console.error('Init failed:', e);
  }
  // Cascade listeners attach immediately; fleet data loads lazily on first use
  initCascade('a');
  initCascade('b');
  // Pre-fetch fleet makes in background so first search is instant
  loadFleetMakes().catch(() => {});

  updateKm();
  restoreFromURL();
}

init();

