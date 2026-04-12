/**
 * NZ Car Comparator — Spreadsheet-driven version
 *
 * Vehicle data is read from a published Google Sheets CSV.
 * Set SHEET_URL environment variable to your published sheet URL.
 * Without SHEET_URL the app uses built-in fallback data.
 *
 * Usage:
 *   node server.js
 *   SHEET_URL=https://docs.google.com/... node server.js
 */

import express from 'express';
import NodeCache from 'node-cache';

const app = express();
const cache = new NodeCache({ stdTTL: 60 }); // refresh data every 60 seconds

const SHEET_URL = process.env.SHEET_URL || '';
const PORT = process.env.PORT || 3001;

// ─── Fallback vehicle data ────────────────────────────────────────────────────
const FALLBACK_VEHICLES = [
  { plate:'ABC123', name:'2021 Toyota Corolla',             fuelType:'petrol', price:25000, l100:6.8,  kwh:null, co2:158, stars:3.5, notes:'Most popular NZ petrol car' },
  { plate:'MAZDA1', name:'2019 Mazda CX-5',                fuelType:'petrol', price:22000, l100:7.6,  kwh:null, co2:177, stars:3.0, notes:'Popular family SUV' },
  { plate:'UTE001', name:'2021 Ford Ranger XLT',           fuelType:'diesel', price:45000, l100:8.1,  kwh:null, co2:213, stars:2.0, notes:'Includes RUC in running cost' },
  { plate:'SUV999', name:'2020 Toyota RAV4 Hybrid',        fuelType:'hybrid', price:38000, l100:5.4,  kwh:null, co2:123, stars:4.5, notes:'Self-charging hybrid' },
  { plate:'HONDA1', name:'2020 Honda CR-V Hybrid',         fuelType:'hybrid', price:35000, l100:5.8,  kwh:null, co2:132, stars:4.0, notes:'Strong hybrid, no plug needed' },
  { plate:'EV2024', name:'2023 Tesla Model 3',             fuelType:'ev',     price:59000, l100:null, kwh:14.9, co2:0,   stars:6.0, notes:'Long range, fastest charging' },
  { plate:'LEAF22', name:'2022 Nissan Leaf e+',            fuelType:'ev',     price:39000, l100:null, kwh:17.2, co2:0,   stars:6.0, notes:'62kWh battery, great range' },
  { plate:'BYD001', name:'2024 BYD Atto 3',               fuelType:'ev',     price:45000, l100:null, kwh:15.4, co2:0,   stars:6.0, notes:'Great value EV, 5-star ANCAP' },
  { plate:'MG4EV',  name:'2023 MG4 EV',                   fuelType:'ev',     price:38000, l100:null, kwh:16.0, co2:0,   stars:6.0, notes:'Budget-friendly EV option' },
  { plate:'PHEV01', name:'2022 Mitsubishi Outlander PHEV', fuelType:'phev',   price:62000, l100:1.9,  kwh:22.0, co2:43,  stars:5.5, notes:'Best-selling PHEV in NZ' },
  { plate:'PRIUS1', name:'2023 Toyota Prius PHEV',         fuelType:'phev',   price:52000, l100:1.0,  kwh:20.0, co2:22,  stars:5.5, notes:'Ultra-low emissions PHEV' },
  { plate:'GWM001', name:'2023 GWM Tank 300',              fuelType:'petrol', price:55000, l100:11.2, kwh:null, co2:258, stars:1.5, notes:'Heavy SUV, high fuel use' },
  { plate:'SUBR1',  name:'2021 Subaru Forester',           fuelType:'petrol', price:40000, l100:8.4,  kwh:null, co2:195, stars:2.5, notes:'AWD family wagon' },
  { plate:'KIA001', name:'2023 Kia EV6',                   fuelType:'ev',     price:69000, l100:null, kwh:16.5, co2:0,   stars:6.0, notes:'Fast charging, sporty EV' },
  { plate:'ISUZU1', name:'2022 Isuzu D-Max',               fuelType:'diesel', price:62000, l100:9.3,  kwh:null, co2:244, stars:1.5, notes:'Heavy-duty ute, high RUC' },
];

// ─── Parse CSV from Google Sheets ─────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  // Find the header row — look for the row containing "Plate"
  let headerIdx = lines.findIndex(l => /plate/i.test(l));
  if (headerIdx === -1) headerIdx = 0;

  const headers = lines[headerIdx].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());

  const rows = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    // Simple CSV split (handles quoted fields)
    const vals = [];
    let cur = '', inQ = false;
    for (const ch of lines[i] + ',') {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }

    const get = key => {
      const idx = headers.indexOf(key);
      return idx >= 0 ? (vals[idx] || '').replace(/"/g, '').trim() : '';
    };
    const num = key => { const n = parseFloat(get(key)); return isNaN(n) ? null : n; };

    const plate = get('plate').toUpperCase();
    if (!plate) continue;

    const year = get('year');
    const make = get('make').toUpperCase();
    const model = get('model').toUpperCase();

    rows.push({
      plate,
      name:     get('display name') || [year, make, model].filter(Boolean).join(' '),
      fuelType: (get('fuel type') || 'petrol').toLowerCase(),
      price:    num('purchase price ($nzd)') || num('purchase price') || 25000,
      l100:     num('fuel use (l/100km)') || num('fuel use'),
      kwh:      num('electric use (kwh/100km)') || num('electric use'),
      co2:      num('co2 (g/km)') || num('co2') || 0,
      stars:    num('economy stars'),
      notes:    get('notes'),
    });
  }
  return rows;
}

// ─── Load vehicles ────────────────────────────────────────────────────────────
async function getVehicles() {
  const hit = cache.get('vehicles');
  if (hit) return hit;

  if (!SHEET_URL) {
    cache.set('vehicles', FALLBACK_VEHICLES);
    return FALLBACK_VEHICLES;
  }

  try {
    const res = await fetch(SHEET_URL);
    if (!res.ok) throw new Error('Sheet fetch HTTP ' + res.status);
    const text = await res.text();
    const vehicles = parseCSV(text);
    if (vehicles.length === 0) throw new Error('No vehicles parsed');
    console.log('[sheet] Loaded ' + vehicles.length + ' vehicles');
    cache.set('vehicles', vehicles);
    return vehicles;
  } catch (err) {
    console.warn('[sheet] Error, using fallback:', err.message);
    cache.set('vehicles', FALLBACK_VEHICLES, 30);
    return FALLBACK_VEHICLES;
  }
}

// ─── API ──────────────────────────────────────────────────────────────────────
app.get('/api/vehicles', async (_req, res) => {
  res.json(await getVehicles());
});

app.get('/api/health', async (_req, res) => {
  const v = await getVehicles();
  res.json({ ok: true, vehicleCount: v.length, sheetConnected: !!SHEET_URL });
});

app.get('/', (_req, res) => res.send(HTML));

app.listen(PORT, () => {
  console.log('\n  NZ Car Comparator');
  console.log('  ─────────────────');
  console.log(SHEET_URL ? '  Sheet: connected' : '  Sheet: not set — using built-in demo data');
  console.log('  Open: http://localhost:' + PORT + '\n');
});

// ─── Frontend HTML ────────────────────────────────────────────────────────────
const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>NZ Car Comparator</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"><\/script>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --blue: #2563eb; --blue-light: #dbeafe; --blue-mid: #1d4ed8;
  --green: #059669; --green-light: #d1fae5; --green-mid: #047857;
  --gray-50: #f9fafb; --gray-100: #f3f4f6; --gray-200: #e5e7eb;
  --gray-400: #9ca3af; --gray-600: #4b5563; --gray-800: #1f2937; --gray-900: #111827;
  --radius: 10px; --radius-sm: 6px;
}
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--gray-50); color: var(--gray-800); }
header { background: var(--gray-900); padding: 16px 24px; }
header h1 { font-size: 19px; font-weight: 700; color: white; letter-spacing: -0.02em; }
header p { font-size: 12px; color: var(--gray-400); margin-top: 3px; }
main { max-width: 980px; margin: 0 auto; padding: 24px 16px 60px; }
.cars-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
.car-card { background: white; border: 1px solid var(--gray-200); border-radius: var(--radius); overflow: hidden; }
.car-card-top { border-top: 3px solid; padding: 14px 16px 12px; }
.car-a .car-card-top { border-color: var(--blue); }
.car-b .car-card-top { border-color: var(--green); }
.car-pill { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 10px; }
.car-a .car-pill { color: var(--blue-mid); }
.car-b .car-pill { color: var(--green-mid); }
.select-wrap label { display: block; font-size: 11px; font-weight: 600; color: var(--gray-400); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px; }
select.vsel { width: 100%; border: 1.5px solid var(--gray-200); border-radius: var(--radius-sm); padding: 9px 32px 9px 12px; font-size: 14px; font-weight: 500; outline: none; cursor: pointer; background: white url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239ca3af' d='M6 8L1 3h10z'/%3E%3C/svg%3E") no-repeat right 12px center; appearance: none; transition: border-color .15s; }
.car-a select.vsel:focus { border-color: var(--blue); }
.car-b select.vsel:focus { border-color: var(--green); }
.vbanner { margin-top: 10px; background: var(--gray-50); border: 1px solid var(--gray-200); border-radius: var(--radius-sm); padding: 10px 12px; display: none; }
.vbanner.show { display: block; }
.vname { font-size: 14px; font-weight: 600; margin-bottom: 3px; }
.vmeta { font-size: 12px; color: var(--gray-600); line-height: 1.5; }
.stars-row { display: flex; align-items: center; gap: 8px; margin-top: 5px; flex-wrap: wrap; }
.co2-pill { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 20px; }
.c-zero { background: #d1fae5; color: #065f46; }
.c-low  { background: #d1fae5; color: #065f46; }
.c-mid  { background: #fef3c7; color: #92400e; }
.c-high { background: #fee2e2; color: #991b1b; }
.card-fields { padding: 12px 16px 16px; border-top: 1px solid var(--gray-100); }
.field { margin-bottom: 10px; }
.field label { display: block; font-size: 11px; font-weight: 600; color: var(--gray-400); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
.field input, .field select { width: 100%; border: 1.5px solid var(--gray-200); border-radius: var(--radius-sm); padding: 7px 10px; font-size: 14px; outline: none; background: white; transition: border-color .15s; }
.field input:focus { border-color: var(--blue); }
.fsub { display: none; }
.fsub.show { display: block; }
.assumptions-card { background: white; border: 1px solid var(--gray-200); border-radius: var(--radius); padding: 16px; margin-bottom: 20px; }
.agrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; }
.stitle { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--gray-400); margin-bottom: 12px; }
.calc-row { display: flex; justify-content: flex-end; margin-top: 12px; }
.calc-btn { background: var(--gray-900); color: white; border: none; border-radius: var(--radius-sm); padding: 10px 24px; font-size: 14px; font-weight: 600; cursor: pointer; }
.calc-btn:hover { background: #374151; }
#results { display: none; }
.mrow { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
.mc { background: white; border: 1px solid var(--gray-200); border-radius: var(--radius); padding: 14px 16px; }
.ml { font-size: 11px; color: var(--gray-400); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
.mv { font-size: 22px; font-weight: 700; }
.ms { font-size: 11px; color: var(--gray-400); margin-top: 2px; }
.tree-card { background: #064e3b; border-radius: var(--radius); padding: 18px 20px; margin-bottom: 16px; color: white; display: none; }
.tree-card.show { display: flex; align-items: flex-start; gap: 14px; }
.tree-icon { font-size: 36px; flex-shrink: 0; line-height: 1; }
.tree-body {}
.tree-label { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.6; margin-bottom: 5px; }
.tree-text { font-size: 15px; line-height: 1.6; }
.tree-text strong { font-size: 26px; font-weight: 800; color: #6ee7b7; display: block; margin-bottom: 2px; }
.co2-card { background: white; border: 1px solid var(--gray-200); border-radius: var(--radius); padding: 16px; margin-bottom: 16px; }
.co2-bars { display: flex; flex-direction: column; gap: 14px; margin-top: 12px; }
.co2-row { display: flex; align-items: center; gap: 12px; font-size: 13px; }
.co2-lbl { width: 190px; flex-shrink: 0; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.co2-track { flex: 1; background: var(--gray-100); border-radius: 4px; height: 24px; overflow: hidden; }
.co2-fill { height: 100%; border-radius: 4px; display: flex; align-items: center; padding-left: 8px; font-size: 11px; font-weight: 600; color: white; transition: width .6s ease; }
.co2-val { font-size: 12px; color: var(--gray-600); width: 80px; text-align: right; flex-shrink: 0; }
.chart-card { background: white; border: 1px solid var(--gray-200); border-radius: var(--radius); padding: 16px; margin-bottom: 16px; }
.chart-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 8px; }
.legend { display: flex; gap: 16px; }
.leg-item { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--gray-600); }
.leg-sw { width: 12px; height: 12px; border-radius: 3px; flex-shrink: 0; }
.be { font-size: 12px; font-weight: 600; padding: 5px 12px; border-radius: 20px; }
.be.cross { background: #dbeafe; color: #1d4ed8; }
.be.nocross { background: var(--gray-100); color: var(--gray-600); }
.table-card { background: white; border: 1px solid var(--gray-200); border-radius: var(--radius); padding: 16px; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th { text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--gray-400); padding: 6px 8px; border-bottom: 1px solid var(--gray-200); }
td { padding: 8px; border-bottom: 1px solid var(--gray-100); }
tr:last-child td { border-bottom: none; font-weight: 700; }
.wa { color: var(--blue-mid); }
.wb { color: var(--green-mid); }
.loader { text-align: center; padding: 60px; color: var(--gray-400); }
@media (max-width: 620px) {
  .cars-grid, .mrow { grid-template-columns: 1fr 1fr; }
  .co2-lbl { width: 110px; }
}
</style>
</head>
<body>
<header>
  <h1>NZ Car Comparator</h1>
  <p>Compare the true cost of owning any two NZ vehicles</p>
</header>
<main>
  <div id="loader" class="loader">Loading vehicles…</div>
  <div id="app" style="display:none">

    <div class="cars-grid">
      <div class="car-card car-a">
        <div class="car-card-top">
          <div class="car-pill">Car A</div>
          <div class="select-wrap">
            <label>Select vehicle</label>
            <select class="vsel" id="a-sel" onchange="pick('a')">
              <option value="">— choose a vehicle —</option>
            </select>
          </div>
          <div class="vbanner" id="a-ban">
            <div class="vname" id="a-nm"></div>
            <div class="vmeta" id="a-mt"></div>
            <div class="stars-row" id="a-st"></div>
          </div>
        </div>
        <div class="card-fields">
          <div class="field"><label>Purchase price (NZD)</label><input type="number" id="a-price" value="25000" min="0" step="500"></div>
          <div class="field"><label>Fuel type</label>
            <select id="a-fuel" onchange="uf('a')">
              <option value="petrol">Petrol</option><option value="diesel">Diesel</option>
              <option value="ev">Electric (EV)</option><option value="hybrid">Hybrid</option>
              <option value="phev">Plug-in Hybrid (PHEV)</option>
            </select>
          </div>
          <div class="fsub show" id="a-liq"><div class="field"><label>Fuel use (L/100km)</label><input type="number" id="a-l100" value="7.5" step="0.1" min="0"></div></div>
          <div class="fsub" id="a-elec"><div class="field"><label>Electricity use (kWh/100km)</label><input type="number" id="a-kwh" value="17" step="0.5" min="0"></div></div>
          <div class="fsub" id="a-phev">
            <div class="field"><label>Petrol use (L/100km)</label><input type="number" id="a-pl100" value="5" step="0.1" min="0"></div>
            <div class="field"><label>Electric use (kWh/100km)</label><input type="number" id="a-pkwh" value="18" step="0.5" min="0"></div>
            <div class="field"><label>% driven on electric</label><input type="number" id="a-ppct" value="50" step="5" min="0" max="100"></div>
          </div>
        </div>
      </div>

      <div class="car-card car-b">
        <div class="car-card-top">
          <div class="car-pill">Car B</div>
          <div class="select-wrap">
            <label>Select vehicle</label>
            <select class="vsel" id="b-sel" onchange="pick('b')">
              <option value="">— choose a vehicle —</option>
            </select>
          </div>
          <div class="vbanner" id="b-ban">
            <div class="vname" id="b-nm"></div>
            <div class="vmeta" id="b-mt"></div>
            <div class="stars-row" id="b-st"></div>
          </div>
        </div>
        <div class="card-fields">
          <div class="field"><label>Purchase price (NZD)</label><input type="number" id="b-price" value="38000" min="0" step="500"></div>
          <div class="field"><label>Fuel type</label>
            <select id="b-fuel" onchange="uf('b')">
              <option value="petrol">Petrol</option><option value="diesel">Diesel</option>
              <option value="ev" selected>Electric (EV)</option><option value="hybrid">Hybrid</option>
              <option value="phev">Plug-in Hybrid (PHEV)</option>
            </select>
          </div>
          <div class="fsub" id="b-liq"><div class="field"><label>Fuel use (L/100km)</label><input type="number" id="b-l100" value="7.5" step="0.1" min="0"></div></div>
          <div class="fsub show" id="b-elec"><div class="field"><label>Electricity use (kWh/100km)</label><input type="number" id="b-kwh" value="17" step="0.5" min="0"></div></div>
          <div class="fsub" id="b-phev">
            <div class="field"><label>Petrol use (L/100km)</label><input type="number" id="b-pl100" value="5" step="0.1" min="0"></div>
            <div class="field"><label>Electric use (kWh/100km)</label><input type="number" id="b-pkwh" value="18" step="0.5" min="0"></div>
            <div class="field"><label>% driven on electric</label><input type="number" id="b-ppct" value="50" step="5" min="0" max="100"></div>
          </div>
        </div>
      </div>
    </div>

    <div class="assumptions-card">
      <div class="stitle">Assumptions</div>
      <div class="agrid">
        <div class="field"><label>Annual km</label><input type="number" id="km" value="15000" step="1000" min="1000"></div>
        <div class="field"><label>Petrol ($/L)</label><input type="number" id="pp" value="2.50" step="0.05" min="0"></div>
        <div class="field"><label>Diesel ($/L)</label><input type="number" id="dp" value="1.85" step="0.05" min="0"></div>
        <div class="field"><label>Electricity ($/kWh)</label><input type="number" id="ep" value="0.30" step="0.01" min="0"></div>
        <div class="field"><label>RUC diesel ($/1000km)</label><input type="number" id="ruc-d" value="76" step="1" min="0"></div>
        <div class="field"><label>RUC EV ($/1000km)</label><input type="number" id="ruc-e" value="76" step="1" min="0"></div>
        <div class="field"><label>Years to project</label><input type="number" id="yrs" value="10" step="1" min="1" max="30"></div>
      </div>
      <div class="calc-row"><button class="calc-btn" onclick="calc()">Compare these cars</button></div>
    </div>

    <div id="results">
      <div class="mrow" id="metrics"></div>

      <div class="tree-card" id="tree-card">
        <div class="tree-icon">🌳</div>
        <div class="tree-body">
          <div class="tree-label">Environmental impact</div>
          <div class="tree-text" id="tree-text"></div>
        </div>
      </div>

      <div class="co2-card">
        <div class="stitle">CO₂ emissions</div>
        <div class="co2-bars" id="co2-bars"></div>
      </div>

      <div class="chart-card">
        <div class="chart-top">
          <div class="legend">
            <div class="leg-item"><div class="leg-sw" style="background:#2563eb"></div><span id="leg-a">Car A</span></div>
            <div class="leg-item"><div class="leg-sw" style="background:#059669"></div><span id="leg-b">Car B</span></div>
          </div>
          <div class="be nocross" id="be-badge">—</div>
        </div>
        <div style="position:relative;height:300px"><canvas id="chart"></canvas></div>
      </div>

      <div class="table-card">
        <div class="stitle">Cost breakdown at year <span id="mid-yr">5</span></div>
        <table id="breakdown"></table>
      </div>
    </div>
  </div>
</main>
<script>
let vehicles=[], chartInst=null;
const names={a:'Car A',b:'Car B'}, co2s={a:0,b:0};

async function init(){
  try{
    const r=await fetch('/api/vehicles');
    vehicles=await r.json();
    const opts=vehicles.map(v=>'<option value="'+v.plate+'">'+v.name+'</option>').join('');
    ['a','b'].forEach(c=>{
      document.getElementById(c+'-sel').innerHTML='<option value="">— choose a vehicle —</option>'+opts;
    });
    document.getElementById('loader').style.display='none';
    document.getElementById('app').style.display='block';
    if(vehicles.length>0){ document.getElementById('a-sel').value=vehicles[0].plate; pick('a'); }
    if(vehicles.length>5){ document.getElementById('b-sel').value=vehicles[5].plate; pick('b'); }
  }catch(e){
    document.getElementById('loader').textContent='Failed to load vehicles.';
  }
}

function starsHtml(s){
  if(!s)return '';
  let h='<span style="font-size:11px;color:#6B7280;"><strong style="color:#111827">Economy</strong> ';
  for(let i=1;i<=6;i++) h+='<span style="color:'+(i<=s?'#F59E0B':'#D1D5DB')+';font-size:14px;">★</span>';
  return h+' '+s+'/6</span>';
}

function co2Html(co2){
  if(co2===0) return '<span class="co2-pill c-zero">Zero emissions 🌱</span>';
  if(co2<120) return '<span class="co2-pill c-low">'+co2+' g/km CO₂</span>';
  if(co2<180) return '<span class="co2-pill c-mid">'+co2+' g/km CO₂</span>';
  return '<span class="co2-pill c-high">'+co2+' g/km CO₂</span>';
}

function pick(car){
  const plate=document.getElementById(car+'-sel').value;
  if(!plate)return;
  const v=vehicles.find(x=>x.plate===plate);
  if(!v)return;
  names[car]=v.name;
  co2s[car]=v.co2||0;
  document.getElementById(car+'-nm').textContent=v.name;
  document.getElementById(car+'-mt').textContent=
    [v.fuelType.charAt(0).toUpperCase()+v.fuelType.slice(1), v.notes].filter(Boolean).join(' · ');
  document.getElementById(car+'-st').innerHTML=starsHtml(v.stars)+' '+co2Html(v.co2||0);
  document.getElementById(car+'-ban').classList.add('show');
  document.getElementById(car+'-price').value=v.price||'';
  document.getElementById(car+'-fuel').value=v.fuelType||'petrol';
  uf(car);
  if(v.l100) document.getElementById(car+'-l100').value=v.l100;
  if(v.kwh)  document.getElementById(car+'-kwh').value=v.kwh;
  if(v.l100&&v.fuelType==='phev') document.getElementById(car+'-pl100').value=v.l100;
  if(v.kwh&&v.fuelType==='phev')  document.getElementById(car+'-pkwh').value=v.kwh;
}

function uf(car){
  const f=document.getElementById(car+'-fuel').value;
  document.getElementById(car+'-liq').classList.toggle('show',['petrol','diesel','hybrid'].includes(f));
  document.getElementById(car+'-elec').classList.toggle('show',f==='ev');
  document.getElementById(car+'-phev').classList.toggle('show',f==='phev');
}
uf('a'); uf('b');

function g(id){return parseFloat(document.getElementById(id).value)||0;}

function runCost(car){
  const km=g('km'),pp=g('pp'),dp=g('dp'),ep=g('ep');
  const f=document.getElementById(car+'-fuel').value;
  if(f==='ev')     return (g(car+'-kwh')/100)*km*ep+(km/1000)*g('ruc-e');
  if(f==='diesel') return (g(car+'-l100')/100)*km*dp+(km/1000)*g('ruc-d');
  if(f==='hybrid') return (g(car+'-l100')/100)*km*pp;
  if(f==='phev'){
    const p=g(car+'-ppct')/100;
    return p*(g(car+'-pkwh')/100)*km*ep+(1-p)*(g(car+'-pl100')/100)*km*pp;
  }
  return (g(car+'-l100')/100)*km*pp;
}

function fdesc(car){
  return {petrol:'Petrol',diesel:'Diesel + RUC',ev:'Electricity + RUC',hybrid:'Petrol (hybrid)',phev:'PHEV blend'}[document.getElementById(car+'-fuel').value]||'';
}

function treeFact(cA,cB,km){
  const KG_PER_TREE=21;
  const diffKg=Math.abs(cA-cB)*km/1000;
  const trees=Math.round(diffKg/KG_PER_TREE);
  const maxCo2=Math.max(cA,cB);
  const minCo2=Math.min(cA,cB);
  const lowerCar=cA<=cB?names.a:names.b;
  const higherCar=cA<=cB?names.b:names.a;
  if(maxCo2===0) return '<strong>Both zero! 🎉</strong>Both vehicles produce zero tailpipe emissions.';
  if(minCo2===0&&trees>0) return '<strong>'+trees+' trees/year</strong>Choosing the '+higherCar+' over the '+lowerCar+' is equivalent to planting '+trees+' trees every year — that\'s '+Math.round(diffKg).toLocaleString()+' kg of CO₂ saved annually.';
  if(trees===0) return 'These vehicles have very similar emissions — less than one tree worth of CO₂ difference per year.';
  return '<strong>'+trees+' trees/year</strong>Choosing the '+lowerCar+' over the '+higherCar+' saves the equivalent of planting '+trees+' trees every year ('+Math.round(diffKg).toLocaleString()+' kg CO₂ annually).';
}

function calc(){
  const yrs=Math.max(1,Math.round(g('yrs')));
  const pA=g('a-price'),pB=g('b-price');
  const rA=runCost('a'),rB=runCost('b');
  const km=g('km');
  const nA=names.a,nB=names.b;
  document.getElementById('leg-a').textContent=nA;
  document.getElementById('leg-b').textContent=nB;

  const labels=[],dA=[],dB=[];
  let beYr=null;
  for(let y=0;y<=yrs;y++){
    labels.push('Yr '+y);
    dA.push(Math.round(pA+rA*y));
    dB.push(Math.round(pB+rB*y));
    if(!beYr&&y>0){
      const pv=(pA+rA*(y-1))-(pB+rB*(y-1));
      const cv=(pA+rA*y)-(pB+rB*y);
      if(pv*cv<0) beYr=(y-1+Math.abs(pv)/Math.abs(rA-rB)).toFixed(1);
    }
  }

  const badge=document.getElementById('be-badge');
  if(beYr){ badge.textContent='Break-even at '+beYr+' years'; badge.className='be cross'; }
  else { const ch=(pA+rA*yrs)<=(pB+rB*yrs)?nA:nB; badge.textContent=ch+' cheaper throughout'; badge.className='be nocross'; }

  if(chartInst) chartInst.destroy();
  chartInst=new Chart(document.getElementById('chart'),{
    type:'line',
    data:{labels,datasets:[
      {label:nA,data:dA,borderColor:'#2563eb',backgroundColor:'rgba(37,99,235,0.06)',tension:0.3,pointRadius:2,borderWidth:2},
      {label:nB,data:dB,borderColor:'#059669',backgroundColor:'rgba(5,150,105,0.06)',tension:0.3,pointRadius:2,borderWidth:2},
    ]},
    options:{
      responsive:true,maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>' $'+c.parsed.y.toLocaleString()}}},
      scales:{
        x:{ticks:{font:{size:11},maxRotation:0,autoSkip:true,maxTicksLimit:12},grid:{color:'rgba(0,0,0,0.05)'}},
        y:{ticks:{callback:val=>'$'+(val/1000).toFixed(0)+'k',font:{size:11}},grid:{color:'rgba(0,0,0,0.05)'}}
      }
    }
  });

  const mid=Math.round(yrs/2);
  document.getElementById('mid-yr').textContent=mid;
  const cAm=Math.round(pA+rA*mid),cBm=Math.round(pB+rB*mid),aW=cAm<=cBm;

  document.getElementById('metrics').innerHTML=
    '<div class="mc"><div class="ml">'+nA+' annual</div><div class="mv">$'+Math.round(rA).toLocaleString()+'</div><div class="ms">'+fdesc('a')+'</div></div>'+
    '<div class="mc"><div class="ml">'+nB+' annual</div><div class="mv">$'+Math.round(rB).toLocaleString()+'</div><div class="ms">'+fdesc('b')+'</div></div>'+
    '<div class="mc"><div class="ml">Yearly saving</div><div class="mv">$'+Math.round(Math.abs(rA-rB)).toLocaleString()+'</div><div class="ms">'+(rA<rB?nA:nB)+' saves more/yr</div></div>'+
    '<div class="mc"><div class="ml">Over '+yrs+' years</div><div class="mv">$'+Math.round(Math.abs((pA+rA*yrs)-(pB+rB*yrs))).toLocaleString()+'</div><div class="ms">'+((pA+rA*yrs)<=(pB+rB*yrs)?nA:nB)+' wins</div></div>';

  const cA=co2s.a,cB=co2s.b,maxC=Math.max(cA,cB,1);
  const annA=Math.round(cA*km/1000),annB=Math.round(cB*km/1000);
  document.getElementById('co2-bars').innerHTML=
    '<div class="co2-row"><div class="co2-lbl">'+nA+'</div><div class="co2-track"><div class="co2-fill" style="width:'+(cA/maxC*100).toFixed(1)+'%;background:#2563eb;">'+(cA>0?cA+' g/km':'')+'</div></div><div class="co2-val">'+(cA===0?'Zero 🌱':annA.toLocaleString()+' kg/yr')+'</div></div>'+
    '<div class="co2-row"><div class="co2-lbl">'+nB+'</div><div class="co2-track"><div class="co2-fill" style="width:'+(cB/maxC*100).toFixed(1)+'%;background:#059669;">'+(cB>0?cB+' g/km':'')+'</div></div><div class="co2-val">'+(cB===0?'Zero 🌱':annB.toLocaleString()+' kg/yr')+'</div></div>';

  const tc=document.getElementById('tree-card');
  document.getElementById('tree-text').innerHTML=treeFact(cA,cB,km);
  tc.classList.add('show');

  document.getElementById('breakdown').innerHTML=
    '<tr><th>Item</th><th>'+nA+'</th><th>'+nB+'</th></tr>'+
    '<tr><td>Purchase price</td><td>$'+pA.toLocaleString()+'</td><td>$'+pB.toLocaleString()+'</td></tr>'+
    '<tr><td>'+fdesc('a')+' / yr</td><td>$'+Math.round(rA).toLocaleString()+'</td><td>—</td></tr>'+
    '<tr><td>'+fdesc('b')+' / yr</td><td>—</td><td>$'+Math.round(rB).toLocaleString()+'</td></tr>'+
    '<tr><td>Running × '+mid+' yrs</td><td>$'+Math.round(rA*mid).toLocaleString()+'</td><td>$'+Math.round(rB*mid).toLocaleString()+'</td></tr>'+
    '<tr><td>Total at year '+mid+'</td><td class="'+(aW?'wa':'')+'">$'+cAm.toLocaleString()+'</td><td class="'+(!aW?'wb':'')+'">$'+cBm.toLocaleString()+'</td></tr>';

  document.getElementById('results').style.display='block';
  document.getElementById('results').scrollIntoView({behavior:'smooth',block:'start'});
}

init();
<\/script>
</body>
</html>`;
