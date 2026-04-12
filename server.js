/**
 * NZ Car Comparator — Test Server
 *
 * Demo plates (work without API key):
 *   ABC123 = Toyota Corolla (petrol)
 *   MAZDA1 = Mazda CX-5 (petrol)
 *   UTE001 = Ford Ranger (diesel)
 *   SUV999 = Toyota RAV4 Hybrid
 *   EV2024 = Tesla Model 3 (EV)
 *   LEAF22 = Nissan Leaf (EV)
 *   BYD001 = BYD Atto 3 (EV)
 *   PHEV01 = Mitsubishi Outlander PHEV
 *
 * For real NZ plates, set CARJAM_TEST_KEY and use the Carjam test environment.
 *
 * Usage:
 *   node server.js                          (demo mode, no key needed)
 *   CARJAM_TEST_KEY=your_key node server.js (real plate lookup)
 *   Then open http://localhost:3001
 */

import express from 'express';
import NodeCache from 'node-cache';

const app = express();
const cache = new NodeCache({ stdTTL: 3600 });

const CARJAM_KEY = process.env.CARJAM_TEST_KEY || '';
const PORT = process.env.PORT || 3001;

const CARJAM_BASIC = 'Basic ' + Buffer.from('test:test').toString('base64');

const FUEL_TYPE_MAP = {
  '01': 'petrol',
  '02': 'diesel',
  '06': 'hybrid',
  '12': 'ev',
  '14': 'phev',
  '15': 'hybrid',
};

// ─── Demo vehicle database ────────────────────────────────────────────────────
// Realistic NZ vehicles with economy figures from RightCar/EECA.
// These return instantly without hitting any API.
const DEMO_VEHICLES = {
  'ABC123': {
    plate: 'ABC123', year: '2021', make: 'TOYOTA', model: 'COROLLA',
    submodel: 'GX 2.0P/CVT', colour: 'White', transmission: 'CVT automatic',
    fuelType: 'petrol', cc: '1987', odometer: '28450', wof: 'P',
    economy: { fuelConsumptionPer100km: 6.8, electricConsumptionPer100km: null, co2gPerKm: 158, economyStars: 3.5, co2Stars: 3 },
    _demo: true,
  },
  'EV2024': {
    plate: 'EV2024', year: '2023', make: 'TESLA', model: 'MODEL 3',
    submodel: 'Standard Range RWD', colour: 'Pearl White', transmission: 'Single speed automatic',
    fuelType: 'ev', cc: null, odometer: '11200', wof: 'P',
    economy: { fuelConsumptionPer100km: null, electricConsumptionPer100km: 14.9, co2gPerKm: 0, economyStars: 6, co2Stars: 6 },
    _demo: true,
  },
  'LEAF22': {
    plate: 'LEAF22', year: '2022', make: 'NISSAN', model: 'LEAF',
    submodel: 'e+ 62kWh', colour: 'Gun Metallic', transmission: 'Single speed automatic',
    fuelType: 'ev', cc: null, odometer: '19300', wof: 'P',
    economy: { fuelConsumptionPer100km: null, electricConsumptionPer100km: 17.2, co2gPerKm: 0, economyStars: 6, co2Stars: 6 },
    _demo: true,
  },
  'SUV999': {
    plate: 'SUV999', year: '2020', make: 'TOYOTA', model: 'RAV4',
    submodel: 'GXL HYBRID AWD', colour: 'Graphite', transmission: 'CVT automatic',
    fuelType: 'hybrid', cc: '2487', odometer: '44100', wof: 'P',
    economy: { fuelConsumptionPer100km: 5.4, electricConsumptionPer100km: null, co2gPerKm: 123, economyStars: 4.5, co2Stars: 4.5 },
    _demo: true,
  },
  'UTE001': {
    plate: 'UTE001', year: '2021', make: 'FORD', model: 'RANGER',
    submodel: 'XLT 2.0D/4WD/6AT', colour: 'Meteor Grey', transmission: '6-speed automatic',
    fuelType: 'diesel', cc: '1996', odometer: '51800', wof: 'P',
    economy: { fuelConsumptionPer100km: 8.1, electricConsumptionPer100km: null, co2gPerKm: 213, economyStars: 2, co2Stars: 2 },
    _demo: true,
  },
  'PHEV01': {
    plate: 'PHEV01', year: '2022', make: 'MITSUBISHI', model: 'OUTLANDER',
    submodel: 'PHEV AWD', colour: 'Diamond White', transmission: 'Single speed automatic',
    fuelType: 'phev', cc: '2360', odometer: '22600', wof: 'P',
    economy: { fuelConsumptionPer100km: 1.9, electricConsumptionPer100km: 22.0, co2gPerKm: 43, economyStars: 5.5, co2Stars: 5.5 },
    _demo: true,
  },
  'MAZDA1': {
    plate: 'MAZDA1', year: '2019', make: 'MAZDA', model: 'CX-5',
    submodel: 'GSX 2.5P/AWD/6AT', colour: 'Soul Red Crystal', transmission: '6-speed automatic',
    fuelType: 'petrol', cc: '2488', odometer: '63200', wof: 'P',
    economy: { fuelConsumptionPer100km: 7.6, electricConsumptionPer100km: null, co2gPerKm: 177, economyStars: 3, co2Stars: 2.5 },
    _demo: true,
  },
  'BYD001': {
    plate: 'BYD001', year: '2024', make: 'BYD', model: 'ATTO 3',
    submodel: 'Extended Range', colour: 'Cosmos Black', transmission: 'Single speed automatic',
    fuelType: 'ev', cc: null, odometer: '4100', wof: 'P',
    economy: { fuelConsumptionPer100km: null, electricConsumptionPer100km: 15.4, co2gPerKm: 0, economyStars: 6, co2Stars: 6 },
    _demo: true,
  },
};

// ─── Carjam ABCD lookup (test env) ───────────────────────────────────────────
async function fetchCarjam(plate) {
  const cacheKey = 'cj:' + plate;
  const hit = cache.get(cacheKey);
  if (hit) return { ...hit, _cached: true };

  if (!CARJAM_KEY) throw new Error('No CARJAM_TEST_KEY set');

  const url = 'https://test.carjam.co.nz/a/vehicle:abcd?key=' + encodeURIComponent(CARJAM_KEY) + '&plate=' + encodeURIComponent(plate);
  const res = await fetch(url, { headers: { Authorization: CARJAM_BASIC } });

  const text = await res.text();
  console.log('[carjam raw] ' + plate + ':', text.slice(0, 300));

  if (!res.ok) throw new Error('Carjam HTTP ' + res.status + ': ' + text.slice(0, 200));

  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error('Carjam returned unexpected response: ' + text.slice(0, 200)); }

  if (data && data.error) {
    const msg = typeof data.error === 'string' ? data.error : (data.error.message || JSON.stringify(data.error));
    throw new Error('Carjam error: ' + msg);
  }
  if (!data || !data.make) throw new Error('Plate not found in Carjam');

  cache.set(cacheKey, data);
  return data;
}

// ─── Plate lookup endpoint ────────────────────────────────────────────────────
app.get('/api/lookup/:plate', async (req, res) => {
  const plate = req.params.plate.toUpperCase().replace(/s/g, '');
  if (!/^[A-Z0-9]{1,8}$/.test(plate)) {
    return res.status(400).json({ error: 'Invalid plate format' });
  }

  // Check demo database first — works without any API key
  if (DEMO_VEHICLES[plate]) {
    console.log('[demo] ' + plate + ': returning demo data');
    return res.json(DEMO_VEHICLES[plate]);
  }

  // Try Carjam live API
  try {
    const cj = await fetchCarjam(plate);
    const fuelType = FUEL_TYPE_MAP[String(cj.fuel_type)] || 'petrol';
    return res.json({
      plate: cj.plate,
      year: cj.year_of_manufacture,
      make: cj.make,
      model: cj.model,
      submodel: cj.submodel,
      colour: cj.main_colour,
      transmission: cj.transmission,
      fuelType,
      cc: cj.cc_rating,
      vin: cj.vin,
      odometer: cj.latest_odometer_reading,
      wof: cj.result_of_latest_wof_inspection,
      _cached: cj._cached || false,
      economy: null,
    });
  } catch (err) {
    console.error('[lookup] ' + plate + ':', err.message);
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, keySet: !!CARJAM_KEY, cachedPlates: cache.keys(), demoPlates: Object.keys(DEMO_VEHICLES) });
});

// ─── Serve the frontend HTML inline ──────────────────────────────────────────
app.get('/', (_req, res) => res.send(HTML));

app.listen(PORT, () => {
  console.log('\n  NZ Car Comparator');
  console.log('  ─────────────────────────────');
  console.log('  Demo mode: always on — plates ABC123 EV2024 LEAF22 SUV999 UTE001 PHEV01 MAZDA1 BYD001');
  if (CARJAM_KEY) {
    console.log('  Carjam test API: enabled (real NZ plates also work)');
  } else {
    console.log('  Carjam API: not set (demo plates only)');
  }
  console.log('  Open: http://localhost:' + PORT + '\n');
});

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>NZ Car Comparator</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --blue: #2563eb; --blue-light: #dbeafe; --blue-mid: #1d4ed8;
    --green: #059669; --green-light: #d1fae5; --green-mid: #047857;
    --gray-50: #f9fafb; --gray-100: #f3f4f6; --gray-200: #e5e7eb;
    --gray-400: #9ca3af; --gray-600: #4b5563; --gray-800: #1f2937; --gray-900: #111827;
    --radius: 10px; --radius-sm: 6px;
  }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--gray-50); color: var(--gray-800); min-height: 100vh; }
  header { background: white; border-bottom: 1px solid var(--gray-200); padding: 14px 24px; display: flex; align-items: center; gap: 12px; }
  header h1 { font-size: 18px; font-weight: 600; }
  header .test-badge { font-size: 11px; font-weight: 600; background: #fef3c7; color: #92400e; padding: 3px 8px; border-radius: 20px; letter-spacing: 0.04em; }
  main { max-width: 960px; margin: 0 auto; padding: 24px 16px 48px; }
  .test-plates-bar { background: #fef3c7; border: 1px solid #fcd34d; border-radius: var(--radius-sm); padding: 10px 14px; margin-bottom: 20px; font-size: 13px; color: #92400e; }
  .test-plates-bar strong { font-weight: 600; }
  .test-plates-bar code { background: #fde68a; border-radius: 4px; padding: 1px 6px; font-family: monospace; cursor: pointer; user-select: all; }
  .cars-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
  .car-card { background: white; border: 1px solid var(--gray-200); border-radius: var(--radius); overflow: hidden; }
  .car-card-header { padding: 12px 16px 0; border-top: 3px solid; }
  .car-a .car-card-header { border-color: var(--blue); }
  .car-b .car-card-header { border-color: var(--green); }
  .car-label { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 10px; }
  .car-a .car-label { color: var(--blue-mid); }
  .car-b .car-label { color: var(--green-mid); }
  .plate-row { display: flex; gap: 8px; margin-bottom: 10px; }
  .plate-input { flex: 1; font-size: 17px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; border: 1.5px solid var(--gray-200); border-radius: var(--radius-sm); padding: 8px 12px; outline: none; transition: border-color 0.15s; }
  .plate-input:focus { border-color: var(--blue); }
  .car-b .plate-input:focus { border-color: var(--green); }
  .lookup-btn { white-space: nowrap; padding: 0 14px; height: 40px; border-radius: var(--radius-sm); border: none; font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.15s; }
  .car-a .lookup-btn { background: var(--blue-light); color: var(--blue-mid); }
  .car-a .lookup-btn:hover { background: #bfdbfe; }
  .car-b .lookup-btn { background: var(--green-light); color: var(--green-mid); }
  .car-b .lookup-btn:hover { background: #a7f3d0; }
  .lookup-btn:disabled { opacity: 0.5; cursor: wait; }
  .status-line { font-size: 12px; min-height: 18px; margin-bottom: 6px; padding: 0 16px; }
  .status-ok { color: var(--green); }
  .status-err { color: #dc2626; }
  .status-loading { color: var(--gray-400); }
  .vehicle-banner { margin: 0 12px 12px; background: var(--gray-50); border: 1px solid var(--gray-200); border-radius: var(--radius-sm); padding: 10px 12px; display: none; }
  .vehicle-banner.show { display: block; }
  .vehicle-name { font-size: 15px; font-weight: 600; margin-bottom: 2px; }
  .vehicle-meta { font-size: 12px; color: var(--gray-600); }
  .vehicle-wof { display: inline-block; font-size: 11px; font-weight: 600; padding: 2px 7px; border-radius: 20px; margin-top: 4px; }
  .wof-pass { background: var(--green-light); color: var(--green-mid); }
  .wof-fail { background: #fee2e2; color: #991b1b; }
  .card-fields { padding: 12px 16px 16px; border-top: 1px solid var(--gray-100); }
  .field { margin-bottom: 10px; }
  .field label { display: block; font-size: 11px; font-weight: 600; color: var(--gray-600); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
  .field input, .field select { width: 100%; border: 1.5px solid var(--gray-200); border-radius: var(--radius-sm); padding: 7px 10px; font-size: 14px; outline: none; transition: border-color 0.15s; background: white; }
  .field input:focus, .field select:focus { border-color: var(--blue); }
  .fuel-sub { display: none; }
  .fuel-sub.show { display: block; }
  .assumptions-card { background: white; border: 1px solid var(--gray-200); border-radius: var(--radius); padding: 16px; margin-bottom: 20px; }
  .assumptions-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; }
  .section-title { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--gray-400); margin-bottom: 12px; }
  .calc-row { display: flex; justify-content: flex-end; margin-top: 12px; }
  .calc-btn { background: var(--gray-800); color: white; border: none; border-radius: var(--radius-sm); padding: 10px 22px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.15s; }
  .calc-btn:hover { background: var(--gray-900); }
  #results { display: none; }
  .metrics-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 16px; }
  .metric { background: white; border: 1px solid var(--gray-200); border-radius: var(--radius); padding: 14px 16px; }
  .metric-label { font-size: 11px; color: var(--gray-400); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
  .metric-value { font-size: 24px; font-weight: 700; }
  .metric-sub { font-size: 11px; color: var(--gray-400); margin-top: 2px; }
  .chart-card { background: white; border: 1px solid var(--gray-200); border-radius: var(--radius); padding: 16px; margin-bottom: 16px; }
  .chart-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; flex-wrap: wrap; gap: 8px; }
  .legend { display: flex; gap: 16px; }
  .legend-item { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--gray-600); }
  .legend-swatch { width: 12px; height: 12px; border-radius: 3px; flex-shrink: 0; }
  .be-badge { font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 20px; }
  .be-badge.crossover { background: #dbeafe; color: #1d4ed8; }
  .be-badge.no-crossover { background: var(--gray-100); color: var(--gray-600); }
  .table-card { background: white; border: 1px solid var(--gray-200); border-radius: var(--radius); padding: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--gray-400); padding: 6px 8px; border-bottom: 1px solid var(--gray-200); }
  td { padding: 8px 8px; border-bottom: 1px solid var(--gray-100); color: var(--gray-800); }
  tr:last-child td { border-bottom: none; font-weight: 700; }
  .win-a { color: var(--blue-mid); }
  .win-b { color: var(--green-mid); }
  @media (max-width: 600px) {
    .cars-grid { grid-template-columns: 1fr; }
    .metrics-row { grid-template-columns: 1fr 1fr; }
  }
</style>
</head>
<body>
<header>
  <h1>NZ Car Comparator</h1>
  <span class="test-badge">TEST MODE</span>
</header>
<main>
  <div class="test-plates-bar">
    <strong>Demo plates:</strong>
    <code onclick="setPlate('a','ABC123')">ABC123</code> Corolla &nbsp;
    <code onclick="setPlate('a','MAZDA1')">MAZDA1</code> CX-5 &nbsp;
    <code onclick="setPlate('a','UTE001')">UTE001</code> Ranger &nbsp;
    <code onclick="setPlate('a','SUV999')">SUV999</code> RAV4 Hybrid &nbsp;
    <code onclick="setPlate('b','EV2024')">EV2024</code> Tesla M3 &nbsp;
    <code onclick="setPlate('b','LEAF22')">LEAF22</code> Nissan Leaf &nbsp;
    <code onclick="setPlate('b','BYD001')">BYD001</code> BYD Atto 3 &nbsp;
    <code onclick="setPlate('b','PHEV01')">PHEV01</code> Outlander PHEV
    <br>Click any plate to fill it in, then hit <strong>Look up</strong>. These work without an API key.
  </div>

  <div class="cars-grid">
    <!-- Car A -->
    <div class="car-card car-a">
      <div class="car-card-header">
        <div class="car-label">Car A</div>
        <div class="plate-row">
          <input class="plate-input" id="a-plate" placeholder="e.g. 360J" maxlength="8" oninput="this.value=this.value.toUpperCase()" onkeydown="if(event.key==='Enter')lookup('a')" />
          <button class="lookup-btn" id="a-btn" onclick="lookup('a')">Look up</button>
        </div>
      </div>
      <div class="status-line" id="a-status"></div>
      <div class="vehicle-banner" id="a-banner">
        <div class="vehicle-name" id="a-name"></div>
        <div class="vehicle-meta" id="a-meta"></div>
        <div id="a-wof"></div>
      </div>
      <div class="card-fields">
        <div class="field">
          <label>Purchase price (NZD)</label>
          <input type="number" id="a-price" value="25000" min="0" step="500" />
        </div>
        <div class="field">
          <label>Fuel type</label>
          <select id="a-fuel" onchange="updateFuel('a')">
            <option value="petrol">Petrol</option>
            <option value="diesel">Diesel</option>
            <option value="ev">Electric (EV)</option>
            <option value="hybrid">Hybrid</option>
            <option value="phev">Plug-in Hybrid (PHEV)</option>
          </select>
        </div>
        <div class="fuel-sub show" id="a-liq">
          <div class="field"><label>Fuel consumption (L/100km)</label><input type="number" id="a-l100" value="7.5" step="0.1" min="0" /></div>
        </div>
        <div class="fuel-sub" id="a-elec">
          <div class="field"><label>Efficiency (kWh/100km)</label><input type="number" id="a-kwh" value="17" step="0.5" min="0" /></div>
        </div>
        <div class="fuel-sub" id="a-phev">
          <div class="field"><label>Petrol use (L/100km)</label><input type="number" id="a-pl100" value="5.0" step="0.1" min="0" /></div>
          <div class="field"><label>Electric use (kWh/100km)</label><input type="number" id="a-pkwh" value="18" step="0.5" min="0" /></div>
          <div class="field"><label>% driven on electric</label><input type="number" id="a-ppct" value="50" step="5" min="0" max="100" /></div>
        </div>
      </div>
    </div>

    <!-- Car B -->
    <div class="car-card car-b">
      <div class="car-card-header">
        <div class="car-label">Car B</div>
        <div class="plate-row">
          <input class="plate-input" id="b-plate" placeholder="e.g. 100LW" maxlength="8" oninput="this.value=this.value.toUpperCase()" onkeydown="if(event.key==='Enter')lookup('b')" />
          <button class="lookup-btn" id="b-btn" onclick="lookup('b')">Look up</button>
        </div>
      </div>
      <div class="status-line" id="b-status"></div>
      <div class="vehicle-banner" id="b-banner">
        <div class="vehicle-name" id="b-name"></div>
        <div class="vehicle-meta" id="b-meta"></div>
        <div id="b-wof"></div>
      </div>
      <div class="card-fields">
        <div class="field">
          <label>Purchase price (NZD)</label>
          <input type="number" id="b-price" value="38000" min="0" step="500" />
        </div>
        <div class="field">
          <label>Fuel type</label>
          <select id="b-fuel" onchange="updateFuel('b')">
            <option value="petrol">Petrol</option>
            <option value="diesel">Diesel</option>
            <option value="ev" selected>Electric (EV)</option>
            <option value="hybrid">Hybrid</option>
            <option value="phev">Plug-in Hybrid (PHEV)</option>
          </select>
        </div>
        <div class="fuel-sub" id="b-liq">
          <div class="field"><label>Fuel consumption (L/100km)</label><input type="number" id="b-l100" value="7.5" step="0.1" min="0" /></div>
        </div>
        <div class="fuel-sub show" id="b-elec">
          <div class="field"><label>Efficiency (kWh/100km)</label><input type="number" id="b-kwh" value="17" step="0.5" min="0" /></div>
        </div>
        <div class="fuel-sub" id="b-phev">
          <div class="field"><label>Petrol use (L/100km)</label><input type="number" id="b-pl100" value="5.0" step="0.1" min="0" /></div>
          <div class="field"><label>Electric use (kWh/100km)</label><input type="number" id="b-pkwh" value="18" step="0.5" min="0" /></div>
          <div class="field"><label>% driven on electric</label><input type="number" id="b-ppct" value="50" step="5" min="0" max="100" /></div>
        </div>
      </div>
    </div>
  </div>

  <!-- Assumptions -->
  <div class="assumptions-card">
    <div class="section-title">Assumptions</div>
    <div class="assumptions-grid">
      <div class="field"><label>Annual km</label><input type="number" id="km" value="15000" step="1000" min="1000" /></div>
      <div class="field"><label>Petrol ($/L)</label><input type="number" id="pp" value="2.50" step="0.05" min="0" /></div>
      <div class="field"><label>Diesel ($/L)</label><input type="number" id="dp" value="1.85" step="0.05" min="0" /></div>
      <div class="field"><label>Electricity ($/kWh)</label><input type="number" id="ep" value="0.30" step="0.01" min="0" /></div>
      <div class="field"><label>RUC diesel ($/1000km)</label><input type="number" id="ruc-d" value="76" step="1" min="0" /></div>
      <div class="field"><label>RUC EV ($/1000km)</label><input type="number" id="ruc-e" value="76" step="1" min="0" /></div>
      <div class="field"><label>Years to project</label><input type="number" id="yrs" value="10" step="1" min="1" max="30" /></div>
    </div>
    <div class="calc-row">
      <button class="calc-btn" onclick="calculate()">Calculate</button>
    </div>
  </div>

  <!-- Results -->
  <div id="results">
    <div class="metrics-row" id="metrics"></div>
    <div class="chart-card">
      <div class="chart-top">
        <div class="legend">
          <div class="legend-item"><div class="legend-swatch" style="background:#2563eb"></div><span id="leg-a">Car A</span></div>
          <div class="legend-item"><div class="legend-swatch" style="background:#059669"></div><span id="leg-b">Car B</span></div>
        </div>
        <div class="be-badge no-crossover" id="be-badge">—</div>
      </div>
      <div style="position:relative;height:300px"><canvas id="chart"></canvas></div>
    </div>
    <div class="table-card">
      <div class="section-title">Cost breakdown at year <span id="mid-yr">5</span></div>
      <table id="breakdown"></table>
    </div>
  </div>
</main>

<script>
let chartInst = null;
const names = { a: 'Car A', b: 'Car B' };

function setPlate(car, plate) {
  document.getElementById(car + '-plate').value = plate;
}

function updateFuel(car) {
  const f = document.getElementById(car + '-fuel').value;
  document.getElementById(car + '-liq').classList.toggle('show', f === 'petrol' || f === 'diesel' || f === 'hybrid');
  document.getElementById(car + '-elec').classList.toggle('show', f === 'ev');
  document.getElementById(car + '-phev').classList.toggle('show', f === 'phev');
}
updateFuel('a');
updateFuel('b');

async function lookup(car) {
  const plate = document.getElementById(car + '-plate').value.trim().replace(/\\s/g,'');
  if (!plate) return;
  const btn = document.getElementById(car + '-btn');
  const statusEl = document.getElementById(car + '-status');
  const banner = document.getElementById(car + '-banner');

  btn.disabled = true;
  btn.textContent = '…';
  statusEl.className = 'status-line status-loading';
  statusEl.textContent = 'Looking up ' + plate + '…';
  banner.classList.remove('show');

  try {
    const res = await fetch('/api/lookup/' + encodeURIComponent(plate));
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lookup failed');

    names[car] = [data.year, data.make, data.model].filter(Boolean).join(' ');
    document.getElementById(car + '-name').textContent = names[car];
    document.getElementById(car + '-meta').textContent =
      [data.submodel, data.colour, data.transmission, data.cc ? data.cc + 'cc' : null, data.odometer ? parseInt(data.odometer).toLocaleString() + ' km' : null]
        .filter(Boolean).join(' · ');

    const wofEl = document.getElementById(car + '-wof');
    if (data.wof) {
      const pass = data.wof === 'P';
      wofEl.innerHTML = '<span class="vehicle-wof ' + (pass ? 'wof-pass' : 'wof-fail') + '">WOF ' + (pass ? 'Pass' : 'Fail') + '</span>';
    } else { wofEl.innerHTML = ''; }

    // Auto-set fuel type
    const fuelSel = document.getElementById(car + '-fuel');
    fuelSel.value = data.fuelType || 'petrol';
    updateFuel(car);

    banner.classList.add('show');
    statusEl.className = 'status-line status-ok';
    statusEl.textContent = '✓ Found' + (data._cached ? ' (cached)' : '') + ' — set purchase price and fuel economy below';
  } catch(e) {
    statusEl.className = 'status-line status-err';
    statusEl.textContent = '✗ ' + e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Look up';
  }
}

function v(id) { return parseFloat(document.getElementById(id).value) || 0; }

function annualCost(car) {
  const km = v('km'), pp = v('pp'), dp = v('dp'), ep = v('ep');
  const fuel = document.getElementById(car + '-fuel').value;
  if (fuel === 'ev')     return (v(car+'-kwh')/100)*km*ep + (km/1000)*v('ruc-e');
  if (fuel === 'diesel') return (v(car+'-l100')/100)*km*dp + (km/1000)*v('ruc-d');
  if (fuel === 'hybrid') return (v(car+'-l100')/100)*km*pp;
  if (fuel === 'phev') {
    const pct = v(car+'-ppct')/100;
    return pct*(v(car+'-pkwh')/100)*km*ep + (1-pct)*(v(car+'-pl100')/100)*km*pp;
  }
  return (v(car+'-l100')/100)*km*pp;
}

function fuelDesc(car) {
  const map = { petrol:'Petrol', diesel:'Diesel + RUC', ev:'Electricity + RUC', hybrid:'Petrol (hybrid)', phev:'PHEV blend' };
  return map[document.getElementById(car+'-fuel').value] || '';
}

function calculate() {
  const years = Math.max(1, Math.round(v('yrs')));
  const pA = v('a-price'), pB = v('b-price');
  const rA = annualCost('a'), rB = annualCost('b');
  const nA = names.a, nB = names.b;

  document.getElementById('leg-a').textContent = nA;
  document.getElementById('leg-b').textContent = nB;

  const labels = [], dA = [], dB = [];
  let beYr = null;
  for (let y = 0; y <= years; y++) {
    labels.push('Yr ' + y);
    dA.push(Math.round(pA + rA * y));
    dB.push(Math.round(pB + rB * y));
    if (!beYr && y > 0) {
      const prev = (pA + rA*(y-1)) - (pB + rB*(y-1));
      const curr = (pA + rA*y) - (pB + rB*y);
      if (prev * curr < 0) {
        beYr = (y - 1 + Math.abs(prev) / Math.abs(rA - rB)).toFixed(1);
      }
    }
  }

  const badge = document.getElementById('be-badge');
  if (beYr) {
    badge.textContent = 'Break-even at ' + beYr + ' years';
    badge.className = 'be-badge crossover';
  } else {
    const cheaper = (pA + rA*years) <= (pB + rB*years) ? nA : nB;
    badge.textContent = cheaper + ' cheaper throughout';
    badge.className = 'be-badge no-crossover';
  }

  if (chartInst) chartInst.destroy();
  chartInst = new Chart(document.getElementById('chart'), {
    type: 'line',
    data: { labels, datasets: [
      { label: nA, data: dA, borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.06)', tension: 0.3, pointRadius: 2, borderWidth: 2 },
      { label: nB, data: dB, borderColor: '#059669', backgroundColor: 'rgba(5,150,105,0.06)', tension: 0.3, pointRadius: 2, borderWidth: 2 },
    ]},
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' $' + c.parsed.y.toLocaleString() } } },
      scales: {
        x: { ticks: { font: { size: 11 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 }, grid: { color: 'rgba(0,0,0,0.05)' } },
        y: { ticks: { callback: v => '$' + (v/1000).toFixed(0) + 'k', font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.05)' } }
      }
    }
  });

  const mid = Math.round(years / 2);
  document.getElementById('mid-yr').textContent = mid;
  const cAm = Math.round(pA + rA*mid), cBm = Math.round(pB + rB*mid);
  const aW = cAm <= cBm;

  document.getElementById('breakdown').innerHTML = \`
    <tr><th>Item</th><th>\${nA}</th><th>\${nB}</th></tr>
    <tr><td>Purchase price</td><td>$\${pA.toLocaleString()}</td><td>$\${pB.toLocaleString()}</td></tr>
    <tr><td>\${fuelDesc('a')} / yr</td><td>$\${Math.round(rA).toLocaleString()}</td><td>—</td></tr>
    <tr><td>\${fuelDesc('b')} / yr</td><td>—</td><td>$\${Math.round(rB).toLocaleString()}</td></tr>
    <tr><td>Running × \${mid} yrs</td><td>$\${Math.round(rA*mid).toLocaleString()}</td><td>$\${Math.round(rB*mid).toLocaleString()}</td></tr>
    <tr><td>Total at year \${mid}</td>
      <td class="\${aW?'win-a':''}">$\${cAm.toLocaleString()}</td>
      <td class="\${!aW?'win-b':''}">$\${cBm.toLocaleString()}</td>
    </tr>\`;

  document.getElementById('metrics').innerHTML = \`
    <div class="metric"><div class="metric-label">\${nA} annual</div><div class="metric-value">$\${Math.round(rA).toLocaleString()}</div><div class="metric-sub">\${fuelDesc('a')}</div></div>
    <div class="metric"><div class="metric-label">\${nB} annual</div><div class="metric-value">$\${Math.round(rB).toLocaleString()}</div><div class="metric-sub">\${fuelDesc('b')}</div></div>
    <div class="metric"><div class="metric-label">Yearly saving</div><div class="metric-value">$\${Math.round(Math.abs(rA-rB)).toLocaleString()}</div><div class="metric-sub">\${rA<rB?nA:nB} saves more/yr</div></div>\`;

  document.getElementById('results').style.display = 'block';
}

calculate();
</script>
</body>
</html>`;
