import express from 'express';
import NodeCache from 'node-cache';

const app = express();
const cache = new NodeCache({ stdTTL: 3600 });
const CARJAM_KEY = process.env.CARJAM_TEST_KEY || '';
const PORT = process.env.PORT || 3001;
const CARJAM_BASIC = 'Basic ' + Buffer.from('test:test').toString('base64');

const FUEL_TYPE_MAP = { '01':'petrol','02':'diesel','06':'hybrid','12':'ev','14':'phev','15':'hybrid' };

const VEHICLES = [
  { plate:'ABC123', name:'2021 Toyota Corolla',             make:'Toyota',      model:'Corolla',    year:2021, fuelType:'petrol', price:25000, l100:6.8,  kwh:null, co2:158, stars:3.5, safety:5, seats:5, bodyType:'Sedan',    trans:'CVT automatic',    cc:1987, notes:'Most popular NZ petrol car' },
  { plate:'MAZDA1', name:'2019 Mazda CX-5',                make:'Mazda',       model:'CX-5',       year:2019, fuelType:'petrol', price:22000, l100:7.6,  kwh:null, co2:177, stars:3.0, safety:5, seats:5, bodyType:'SUV',      trans:'6-speed automatic', cc:2488, notes:'Popular family SUV' },
  { plate:'UTE001', name:'2021 Ford Ranger XLT',           make:'Ford',        model:'Ranger',     year:2021, fuelType:'diesel', price:45000, l100:8.1,  kwh:null, co2:213, stars:2.0, safety:5, seats:5, bodyType:'Ute',      trans:'6-speed automatic', cc:1996, notes:'NZ\'s best-selling ute' },
  { plate:'SUV999', name:'2020 Toyota RAV4 Hybrid',        make:'Toyota',      model:'RAV4',       year:2020, fuelType:'hybrid', price:38000, l100:5.4,  kwh:null, co2:123, stars:4.5, safety:5, seats:5, bodyType:'SUV',      trans:'CVT automatic',    cc:2487, notes:'Self-charging hybrid' },
  { plate:'HONDA1', name:'2020 Honda CR-V Hybrid',         make:'Honda',       model:'CR-V',       year:2020, fuelType:'hybrid', price:35000, l100:5.8,  kwh:null, co2:132, stars:4.0, safety:5, seats:5, bodyType:'SUV',      trans:'CVT automatic',    cc:1993, notes:'Strong hybrid, no plug needed' },
  { plate:'EV2024', name:'2023 Tesla Model 3',             make:'Tesla',       model:'Model 3',    year:2023, fuelType:'ev',     price:59000, l100:null, kwh:14.9, co2:0,   stars:6.0, safety:5, seats:5, bodyType:'Sedan',    trans:'Single speed',      cc:null, notes:'Long range, fastest charging' },
  { plate:'LEAF22', name:'2022 Nissan Leaf e+',            make:'Nissan',      model:'Leaf',       year:2022, fuelType:'ev',     price:39000, l100:null, kwh:17.2, co2:0,   stars:6.0, safety:5, seats:5, bodyType:'Hatchback', trans:'Single speed',     cc:null, notes:'62kWh battery, great range' },
  { plate:'BYD001', name:'2024 BYD Atto 3',               make:'BYD',         model:'Atto 3',     year:2024, fuelType:'ev',     price:45000, l100:null, kwh:15.4, co2:0,   stars:6.0, safety:5, seats:5, bodyType:'SUV',      trans:'Single speed',      cc:null, notes:'Great value EV, 5-star ANCAP' },
  { plate:'MG4EV',  name:'2023 MG4 EV',                   make:'MG',          model:'MG4',        year:2023, fuelType:'ev',     price:38000, l100:null, kwh:16.0, co2:0,   stars:6.0, safety:5, seats:5, bodyType:'Hatchback', trans:'Single speed',     cc:null, notes:'Budget-friendly EV option' },
  { plate:'PHEV01', name:'2022 Mitsubishi Outlander PHEV', make:'Mitsubishi',  model:'Outlander',  year:2022, fuelType:'phev',   price:62000, l100:1.9,  kwh:22.0, co2:43,  stars:5.5, safety:5, seats:7, bodyType:'SUV',      trans:'Single speed',      cc:2360, notes:'Best-selling PHEV in NZ' },
  { plate:'PRIUS1', name:'2023 Toyota Prius PHEV',         make:'Toyota',      model:'Prius',      year:2023, fuelType:'phev',   price:52000, l100:1.0,  kwh:20.0, co2:22,  stars:5.5, safety:5, seats:5, bodyType:'Sedan',    trans:'CVT automatic',    cc:1986, notes:'Ultra-low emissions PHEV' },
  { plate:'GWM001', name:'2023 GWM Tank 300',              make:'GWM',         model:'Tank 300',   year:2023, fuelType:'petrol', price:55000, l100:11.2, kwh:null, co2:258, stars:1.5, safety:4, seats:5, bodyType:'SUV',      trans:'8-speed automatic', cc:2000, notes:'Heavy SUV, high fuel use' },
  { plate:'SUBR1',  name:'2021 Subaru Forester',           make:'Subaru',      model:'Forester',   year:2021, fuelType:'petrol', price:40000, l100:8.4,  kwh:null, co2:195, stars:2.5, safety:5, seats:5, bodyType:'SUV',      trans:'CVT automatic',    cc:2498, notes:'AWD family SUV' },
  { plate:'KIA001', name:'2023 Kia EV6',                   make:'Kia',         model:'EV6',        year:2023, fuelType:'ev',     price:69000, l100:null, kwh:16.5, co2:0,   stars:6.0, safety:5, seats:5, bodyType:'SUV',      trans:'Single speed',      cc:null, notes:'Fast charging, sporty EV' },
  { plate:'ISUZU1', name:'2022 Isuzu D-Max',               make:'Isuzu',       model:'D-Max',      year:2022, fuelType:'diesel', price:62000, l100:9.3,  kwh:null, co2:244, stars:1.5, safety:5, seats:5, bodyType:'Ute',      trans:'6-speed automatic', cc:3000, notes:'Heavy-duty ute' },
  { plate:'CAMRY1', name:'2022 Toyota Camry Hybrid',       make:'Toyota',      model:'Camry',      year:2022, fuelType:'hybrid', price:42000, l100:4.8,  kwh:null, co2:110, stars:5.0, safety:5, seats:5, bodyType:'Sedan',    trans:'CVT automatic',    cc:2487, notes:'Smooth, efficient hybrid sedan' },
  { plate:'IONIQ1', name:'2023 Hyundai IONIQ 6',           make:'Hyundai',     model:'IONIQ 6',    year:2023, fuelType:'ev',     price:74000, l100:null, kwh:14.3, co2:0,   stars:6.0, safety:5, seats:5, bodyType:'Sedan',    trans:'Single speed',      cc:null, notes:'Exceptional EV range' },
  { plate:'POLO01', name:'2022 Volkswagen Polo',           make:'Volkswagen',  model:'Polo',       year:2022, fuelType:'petrol', price:28000, l100:5.9,  kwh:null, co2:136, stars:3.5, safety:5, seats:5, bodyType:'Hatchback', trans:'7-speed DSG',      cc:999,  notes:'Frugal small hatch' },
  { plate:'HILUX1', name:'2022 Toyota HiLux SR5',          make:'Toyota',      model:'HiLux',      year:2022, fuelType:'diesel', price:58000, l100:9.1,  kwh:null, co2:239, stars:1.5, safety:5, seats:5, bodyType:'Ute',      trans:'6-speed automatic', cc:2755, notes:'NZ\'s favourite ute' },
  { plate:'CIVIC1', name:'2023 Honda Civic e:HEV',         make:'Honda',       model:'Civic',      year:2023, fuelType:'hybrid', price:45000, l100:4.6,  kwh:null, co2:105, stars:5.0, safety:5, seats:5, bodyType:'Sedan',    trans:'CVT automatic',    cc:1993, notes:'Sporty and efficient hybrid' },
];

async function fetchCarjam(plate) {
  const hit = cache.get('cj:' + plate);
  if (hit) return { ...hit, _cached: true };
  if (!CARJAM_KEY) throw new Error('No CARJAM_TEST_KEY set');
  const url = `https://test.carjam.co.nz/a/vehicle:abcd?key=${encodeURIComponent(CARJAM_KEY)}&plate=${encodeURIComponent(plate)}`;
  const res = await fetch(url, { headers: { Authorization: CARJAM_BASIC } });
  const text = await res.text();
  console.log('[carjam]', plate, text.slice(0, 200));
  if (!res.ok) throw new Error('Carjam HTTP ' + res.status);
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Bad response from Carjam'); }
  if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : data.error.message || 'Carjam error');
  if (!data?.make) throw new Error('Plate not found');
  cache.set('cj:' + plate, data);
  return data;
}

app.get('/api/vehicles', (_req, res) => res.json(VEHICLES));

app.get('/api/lookup/:plate', async (req, res) => {
  const plate = req.params.plate.toUpperCase().replace(/\s/g, '');
  if (!/^[A-Z0-9]{1,8}$/.test(plate)) return res.status(400).json({ error: 'Invalid plate' });
  const demo = VEHICLES.find(v => v.plate === plate);
  if (demo) return res.json({ ...demo, _demo: true });
  try {
    const cj = await fetchCarjam(plate);
    res.json({
      plate: cj.plate,
      name: [cj.year_of_manufacture, cj.make, cj.model].filter(Boolean).join(' '),
      make: cj.make,
      model: cj.model,
      year: cj.year_of_manufacture,
      fuelType: FUEL_TYPE_MAP[String(cj.fuel_type)] || 'petrol',
      colour: cj.main_colour,
      trans: cj.transmission,
      cc: cj.cc_rating,
      odometer: cj.latest_odometer_reading,
      wof: cj.result_of_latest_wof_inspection,
      _cached: cj._cached || false,
    });
  } catch (err) {
    console.error('[lookup]', plate, err.message);
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/health', (_req, res) => res.json({ ok: true, vehicles: VEHICLES.length, carjam: !!CARJAM_KEY }));
app.get('/', (_req, res) => res.send(HTML));

app.listen(PORT, () => {
  console.log('\n  NZ Car Comparator v3');
  console.log('  ─────────────────────');
  console.log('  Open: http://localhost:' + PORT + '\n');
});

const HTML = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>WheelDeal NZ — Car Cost Comparator</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"><\/script>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root {
  --teal:#0ecfb0; --teal-d:#09a88e; --teal-glow:rgba(14,207,176,.15);
  --amber:#f59e0b; --amber-d:#d97706;
  --a-accent:#3b82f6; --b-accent:#0ecfb0;
}
[data-theme="dark"] {
  --bg:#0d1117; --bg-2:#161b22; --bg-3:#21262d; --bg-4:#30363d;
  --border:#30363d; --border-2:#484f58;
  --tx-1:#e6edf3; --tx-2:#8b949e; --tx-3:#484f58;
  --card-bg:#161b22; --card-hover:#1c2128;
  --input-bg:#0d1117; --input-border:#30363d;
  --shadow:0 0 0 1px rgba(255,255,255,.04),0 8px 24px rgba(0,0,0,.4);
  --shadow-sm:0 0 0 1px rgba(255,255,255,.04),0 2px 8px rgba(0,0,0,.3);
  --header-bg:rgba(13,17,23,.85);
}
[data-theme="light"] {
  --bg:#f0f4f8; --bg-2:#ffffff; --bg-3:#f8fafc; --bg-4:#e2e8f0;
  --border:#e2e8f0; --border-2:#cbd5e1;
  --tx-1:#0f172a; --tx-2:#64748b; --tx-3:#cbd5e1;
  --card-bg:#ffffff; --card-hover:#f8fafc;
  --input-bg:#ffffff; --input-border:#e2e8f0;
  --shadow:0 1px 3px rgba(0,0,0,.06),0 4px 16px rgba(0,0,0,.06);
  --shadow-sm:0 1px 2px rgba(0,0,0,.05);
  --header-bg:rgba(240,244,248,.9);
}
body { font-family:'DM Sans',sans-serif; background:var(--bg); color:var(--tx-1); min-height:100vh; transition:background .3s,color .3s; }
header { position:sticky;top:0;z-index:200;height:58px;background:var(--header-bg);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;padding:0 24px; }
.logo { display:flex;align-items:center;gap:12px; }
.logo-mark { width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#0ecfb0,#3b82f6);display:flex;align-items:center;justify-content:center;font-size:17px;box-shadow:0 0 16px rgba(14,207,176,.3); }
.logo-text { font-size:17px;font-weight:700;color:var(--tx-1);letter-spacing:-.03em; }
.logo-text span { color:var(--teal); }
.logo-sub { font-size:11px;color:var(--tx-2);margin-top:1px; }
.header-right { display:flex;align-items:center;gap:10px; }
.theme-toggle { width:40px;height:22px;border-radius:11px;background:var(--bg-4);border:1px solid var(--border-2);cursor:pointer;position:relative;transition:background .3s;flex-shrink:0; }
.theme-toggle::after { content:'';position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:var(--tx-2);transition:transform .3s,background .3s; }
[data-theme="dark"] .theme-toggle::after { transform:translateX(18px);background:var(--teal); }
.theme-label { font-size:11px;color:var(--tx-2);font-weight:500; }
.nz-badge { font-size:10px;font-weight:700;letter-spacing:.05em;padding:3px 8px;border-radius:20px;background:var(--teal-glow);color:var(--teal);border:1px solid rgba(14,207,176,.2); }
.hero { position:relative;overflow:hidden;padding:40px 24px 36px;background:var(--bg-2);border-bottom:1px solid var(--border);margin-bottom:32px; }
.hero::before { content:'';position:absolute;inset:0;background:radial-gradient(ellipse 80% 60% at 50% 0%,rgba(14,207,176,.07) 0%,transparent 70%);pointer-events:none; }
.hero-inner { max-width:1040px;margin:0 auto;position:relative; }
.hero-label { font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--teal);margin-bottom:10px; }
.hero-title { font-family:'DM Serif Display',serif;font-size:clamp(26px,4vw,42px);color:var(--tx-1);line-height:1.15;margin-bottom:8px; }
.hero-title em { font-style:normal;color:var(--teal); }
.hero-sub { font-size:14px;color:var(--tx-2);margin-bottom:28px;max-width:520px; }
.km-widget { background:var(--bg-3);border:1px solid var(--border);border-radius:14px;padding:18px 20px;max-width:600px; }
.km-widget-top { display:flex;align-items:baseline;justify-content:space-between;margin-bottom:12px; }
.km-widget-label { font-size:13px;font-weight:600;color:var(--tx-2); }
.km-number { font-family:'DM Serif Display',serif;font-size:32px;color:var(--teal);letter-spacing:-.02em; }
.km-unit { font-size:14px;color:var(--tx-2);margin-left:4px; }
input[type=range] { width:100%;height:4px;border-radius:2px;cursor:pointer;accent-color:var(--teal);background:linear-gradient(to right,var(--teal) 0%,var(--teal) 30%,var(--bg-4) 30%,var(--bg-4) 100%); }
.km-ticks { display:flex;justify-content:space-between;margin-top:6px;font-size:10px;color:var(--tx-3); }
main { max-width:1040px;margin:0 auto;padding:0 16px 80px; }
.cars-grid { display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px; }
.car-card { background:var(--card-bg);border:1px solid var(--border);border-radius:16px;overflow:hidden;transition:box-shadow .2s,border-color .2s;box-shadow:var(--shadow-sm); }
.car-card:hover { border-color:var(--border-2);box-shadow:var(--shadow); }
.car-card-top { padding:16px 16px 0; }
.car-stripe { height:3px;border-radius:3px 3px 0 0;margin-bottom:14px;background:linear-gradient(90deg,var(--a-accent),rgba(59,130,246,.3)); }
.car-b .car-stripe { background:linear-gradient(90deg,var(--b-accent),rgba(14,207,176,.3)); }
.car-pill { display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:3px 8px;border-radius:20px;margin-bottom:12px; }
.car-a .car-pill { background:rgba(59,130,246,.1);color:#60a5fa;border:1px solid rgba(59,130,246,.2); }
.car-b .car-pill { background:rgba(14,207,176,.1);color:var(--teal);border:1px solid rgba(14,207,176,.2); }
.mode-toggle { display:flex;background:var(--bg-3);border-radius:8px;padding:3px;gap:2px;margin-bottom:12px; }
.mode-btn { flex:1;padding:5px 8px;border:none;background:transparent;border-radius:6px;font-size:11px;font-weight:600;font-family:'DM Sans',sans-serif;color:var(--tx-2);cursor:pointer;transition:all .15s; }
.mode-btn.active { background:var(--bg-2);color:var(--tx-1);box-shadow:var(--shadow-sm); }
.search-panel { display:none; }
.search-panel.active { display:block; }
.plate-row { display:flex;gap:8px;margin-bottom:4px; }
.plate-input { flex:1;background:var(--input-bg);border:1px solid var(--input-border);border-radius:8px;padding:9px 12px;font-size:15px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--tx-1);font-family:'DM Sans',sans-serif;outline:none;transition:border-color .15s,box-shadow .15s; }
.plate-input:focus { border-color:var(--teal);box-shadow:0 0 0 3px var(--teal-glow); }
.action-btn { padding:0 14px;height:40px;border-radius:8px;border:none;font-size:12px;font-weight:700;font-family:'DM Sans',sans-serif;cursor:pointer;transition:all .15s;white-space:nowrap; }
.car-a .action-btn { background:rgba(59,130,246,.15);color:#60a5fa; }
.car-a .action-btn:hover { background:rgba(59,130,246,.25); }
.car-b .action-btn { background:var(--teal-glow);color:var(--teal); }
.car-b .action-btn:hover { background:rgba(14,207,176,.25); }
.action-btn:disabled { opacity:.4;cursor:wait; }
.manual-grid { display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px; }
.manual-grid .field:last-child { grid-column:1/-1; }
.search-box { position:relative;margin-bottom:4px; }
.search-input { width:100%;background:var(--input-bg);border:1px solid var(--input-border);border-radius:8px;padding:9px 36px 9px 12px;font-size:13px;color:var(--tx-1);font-family:'DM Sans',sans-serif;outline:none;transition:border-color .15s,box-shadow .15s; }
.search-input::placeholder { color:var(--tx-3); }
.car-a .search-input:focus { border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.1); }
.car-b .search-input:focus { border-color:var(--teal);box-shadow:0 0 0 3px var(--teal-glow); }
.search-icon { position:absolute;right:10px;top:50%;transform:translateY(-50%);color:var(--tx-3);font-size:14px;pointer-events:none; }
.dropdown-list { position:absolute;top:calc(100% + 4px);left:0;right:0;background:var(--bg-2);border:1px solid var(--border-2);border-radius:10px;box-shadow:var(--shadow);z-index:100;max-height:240px;overflow-y:auto;display:none; }
.dropdown-list.open { display:block; }
.dropdown-item { padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);transition:background .1s; }
.dropdown-item:last-child { border-bottom:none; }
.dropdown-item:hover { background:var(--bg-3); }
.di-name { font-size:13px;font-weight:600;color:var(--tx-1);margin-bottom:2px; }
.di-meta { font-size:11px;color:var(--tx-2); }
.fuel-chip { display:inline-block;font-size:9px;font-weight:700;letter-spacing:.05em;padding:1px 5px;border-radius:4px;margin-left:5px;vertical-align:middle; }
.fc-petrol{background:#92400e22;color:#f59e0b}
.fc-diesel{background:#99182222;color:#f87171}
.fc-ev{background:#06573822;color:#34d399}
.fc-hybrid{background:#0c4a6e22;color:#38bdf8}
.fc-phev{background:#6b21a822;color:#c084fc}
.status-line { font-size:11px;min-height:14px;margin-bottom:6px;padding:0 2px; }
.s-ok { color:var(--teal); }
.s-err { color:#f87171; }
.s-load { color:var(--tx-2); }
.vbanner { background:var(--bg-3);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:12px;display:none;animation:slideIn .2s ease; }
.vbanner.show { display:block; }
@keyframes slideIn { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
.vb-name { font-size:14px;font-weight:700;color:var(--tx-1);margin-bottom:4px; }
.vb-meta { font-size:11px;color:var(--tx-2);line-height:1.6;margin-bottom:8px; }
.vb-tags { display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px; }
.tag { font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px;border:1px solid transparent; }
.tag-petrol{background:#92400e22;color:#fbbf24;border-color:#92400e44}
.tag-diesel{background:#99182222;color:#f87171;border-color:#99182244}
.tag-ev{background:#06573822;color:#34d399;border-color:#06573844}
.tag-hybrid{background:#0c4a6e22;color:#38bdf8;border-color:#0c4a6e44}
.tag-phev{background:#6b21a822;color:#c084fc;border-color:#6b21a844}
.tag-co2-zero{background:#06573822;color:#34d399;border-color:#06573844}
.tag-co2-low{background:#06573822;color:#34d399;border-color:#06573844}
.tag-co2-mid{background:#92400e22;color:#fbbf24;border-color:#92400e44}
.tag-co2-high{background:#99182222;color:#f87171;border-color:#99182244}
.tag-neutral{background:var(--bg-4);color:var(--tx-2);border-color:var(--border-2)}
.trademe-btn { display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:var(--tx-2);background:var(--bg-4);border:1px solid var(--border-2);border-radius:20px;padding:4px 10px;cursor:pointer;text-decoration:none;transition:all .15s; }
.trademe-btn:hover { border-color:var(--teal);color:var(--teal); }
.tm-dot { width:8px;height:8px;border-radius:50%;background:#e4002b;flex-shrink:0; }
.card-fields { padding:14px 16px 16px;border-top:1px solid var(--border); }
.field { margin-bottom:10px; }
.field label { display:block;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--tx-2);margin-bottom:4px; }
.field input,.field select { width:100%;background:var(--input-bg);border:1px solid var(--input-border);border-radius:8px;padding:8px 10px;font-size:13px;color:var(--tx-1);font-family:'DM Sans',sans-serif;outline:none;transition:border-color .15s,box-shadow .15s; }
.field input:focus,.field select:focus { border-color:var(--teal);box-shadow:0 0 0 3px var(--teal-glow); }
.field select { appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%238b949e' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14L2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;padding-right:28px; }
.fsub{display:none}.fsub.show{display:block}
.assumptions-card { background:var(--card-bg);border:1px solid var(--border);border-radius:16px;padding:20px;margin-bottom:20px;box-shadow:var(--shadow-sm); }
.section-title { font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--tx-2);margin-bottom:14px; }
.agrid { display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px; }
.action-row { display:flex;align-items:center;justify-content:space-between;margin-top:16px;gap:10px;flex-wrap:wrap; }
.compare-btn { background:linear-gradient(135deg,var(--teal),var(--teal-d));color:#000;border:none;border-radius:10px;padding:12px 28px;font-size:14px;font-weight:700;font-family:'DM Sans',sans-serif;cursor:pointer;transition:all .2s;box-shadow:0 0 20px rgba(14,207,176,.25);letter-spacing:-.01em; }
.compare-btn:hover { transform:translateY(-1px);box-shadow:0 0 28px rgba(14,207,176,.4); }
.compare-btn:active { transform:translateY(0); }
.swap-btn { background:var(--bg-3);border:1px solid var(--border-2);border-radius:10px;padding:11px 16px;font-size:13px;font-weight:600;font-family:'DM Sans',sans-serif;color:var(--tx-2);cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:6px; }
.swap-btn:hover { border-color:var(--teal);color:var(--teal); }
#results { display:none; }
.results-enter { animation:fadeUp .4s ease both; }
@keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
.result-topbar { display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px; }
.be-badge { font-size:13px;font-weight:700;padding:7px 16px;border-radius:20px;transition:all .3s; }
.be-badge.cross { background:rgba(59,130,246,.15);color:#60a5fa;border:1px solid rgba(59,130,246,.2); }
.be-badge.nocross { background:var(--bg-3);color:var(--tx-2);border:1px solid var(--border-2); }
.share-btn { display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--tx-2);background:var(--bg-3);border:1px solid var(--border-2);border-radius:20px;padding:6px 14px;cursor:pointer;transition:all .15s;font-family:'DM Sans',sans-serif; }
.share-btn:hover { border-color:var(--teal);color:var(--teal); }
.share-toast { position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:var(--teal);color:#000;padding:10px 22px;border-radius:20px;font-size:13px;font-weight:700;opacity:0;transition:opacity .3s;pointer-events:none;z-index:300; }
.share-toast.show { opacity:1; }
.summary-grid { display:grid;grid-template-columns:repeat(4,1fr);background:var(--card-bg);border:1px solid var(--border);border-radius:16px;overflow:hidden;margin-bottom:20px;box-shadow:var(--shadow-sm); }
.smetric { padding:18px 18px;border-right:1px solid var(--border);position:relative;overflow:hidden; }
.smetric:last-child { border-right:none; }
.smetric::before { content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--border); }
.smetric.highlight::before { background:var(--teal); }
.sm-label { font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--tx-2);margin-bottom:8px; }
.sm-value { font-family:'DM Serif Display',serif;font-size:26px;color:var(--tx-1);letter-spacing:-.02em;margin-bottom:4px;transition:all .4s; }
.sm-value.teal { color:var(--teal); }
.sm-sub { font-size:11px;color:var(--tx-2); }
.tabs-card { background:var(--card-bg);border:1px solid var(--border);border-radius:16px;overflow:hidden;margin-bottom:20px;box-shadow:var(--shadow-sm); }
.tabs-nav { display:flex;border-bottom:1px solid var(--border);background:var(--bg-3);overflow-x:auto; }
.tab-btn { flex:1;min-width:100px;padding:14px 16px;border:none;background:transparent;font-size:12px;font-weight:700;letter-spacing:.02em;font-family:'DM Sans',sans-serif;color:var(--tx-2);cursor:pointer;border-bottom:2px solid transparent;transition:all .15s;white-space:nowrap; }
.tab-btn.active { color:var(--teal);border-bottom-color:var(--teal);background:var(--card-bg); }
.tab-panel { display:none;padding:22px; }
.tab-panel.active { display:block;animation:fadeIn .2s ease; }
@keyframes fadeIn { from{opacity:0} to{opacity:1} }
.chart-legend { display:flex;gap:18px;margin-bottom:16px;flex-wrap:wrap; }
.leg-item { display:flex;align-items:center;gap:7px;font-size:12px;font-weight:600;color:var(--tx-2); }
.leg-sw { width:24px;height:3px;border-radius:2px;flex-shrink:0; }
.co2-section { margin-top:4px; }
.co2-row { display:flex;align-items:center;gap:12px;margin-bottom:14px; }
.co2-lbl { width:170px;flex-shrink:0;font-size:12px;font-weight:600;color:var(--tx-1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
.co2-track { flex:1;background:var(--bg-4);border-radius:6px;height:28px;overflow:hidden;position:relative; }
.co2-fill { height:100%;border-radius:6px;display:flex;align-items:center;padding:0 10px;font-size:10px;font-weight:700;color:rgba(255,255,255,.9);transition:width .8s cubic-bezier(.34,1.56,.64,1);min-width:4px; }
.co2-val { width:90px;text-align:right;flex-shrink:0;font-size:11px;font-weight:600;color:var(--tx-2); }
.tree-card { background:linear-gradient(135deg,#022c22,#064e3b);border:1px solid rgba(14,207,176,.15);border-radius:14px;padding:20px;margin-bottom:20px;display:flex;align-items:flex-start;gap:16px; }
.tree-icon { font-size:40px;line-height:1;flex-shrink:0; }
.tree-label { font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(14,207,176,.6);margin-bottom:6px; }
.tree-num { font-family:'DM Serif Display',serif;font-size:32px;color:var(--teal);display:block;margin-bottom:4px;letter-spacing:-.02em; }
.tree-text { font-size:13px;color:rgba(255,255,255,.7);line-height:1.6; }
.comp-table { width:100%;border-collapse:collapse;font-size:13px; }
.comp-table th { text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--tx-2);padding:8px 12px;border-bottom:2px solid var(--border); }
.comp-table td { padding:10px 12px;border-bottom:1px solid var(--border);color:var(--tx-1); }
.comp-table tr:last-child td { border-bottom:none; }
.comp-table .cat-hd td { background:var(--bg-3);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--tx-2);padding:6px 12px; }
.win-a { color:#60a5fa;font-weight:700; }
.win-b { color:var(--teal);font-weight:700; }
.cost-table { width:100%;border-collapse:collapse;font-size:13px; }
.cost-table th { text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--tx-2);padding:8px 12px;border-bottom:2px solid var(--border); }
.cost-table td { padding:11px 12px;border-bottom:1px solid var(--border);color:var(--tx-1); }
.cost-table tr:last-child td { border-bottom:none;font-weight:700;font-size:14px; }
@media(max-width:660px){ .cars-grid{grid-template-columns:1fr} .summary-grid{grid-template-columns:1fr 1fr} .co2-lbl{width:90px} .hero-title{font-size:24px} .manual-grid{grid-template-columns:1fr} }
</style>
</head>
<body>
<header>
  <div class="logo">
    <div class="logo-mark">⚡</div>
    <div>
      <div class="logo-text">Wheel<span>Deal</span></div>
      <div class="logo-sub">NZ Car Cost Comparator</div>
    </div>
  </div>
  <div class="header-right">
    <span class="nz-badge">🇳🇿 NZ</span>
    <span class="theme-label" id="theme-label">Dark</span>
    <button class="theme-toggle" onclick="toggleTheme()" aria-label="Toggle theme"></button>
  </div>
</header>
<div class="hero">
  <div class="hero-inner">
    <div class="hero-label">Free · No signup · NZ data</div>
    <h1 class="hero-title">Which car is actually <em>cheaper</em><br>to own?</h1>
    <p class="hero-sub">Compare any two vehicles by total cost of ownership — fuel, running costs, and purchase price — and find your break-even point.</p>
    <div class="km-widget">
      <div class="km-widget-top">
        <span class="km-widget-label">How far do you drive each year?</span>
        <div><span class="km-number" id="km-display">15,000</span><span class="km-unit">km/yr</span></div>
      </div>
      <input type="range" id="km" min="5000" max="50000" step="1000" value="15000" oninput="updateKm()">
      <div class="km-ticks"><span>5k</span><span>15k</span><span>25k</span><span>35k</span><span>50k</span></div>
    </div>
  </div>
</div>
<main>
<div class="cars-grid">
  <div class="car-card car-a" id="card-a">
    <div class="car-stripe"></div>
    <div class="car-card-top">
      <div class="car-pill">⬤ Car A</div>
      <div class="mode-toggle">
        <button class="mode-btn active" onclick="setMode('a','browse')">Browse</button>
        <button class="mode-btn" onclick="setMode('a','plate')">Plate</button>
        <button class="mode-btn" onclick="setMode('a','manual')">Manual</button>
      </div>
      <div class="search-panel active" id="a-browse">
        <div class="search-box">
          <input class="search-input" id="a-search" placeholder="Search make, model or year…" oninput="filterList('a')" onfocus="openList('a')" onblur="setTimeout(()=>closeList('a'),150)">
          <span class="search-icon">🔍</span>
          <div class="dropdown-list" id="a-list"></div>
        </div>
      </div>
      <div class="search-panel" id="a-plate">
        <div class="plate-row">
          <input class="plate-input" id="a-plate-input" placeholder="ABC123" maxlength="8" oninput="this.value=this.value.toUpperCase()" onkeydown="if(event.key==='Enter')lookupPlate('a')">
          <button class="action-btn" id="a-lbtn" onclick="lookupPlate('a')">Look up</button>
        </div>
      </div>
      <div class="search-panel" id="a-manual">
        <div class="manual-grid">
          <div class="field"><label>Make</label><input type="text" id="a-make" placeholder="e.g. Toyota"></div>
          <div class="field"><label>Model</label><input type="text" id="a-model" placeholder="e.g. Corolla"></div>
          <div class="field"><label>Year</label><input type="number" id="a-year" placeholder="2021" min="1990" max="2025"></div>
          <div class="field"><label>Body type</label><select id="a-body"><option>Sedan</option><option>Hatchback</option><option>SUV</option><option>Ute</option><option>Wagon</option><option>Van</option></select></div>
        </div>
        <button class="action-btn" style="width:100%;margin-bottom:6px;height:36px" onclick="applyManual('a')">Use this car →</button>
      </div>
      <div class="status-line" id="a-status"></div>
      <div class="vbanner" id="a-banner">
        <div class="vb-name" id="a-vname"></div>
        <div class="vb-meta" id="a-vmeta"></div>
        <div class="vb-tags" id="a-vtags"></div>
        <a class="trademe-btn" id="a-trademe" href="#" target="_blank" rel="noopener"><span class="tm-dot"></span>Search similar on Trade Me ↗</a>
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
  <div class="car-card car-b" id="card-b">
    <div class="car-stripe"></div>
    <div class="car-card-top">
      <div class="car-pill">⬤ Car B</div>
      <div class="mode-toggle">
        <button class="mode-btn active" onclick="setMode('b','browse')">Browse</button>
        <button class="mode-btn" onclick="setMode('b','plate')">Plate</button>
        <button class="mode-btn" onclick="setMode('b','manual')">Manual</button>
      </div>
      <div class="search-panel active" id="b-browse">
        <div class="search-box">
          <input class="search-input" id="b-search" placeholder="Search make, model or year…" oninput="filterList('b')" onfocus="openList('b')" onblur="setTimeout(()=>closeList('b'),150)">
          <span class="search-icon">🔍</span>
          <div class="dropdown-list" id="b-list"></div>
        </div>
      </div>
      <div class="search-panel" id="b-plate">
        <div class="plate-row">
          <input class="plate-input" id="b-plate-input" placeholder="EV2024" maxlength="8" oninput="this.value=this.value.toUpperCase()" onkeydown="if(event.key==='Enter')lookupPlate('b')">
          <button class="action-btn" id="b-lbtn" onclick="lookupPlate('b')">Look up</button>
        </div>
      </div>
      <div class="search-panel" id="b-manual">
        <div class="manual-grid">
          <div class="field"><label>Make</label><input type="text" id="b-make" placeholder="e.g. Tesla"></div>
          <div class="field"><label>Model</label><input type="text" id="b-model" placeholder="e.g. Model 3"></div>
          <div class="field"><label>Year</label><input type="number" id="b-year" placeholder="2023" min="1990" max="2025"></div>
          <div class="field"><label>Body type</label><select id="b-body"><option>Sedan</option><option>Hatchback</option><option>SUV</option><option>Ute</option><option>Wagon</option><option>Van</option></select></div>
        </div>
        <button class="action-btn" style="width:100%;margin-bottom:6px;height:36px" onclick="applyManual('b')">Use this car →</button>
      </div>
      <div class="status-line" id="b-status"></div>
      <div class="vbanner" id="b-banner">
        <div class="vb-name" id="b-vname"></div>
        <div class="vb-meta" id="b-vmeta"></div>
        <div class="vb-tags" id="b-vtags"></div>
        <a class="trademe-btn" id="b-trademe" href="#" target="_blank" rel="noopener"><span class="tm-dot"></span>Search similar on Trade Me ↗</a>
      </div>
    </div>
    <div class="card-fields">
      <div class="field"><label>Purchase price (NZD)</label><input type="number" id="b-price" value="45000" min="0" step="500"></div>
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
  <div class="section-title">Fuel prices & projection</div>
  <div class="agrid">
    <div class="field"><label>Petrol ($/L)</label><input type="number" id="pp" value="2.50" step="0.05" min="0"></div>
    <div class="field"><label>Diesel ($/L)</label><input type="number" id="dp" value="1.85" step="0.05" min="0"></div>
    <div class="field"><label>Electricity ($/kWh)</label><input type="number" id="ep" value="0.30" step="0.01" min="0"></div>
    <div class="field"><label>RUC diesel ($/1000km)</label><input type="number" id="ruc-d" value="76" step="1" min="0"></div>
    <div class="field"><label>RUC EV ($/1000km)</label><input type="number" id="ruc-e" value="76" step="1" min="0"></div>
    <div class="field"><label>Years to project</label><input type="number" id="yrs" value="10" step="1" min="1" max="30"></div>
  </div>
  <div class="action-row">
    <button class="swap-btn" onclick="swapCars()">⇄ Swap cars</button>
    <button class="compare-btn" onclick="compare()">Compare now →</button>
  </div>
</div>
<div id="results">
  <div class="result-topbar">
    <div class="be-badge nocross" id="be-badge">—</div>
    <button class="share-btn" onclick="shareResults()">↑ Share comparison</button>
  </div>
  <div class="summary-grid" id="summary-grid">
    <div class="smetric"><div class="sm-label">Car A annual</div><div class="sm-value" id="sm-a">—</div><div class="sm-sub" id="sm-a-sub"></div></div>
    <div class="smetric"><div class="sm-label">Car B annual</div><div class="sm-value" id="sm-b">—</div><div class="sm-sub" id="sm-b-sub"></div></div>
    <div class="smetric"><div class="sm-label">Annual saving</div><div class="sm-value" id="sm-save">—</div><div class="sm-sub" id="sm-save-sub"></div></div>
    <div class="smetric highlight"><div class="sm-label" id="sm-total-label">Total over 10 yrs</div><div class="sm-value teal" id="sm-total">—</div><div class="sm-sub" id="sm-total-sub"></div></div>
  </div>
  <div class="tabs-card">
    <div class="tabs-nav">
      <button class="tab-btn active" onclick="setTab('overview')">📈 Overview</button>
      <button class="tab-btn" onclick="setTab('costs')">💰 Cost breakdown</button>
      <button class="tab-btn" onclick="setTab('environment')">🌿 Environment</button>
      <button class="tab-btn" onclick="setTab('details')">📋 Full comparison</button>
    </div>
    <div class="tab-panel active" id="tab-overview">
      <div class="chart-legend">
        <div class="leg-item"><div class="leg-sw" style="background:#3b82f6"></div><span id="leg-a">Car A</span></div>
        <div class="leg-item"><div class="leg-sw" style="background:#0ecfb0"></div><span id="leg-b">Car B</span></div>
      </div>
      <div style="position:relative;height:270px"><canvas id="chart"></canvas></div>
      <p style="font-size:11px;color:var(--tx-2);margin-top:10px;text-align:center">Cumulative total cost of ownership (purchase price + running costs)</p>
    </div>
    <div class="tab-panel" id="tab-costs">
      <table class="cost-table" id="cost-table"></table>
    </div>
    <div class="tab-panel" id="tab-environment">
      <div class="tree-card">
        <div class="tree-icon">🌳</div>
        <div>
          <div class="tree-label">Environmental impact — per year at <span id="tree-km">15,000</span> km</div>
          <div class="tree-text" id="tree-text"></div>
        </div>
      </div>
      <div class="section-title" style="margin-bottom:14px">Annual CO₂ emissions</div>
      <div class="co2-section" id="co2-bars"></div>
    </div>
    <div class="tab-panel" id="tab-details">
      <table class="comp-table" id="detail-table"></table>
    </div>
  </div>
</div>
</main>
<div class="share-toast" id="share-toast">Link copied! ✓</div>
<script>
let vehicles = [], chartInst = null;
const state = {
  a:{name:'Car A',make:'',model:'',year:'',fuelType:'petrol',co2:0,stars:null,safety:null,seats:null,bodyType:'',trans:'',cc:null,notes:''},
  b:{name:'Car B',make:'',model:'',year:'',fuelType:'ev',co2:0,stars:null,safety:null,seats:null,bodyType:'',trans:'',cc:null,notes:''}
};
function toggleTheme(){
  const html = document.documentElement;
  const dark = html.dataset.theme === 'dark';
  html.dataset.theme = dark ? 'light' : 'dark';
  document.getElementById('theme-label').textContent = dark ? 'Light' : 'Dark';
  localStorage.setItem('theme', dark ? 'light' : 'dark');
  if (chartInst) updateChartColors();
}
function updateChartColors(){
  if (!chartInst) return;
  const dark = document.documentElement.dataset.theme === 'dark';
  const gridColor = dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)';
  const tickColor = dark ? '#8b949e' : '#64748b';
  chartInst.options.scales.x.ticks.color = tickColor;
  chartInst.options.scales.y.ticks.color = tickColor;
  chartInst.options.scales.x.grid.color = gridColor;
  chartInst.options.scales.y.grid.color = gridColor;
  chartInst.options.plugins.tooltip.backgroundColor = dark ? '#1c2128' : '#ffffff';
  chartInst.options.plugins.tooltip.borderColor = dark ? '#30363d' : '#e2e8f0';
  chartInst.options.plugins.tooltip.titleColor = dark ? '#e6edf3' : '#0f172a';
  chartInst.options.plugins.tooltip.bodyColor = dark ? '#8b949e' : '#64748b';
  chartInst.update();
}
(function(){
  const saved = localStorage.getItem('theme');
  if (saved) {
    document.documentElement.dataset.theme = saved;
    document.getElementById('theme-label').textContent = saved === 'dark' ? 'Dark' : 'Light';
  }
})();
async function init(){
  try {
    const r = await fetch('/api/vehicles');
    vehicles = await r.json();
    renderList('a', '');
    renderList('b', '');
  } catch (e) {
    console.error(e);
  }
  const p = new URLSearchParams(location.search);
  if (p.get('km')) document.getElementById('km').value = p.get('km');
  ['pp','dp','ep','yrs','ruc-d','ruc-e'].forEach(k => { if (p.get(k)) document.getElementById(k).value = p.get(k); });
  ['a','b'].forEach(c => {
    if (p.get(c+'fuel')) { document.getElementById(c+'-fuel').value = p.get(c+'fuel'); uf(c); }
    if (p.get(c+'price')) document.getElementById(c+'-price').value = p.get(c+'price');
    if (p.get(c+'l100')) document.getElementById(c+'-l100').value = p.get(c+'l100');
    if (p.get(c+'kwh')) document.getElementById(c+'-kwh').value = p.get(c+'kwh');
    if (p.get(c+'pl100')) document.getElementById(c+'-pl100').value = p.get(c+'pl100');
    if (p.get(c+'pkwh')) document.getElementById(c+'-pkwh').value = p.get(c+'pkwh');
    if (p.get(c+'ppct')) document.getElementById(c+'-ppct').value = p.get(c+'ppct');
    if (p.get(c+'name')) {
      state[c].name = p.get(c+'name');
      state[c].co2 = parseFloat(p.get(c+'co2')) || 0;
      state[c].make = p.get(c+'make') || '';
      state[c].model = p.get(c+'model') || '';
      state[c].year = p.get(c+'year') || '';
      state[c].bodyType = p.get(c+'bodyType') || '';
      state[c].fuelType = p.get(c+'fuel') || 'petrol';
      showBanner(c, state[c]);
    }
  });
  updateKm();
  if (p.get('go') === '1') compare();
}
function updateKm(){
  const v = parseInt(document.getElementById('km').value, 10);
  document.getElementById('km-display').textContent = v.toLocaleString();
  const pct = (v - 5000) / (50000 - 5000) * 100;
  document.getElementById('km').style.background = 'linear-gradient(to right,var(--teal) 0%,var(--teal) ' + pct + '%,var(--bg-4) ' + pct + '%,var(--bg-4) 100%)';
}
function setMode(car, mode){
  ['browse','plate','manual'].forEach(m => document.getElementById(car+'-'+m).classList.toggle('active', m === mode));
  document.querySelectorAll('#card-'+car+' .mode-btn').forEach((b, i) => b.classList.toggle('active', ['browse','plate','manual'][i] === mode));
}
function renderList(car, q){
  const filtered = q ? vehicles.filter(v => (v.name + v.make + v.model + v.year + v.fuelType).toLowerCase().includes(q.toLowerCase())) : vehicles;
  const fcc = {petrol:'fc-petrol',diesel:'fc-diesel',ev:'fc-ev',hybrid:'fc-hybrid',phev:'fc-phev'};
  document.getElementById(car+'-list').innerHTML = filtered.slice(0,14).map(function(v){
    return '<div class="dropdown-item" onmousedown="selectVehicle(\'' + car + '\',\'' + v.plate + '\')">' +
      '<div class="di-name">' + v.name + '<span class="fuel-chip ' + (fcc[v.fuelType] || '') + '">' + v.fuelType.toUpperCase() + '</span></div>' +
      '<div class="di-meta">' + (v.bodyType || '') + ' · ' + (v.l100 ? v.l100 + ' L/100km' : v.kwh ? v.kwh + ' kWh/100km' : '') + ' · $' + v.price.toLocaleString() + '</div>' +
    '</div>';
  }).join('') || '<div class="dropdown-item" style="color:var(--tx-2)">No matches — try Manual tab</div>';
}
function filterList(car){ renderList(car, document.getElementById(car+'-search').value); openList(car); }
function openList(car){ document.getElementById(car+'-list').classList.add('open'); }
function closeList(car){ document.getElementById(car+'-list').classList.remove('open'); }
function selectVehicle(car, plate){
  const v = vehicles.find(x => x.plate === plate); if (!v) return;
  Object.assign(state[car], {name:v.name,make:v.make,model:v.model,year:v.year,fuelType:v.fuelType,co2:v.co2||0,stars:v.stars,safety:v.safety,seats:v.seats,bodyType:v.bodyType,trans:v.trans,cc:v.cc,notes:v.notes});
  document.getElementById(car+'-search').value = v.name;
  closeList(car);
  document.getElementById(car+'-price').value = v.price;
  document.getElementById(car+'-fuel').value = v.fuelType;
  uf(car);
  if (v.l100 != null) document.getElementById(car+'-l100').value = v.l100;
  if (v.kwh != null) document.getElementById(car+'-kwh').value = v.kwh;
  if (v.l100 != null && v.fuelType === 'phev') document.getElementById(car+'-pl100').value = v.l100;
  if (v.kwh != null && v.fuelType === 'phev') document.getElementById(car+'-pkwh').value = v.kwh;
  showBanner(car, v);
  setStatus(car, '');
}
async function lookupPlate(car){
  const plate = document.getElementById(car+'-plate-input').value.trim(); if (!plate) return;
  const btn = document.getElementById(car+'-lbtn'); btn.disabled = true; btn.textContent = '…';
  setStatus(car, 'Looking up ' + plate + '…', 's-load'); hideBanner(car);
  try {
    const r = await fetch('/api/lookup/' + encodeURIComponent(plate));
    const v = await r.json(); if (!r.ok) throw new Error(v.error || 'Not found');
    Object.assign(state[car], {name:v.name||plate,make:v.make||'',model:v.model||'',year:v.year||'',fuelType:v.fuelType||'petrol',co2:v.co2||0,stars:v.stars||null,safety:v.safety||null,seats:v.seats||null,bodyType:v.bodyType||'',trans:v.trans||v.transmission||'',cc:v.cc||null,notes:v.notes||''});
    document.getElementById(car+'-price').value = v.price || '';
    document.getElementById(car+'-fuel').value = v.fuelType || 'petrol';
    uf(car);
    if (v.l100 != null) document.getElementById(car+'-l100').value = v.l100;
    if (v.kwh != null) document.getElementById(car+'-kwh').value = v.kwh;
    if (v.l100 != null && (v.fuelType || '').toLowerCase() === 'phev') document.getElementById(car+'-pl100').value = v.l100;
    if (v.kwh != null && (v.fuelType || '').toLowerCase() === 'phev') document.getElementById(car+'-pkwh').value = v.kwh;
    showBanner(car, {...v, ...state[car]});
    setStatus(car, '✓ Found' + (v._demo ? ' (demo)' : v._cached ? ' (cached)' : ''), 's-ok');
  } catch (e) {
    setStatus(car, '✗ ' + e.message, 's-err');
  } finally {
    btn.disabled = false; btn.textContent = 'Look up';
  }
}
function applyManual(car){
  const make = document.getElementById(car+'-make').value.trim();
  const model = document.getElementById(car+'-model').value.trim();
  const year = document.getElementById(car+'-year').value.trim();
  const body = document.getElementById(car+'-body').value;
  if (!make && !model) { setStatus(car, 'Enter at least a make or model', 's-err'); return; }
  const name = [year, make, model].filter(Boolean).join(' ');
  Object.assign(state[car], {name, make, model, year, bodyType:body, fuelType:document.getElementById(car+'-fuel').value, co2:0});
  showBanner(car, state[car]); setStatus(car, '✓ Set — fill in price and fuel economy below', 's-ok');
}
function showBanner(car, v){
  const fl = {petrol:'Petrol',diesel:'Diesel',ev:'Electric',hybrid:'Hybrid',phev:'PHEV'};
  const ft = v.fuelType || 'petrol';
  const fCls = 'tag-' + ft;
  const co2 = v.co2 || 0;
  const co2cls = co2 === 0 ? 'tag-co2-zero' : co2 < 120 ? 'tag-co2-low' : co2 < 180 ? 'tag-co2-mid' : 'tag-co2-high';
  const co2txt = co2 === 0 ? 'Zero emissions' : co2 + ' g/km CO₂';
  let stars = '';
  if (v.stars) { stars = '<span class="tag tag-neutral">'; for (let i = 1; i <= 6; i++) stars += (i <= v.stars ? '★' : '☆'); stars += ' ' + v.stars + '/6</span>'; }
  let safety = '';
  if (v.safety) { safety = '<span class="tag tag-neutral">Safety '; for (let i = 1; i <= 5; i++) safety += (i <= v.safety ? '★' : '☆'); safety += '</span>'; }
  const meta = [(v.bodyType && v.year ? v.year + ' ' + v.bodyType : v.bodyType || v.year || ''), v.seats ? v.seats + ' seats' : '', v.cc ? v.cc + 'cc' : '', v.trans || ''].filter(Boolean).join(' · ');
  document.getElementById(car+'-vname').textContent = v.name || 'Unknown';
  document.getElementById(car+'-vmeta').textContent = meta;
  document.getElementById(car+'-vtags').innerHTML =
    '<span class="tag ' + fCls + '">' + (fl[ft] || ft) + '</span>' +
    '<span class="tag ' + co2cls + '">' + co2txt + '</span>' +
    (v.notes ? '<span class="tag tag-neutral">' + v.notes + '</span>' : '') +
    stars + safety;
  const make = (v.make || '').toLowerCase().replace(/\s+/g, '-');
  const model = (v.model || '').toLowerCase().replace(/\s+/g, '-');
  document.getElementById(car+'-trademe').href = make && model
    ? 'https://www.trademe.co.nz/a/motors/cars/' + make + '/' + model
    : make ? 'https://www.trademe.co.nz/a/motors/cars/' + make
    : 'https://www.trademe.co.nz/a/motors/cars';
  document.getElementById(car+'-banner').classList.add('show');
}
function hideBanner(car){ document.getElementById(car+'-banner').classList.remove('show'); }
function setStatus(car, msg, cls=''){ const el = document.getElementById(car+'-status'); el.textContent = msg; el.className = 'status-line ' + (cls || ''); }
function swapCars(){
  const tmp = {...state.a}; Object.assign(state.a, state.b); Object.assign(state.b, tmp);
  ['price','fuel','l100','kwh','pl100','pkwh','ppct'].forEach(f => {
    const a = document.getElementById('a-'+f), b = document.getElementById('b-'+f);
    if (a && b) { const t = a.value; a.value = b.value; b.value = t; }
  });
  ['a','b'].forEach(c => uf(c));
  const sA = document.getElementById('a-search').value, sB = document.getElementById('b-search').value;
  document.getElementById('a-search').value = sB; document.getElementById('b-search').value = sA;
  if (state.a.name && state.a.name !== 'Car A') showBanner('a', state.a); else hideBanner('a');
  if (state.b.name && state.b.name !== 'Car B') showBanner('b', state.b); else hideBanner('b');
}
function uf(car){
  const f = document.getElementById(car+'-fuel').value;
  document.getElementById(car+'-liq').classList.toggle('show', ['petrol','diesel','hybrid'].includes(f));
  document.getElementById(car+'-elec').classList.toggle('show', f === 'ev');
  document.getElementById(car+'-phev').classList.toggle('show', f === 'phev');
}
function setTab(id){
  document.querySelectorAll('.tab-btn').forEach((b, i) => b.classList.toggle('active', ['overview','costs','environment','details'][i] === id));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + id));
}
function g(id){ return parseFloat(document.getElementById(id).value) || 0; }
function runCost(car){
  const km = g('km'), pp = g('pp'), dp = g('dp'), ep = g('ep');
  const f = document.getElementById(car+'-fuel').value;
  if (f === 'ev') return (g(car+'-kwh') / 100) * km * ep + (km / 1000) * g('ruc-e');
  if (f === 'diesel') return (g(car+'-l100') / 100) * km * dp + (km / 1000) * g('ruc-d');
  if (f === 'hybrid') return (g(car+'-l100') / 100) * km * pp;
  if (f === 'phev') {
    const p = g(car+'-ppct') / 100;
    return p * (g(car+'-pkwh') / 100) * km * ep + (1 - p) * (g(car+'-pl100') / 100) * km * pp;
  }
  return (g(car+'-l100') / 100) * km * pp;
}
function fdesc(car){ return {petrol:'Petrol',diesel:'Diesel + RUC',ev:'Electricity + RUC',hybrid:'Hybrid (petrol)',phev:'PHEV blend'}[document.getElementById(car+'-fuel').value] || ''; }
function animateValue(el, end, prefix='$', suffix=''){
  const start = 0, duration = 600, startTime = performance.now();
  function step(now){
    const p = Math.min((now - startTime) / duration, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = prefix + Math.round(start + (end - start) * ease).toLocaleString() + suffix;
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
function treeFact(cA, cB, km){
  const KG = 21, diff = Math.abs(cA - cB) * km / 1000, trees = Math.round(diff / KG);
  const lo = cA <= cB ? state.a.name : state.b.name, hi = cA <= cB ? state.b.name : state.a.name;
  if (Math.max(cA, cB) === 0) return '<span class="tree-num">Both zero! 🎉</span><span>Both vehicles produce zero tailpipe emissions.</span>';
  if (trees === 0) return '<span>These vehicles have very similar emissions — less than one tree\'s worth of CO₂ difference per year.</span>';
  if (Math.min(cA, cB) === 0) return '<span class="tree-num">' + trees + ' trees/yr</span><span>The zero-emission option saves ' + Math.round(diff).toLocaleString() + ' kg of CO₂ every year versus the ' + hi + '.</span>';
  return '<span class="tree-num">' + trees + ' trees/yr</span><span>Choosing the ' + lo + ' over the ' + hi + ' avoids ' + Math.round(diff).toLocaleString() + ' kg of CO₂ every year.</span>';
}
function compare(){
  const yrs = Math.max(1, Math.round(g('yrs')));
  const pA = g('a-price'), pB = g('b-price');
  const rA = runCost('a'), rB = runCost('b');
  const km = g('km');
  state.a.fuelType = document.getElementById('a-fuel').value;
  state.b.fuelType = document.getElementById('b-fuel').value;
  const nA = state.a.name, nB = state.b.name;
  document.getElementById('leg-a').textContent = nA;
  document.getElementById('leg-b').textContent = nB;
  const labels = [], dA = [], dB = [];
  let beYr = null;
  for (let y = 0; y <= yrs; y++) {
    labels.push('Yr ' + y);
    dA.push(Math.round(pA + rA * y));
    dB.push(Math.round(pB + rB * y));
    if (!beYr && y > 0 && rA !== rB) {
      const pv = (pA + rA * (y - 1)) - (pB + rB * (y - 1));
      const cv = (pA + rA * y) - (pB + rB * y);
      if (pv * cv < 0) beYr = (y - 1 + Math.abs(pv) / Math.abs(rA - rB)).toFixed(1);
    }
  }
  const badge = document.getElementById('be-badge');
  if (beYr) { badge.textContent = 'Break-even at ' + beYr + ' years'; badge.className = 'be-badge cross'; }
  else { badge.textContent = ((pA + rA * yrs) <= (pB + rB * yrs) ? nA : nB) + ' cheaper over ' + yrs + ' yrs'; badge.className = 'be-badge nocross'; }
  const dark = document.documentElement.dataset.theme === 'dark';
  const gridC = dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)';
  const tickC = dark ? '#8b949e' : '#64748b';
  if (chartInst) chartInst.destroy();
  chartInst = new Chart(document.getElementById('chart'), {
    type:'line',
    data:{labels,datasets:[
      {label:nA,data:dA,borderColor:'#3b82f6',backgroundColor:'rgba(59,130,246,.08)',tension:0.4,pointRadius:0,borderWidth:2.5,fill:true},
      {label:nB,data:dB,borderColor:'#0ecfb0',backgroundColor:'rgba(14,207,176,.08)',tension:0.4,pointRadius:0,borderWidth:2.5,fill:true},
    ]},
    options:{
      responsive:true,maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{legend:{display:false},tooltip:{
        backgroundColor:dark?'#1c2128':'#ffffff',borderColor:dark?'#30363d':'#e2e8f0',borderWidth:1,
        titleColor:dark?'#e6edf3':'#0f172a',bodyColor:dark?'#8b949e':'#64748b',callbacks:{label:c=>' $'+c.parsed.y.toLocaleString()}
      }},
      scales:{
        x:{ticks:{color:tickC,font:{size:11},maxRotation:0,autoSkip:true,maxTicksLimit:12},grid:{color:gridC},border:{display:false}},
        y:{ticks:{callback:v=>'$'+(v/1000).toFixed(0)+'k',color:tickC,font:{size:11}},grid:{color:gridC},border:{display:false}}
      }
    }
  });
  const totalA = Math.round(pA + rA * yrs), totalB = Math.round(pB + rB * yrs);
  const aWins = totalA <= totalB;
  animateValue(document.getElementById('sm-a'), Math.round(rA));
  animateValue(document.getElementById('sm-b'), Math.round(rB));
  animateValue(document.getElementById('sm-save'), Math.round(Math.abs(rA - rB)));
  animateValue(document.getElementById('sm-total'), Math.min(totalA, totalB));
  document.getElementById('sm-a-sub').textContent = fdesc('a');
  document.getElementById('sm-b-sub').textContent = fdesc('b');
  document.getElementById('sm-save-sub').textContent = (rA < rB ? nA : nB) + ' saves more/yr';
  document.getElementById('sm-total-label').textContent = 'Best total over ' + yrs + ' yrs';
  document.getElementById('sm-total-sub').textContent = (aWins ? nA : nB) + ' wins';
  const mid = Math.round(yrs / 2);
  const cAm = Math.round(pA + rA * mid), cBm = Math.round(pB + rB * mid), aW = cAm <= cBm;
  const row = (l, a, b, wA, wB) => '<tr><td>' + l + '</td><td class="' + (wA ? 'win-a' : '') + '">' + a + '</td><td class="' + (wB ? 'win-b' : '') + '">' + b + '</td></tr>';
  document.getElementById('cost-table').innerHTML =
    '<tr><th>Item</th><th>' + nA + '</th><th>' + nB + '</th></tr>' +
    row('Purchase price','$'+pA.toLocaleString(),'$'+pB.toLocaleString(),false,false) +
    row('Running cost / yr','$'+Math.round(rA).toLocaleString(),'$'+Math.round(rB).toLocaleString(),rA<rB,rB<rA) +
    row('Running × '+mid+' yrs','$'+Math.round(rA*mid).toLocaleString(),'$'+Math.round(rB*mid).toLocaleString(),false,false) +
    row('Running × '+yrs+' yrs','$'+Math.round(rA*yrs).toLocaleString(),'$'+Math.round(rB*yrs).toLocaleString(),false,false) +
    row('<strong>Total over '+yrs+' yrs</strong>','$'+Math.round(pA+rA*yrs).toLocaleString(),'$'+Math.round(pB+rB*yrs).toLocaleString(),aW,!aW);
  const cA = state.a.co2 || 0, cB = state.b.co2 || 0, maxC = Math.max(cA, cB, 1);
  const annA = Math.round(cA * km / 1000), annB = Math.round(cB * km / 1000);
  document.getElementById('tree-km').textContent = km.toLocaleString();
  document.getElementById('tree-text').innerHTML = treeFact(cA, cB, km);
  document.getElementById('co2-bars').innerHTML =
    '<div class="co2-row"><div class="co2-lbl">'+nA+'</div><div class="co2-track"><div class="co2-fill" style="width:'+(cA/maxC*100).toFixed(1)+'%;background:#3b82f6">'+(cA>0?cA+' g/km':'')+'</div></div><div class="co2-val">'+(cA===0?'Zero 🌱':annA.toLocaleString()+' kg/yr')+'</div></div>'+
    '<div class="co2-row"><div class="co2-lbl">'+nB+'</div><div class="co2-track"><div class="co2-fill" style="width:'+(cB/maxC*100).toFixed(1)+'%;background:#0ecfb0">'+(cB>0?cB+' g/km':'')+'</div></div><div class="co2-val">'+(cB===0?'Zero 🌱':annB.toLocaleString()+' kg/yr')+'</div></div>';
  const r2 = (l, a, b) => '<tr><td>' + l + '</td><td>' + a + '</td><td>' + b + '</td></tr>';
  const cat = l => '<tr class="cat-hd"><td colspan="3">' + l + '</td></tr>';
  const st = (n, max) => n ? (Array.from({length:max},(_,i)=>i<n?'★':'☆').join('') + ' ' + n + '/' + max) : '-';
  const aFuel = document.getElementById('a-fuel').value;
  const bFuel = document.getElementById('b-fuel').value;
  const fuelUseA = aFuel === 'phev' ? (g('a-pl100') > 0 ? g('a-pl100').toFixed(1) + ' L/100km' : '-') : (g('a-l100') > 0 ? g('a-l100').toFixed(1) + ' L/100km' : '-');
  const fuelUseB = bFuel === 'phev' ? (g('b-pl100') > 0 ? g('b-pl100').toFixed(1) + ' L/100km' : '-') : (g('b-l100') > 0 ? g('b-l100').toFixed(1) + ' L/100km' : '-');
  const elecUseA = aFuel === 'phev' ? (g('a-pkwh') > 0 ? g('a-pkwh').toFixed(1) + ' kWh/100km' : '-') : (g('a-kwh') > 0 ? g('a-kwh').toFixed(1) + ' kWh/100km' : '-');
  const elecUseB = bFuel === 'phev' ? (g('b-pkwh') > 0 ? g('b-pkwh').toFixed(1) + ' kWh/100km' : '-') : (g('b-kwh') > 0 ? g('b-kwh').toFixed(1) + ' kWh/100km' : '-');
  document.getElementById('detail-table').innerHTML =
    '<tr><th>Specification</th><th>'+nA+'</th><th>'+nB+'</th></tr>' +
    cat('Vehicle') +
    r2('Make',state.a.make||'-',state.b.make||'-') +
    r2('Model',state.a.model||'-',state.b.model||'-') +
    r2('Year',state.a.year||'-',state.b.year||'-') +
    r2('Body type',state.a.bodyType||'-',state.b.bodyType||'-') +
    r2('Seats',state.a.seats||'-',state.b.seats||'-') +
    r2('Transmission',state.a.trans||'-',state.b.trans||'-') +
    r2('Engine size',state.a.cc?state.a.cc+'cc':'-',state.b.cc?state.b.cc+'cc':'-') +
    cat('Economy & environment') +
    r2('Fuel type',state.a.fuelType,state.b.fuelType) +
    r2('Fuel consumption',fuelUseA,fuelUseB) +
    r2('Electric consumption',elecUseA,elecUseB) +
    r2('CO₂ (tailpipe)',cA===0?'Zero 🌱':cA+' g/km',cB===0?'Zero 🌱':cB+' g/km') +
    r2('Annual CO₂',cA===0?'Zero':annA.toLocaleString()+' kg',cB===0?'Zero':annB.toLocaleString()+' kg') +
    r2('Economy rating',st(state.a.stars,6),st(state.b.stars,6)) +
    cat('Safety & comfort') +
    r2('Safety rating',st(state.a.safety,5),st(state.b.safety,5)) +
    r2('Seats',state.a.seats||'-',state.b.seats||'-') +
    cat('Costs (at '+km.toLocaleString()+' km/yr)') +
    r2('Purchase price','$'+pA.toLocaleString(),'$'+pB.toLocaleString()) +
    r2('Annual running cost','$'+Math.round(rA).toLocaleString(),'$'+Math.round(rB).toLocaleString()) +
    r2('Cost per km','$'+(rA/km*100).toFixed(1)+'/100km','$'+(rB/km*100).toFixed(1)+'/100km') +
    r2('5-year total','$'+Math.round(pA+rA*5).toLocaleString(),'$'+Math.round(pB+rB*5).toLocaleString()) +
    r2(yrs+'-year total','$'+Math.round(pA+rA*yrs).toLocaleString(),'$'+Math.round(pB+rB*yrs).toLocaleString());
  const resultsEl = document.getElementById('results');
  resultsEl.style.display = 'block';
  resultsEl.classList.remove('results-enter');
  void resultsEl.offsetWidth;
  resultsEl.classList.add('results-enter');
  setTimeout(() => resultsEl.scrollIntoView({behavior:'smooth', block:'start'}), 80);
}
function shareResults(){
  const p = new URLSearchParams();
  p.set('km', g('km')); p.set('pp', g('pp')); p.set('dp', g('dp')); p.set('ep', g('ep')); p.set('yrs', g('yrs')); p.set('ruc-d', g('ruc-d')); p.set('ruc-e', g('ruc-e'));
  ['a','b'].forEach(c => {
    p.set(c+'name', state[c].name); p.set(c+'make', state[c].make||''); p.set(c+'model', state[c].model||''); p.set(c+'year', state[c].year||''); p.set(c+'bodyType', state[c].bodyType||'');
    p.set(c+'fuel', document.getElementById(c+'-fuel').value);
    p.set(c+'price', g(c+'-price')); p.set(c+'l100', g(c+'-l100')); p.set(c+'kwh', g(c+'-kwh')); p.set(c+'pl100', g(c+'-pl100')); p.set(c+'pkwh', g(c+'-pkwh')); p.set(c+'ppct', g(c+'-ppct')); p.set(c+'co2', state[c].co2||0);
  });
  p.set('go','1');
  const url = location.origin + location.pathname + '?' + p.toString();
  navigator.clipboard.writeText(url).then(() => {
    const t = document.getElementById('share-toast'); t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
  });
}

window.toggleTheme = toggleTheme;
window.updateKm = updateKm;
window.setMode = setMode;
window.filterList = filterList;
window.openList = openList;
window.closeList = closeList;
window.selectVehicle = selectVehicle;
window.lookupPlate = lookupPlate;
window.applyManual = applyManual;
window.swapCars = swapCars;
window.uf = uf;
window.setTab = setTab;
window.compare = compare;
window.shareResults = shareResults;

uf('a');
uf('b');
init();
<\/script>
</body>
</html>`;
