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

// Carjam lookup (test env)
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
      plate: cj.plate, name: [cj.year_of_manufacture, cj.make, cj.model].filter(Boolean).join(' '),
      make: cj.make, model: cj.model, year: cj.year_of_manufacture,
      fuelType: FUEL_TYPE_MAP[String(cj.fuel_type)] || 'petrol',
      colour: cj.main_colour, trans: cj.transmission, cc: cj.cc_rating,
      odometer: cj.latest_odometer_reading, wof: cj.result_of_latest_wof_inspection,
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
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>NZ Car Comparator</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"><\/script>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --blue:#2563eb;--blue-d:#1d4ed8;--blue-l:#dbeafe;--blue-xl:#eff6ff;
  --green:#059669;--green-d:#047857;--green-l:#d1fae5;
  --gray-50:#f9fafb;--gray-100:#f3f4f6;--gray-200:#e5e7eb;--gray-300:#d1d5db;
  --gray-400:#9ca3af;--gray-500:#6b7280;--gray-600:#4b5563;
  --gray-700:#374151;--gray-800:#1f2937;--gray-900:#111827;
  --radius:12px;--radius-sm:8px;--radius-xs:6px;
  --shadow:0 1px 3px rgba(0,0,0,.08),0 1px 2px rgba(0,0,0,.06);
  --shadow-md:0 4px 6px -1px rgba(0,0,0,.07),0 2px 4px -1px rgba(0,0,0,.05);
}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--gray-50);color:var(--gray-800);min-height:100vh}

/* ── Header ── */
header{background:var(--gray-900);padding:0 24px;display:flex;align-items:center;justify-content:space-between;height:60px;position:sticky;top:0;z-index:100;box-shadow:0 2px 8px rgba(0,0,0,.3)}
.logo{display:flex;align-items:center;gap:10px}
.logo-icon{width:32px;height:32px;background:linear-gradient(135deg,var(--blue),var(--green));border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px}
.logo h1{font-size:16px;font-weight:700;color:#fff;letter-spacing:-.02em}
.logo p{font-size:11px;color:var(--gray-400);margin-top:1px}
.header-badge{font-size:10px;font-weight:600;background:rgba(37,99,235,.2);color:#93c5fd;padding:3px 8px;border-radius:20px;border:1px solid rgba(147,197,253,.2)}

/* ── Layout ── */
main{max-width:1040px;margin:0 auto;padding:28px 16px 80px}

/* ── km slider hero ── */
.km-hero{background:white;border:1px solid var(--gray-200);border-radius:var(--radius);padding:20px 24px;margin-bottom:24px;box-shadow:var(--shadow)}
.km-hero-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px}
.km-hero-label{font-size:13px;font-weight:600;color:var(--gray-700)}
.km-hero-label span{font-size:22px;font-weight:800;color:var(--blue);margin-left:8px}
.km-hero-sub{font-size:12px;color:var(--gray-400)}
input[type=range]{width:100%;height:6px;border-radius:3px;accent-color:var(--blue);cursor:pointer}

/* ── Car cards ── */
.cars-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}
.car-card{background:white;border:1px solid var(--gray-200);border-radius:var(--radius);box-shadow:var(--shadow);overflow:hidden;transition:box-shadow .2s}
.car-card-top{border-top:3px solid;padding:16px 16px 0}
.car-a .car-card-top{border-color:var(--blue)}
.car-b .car-card-top{border-color:var(--green)}
.car-pill{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:12px}
.car-a .car-pill{color:var(--blue-d)}
.car-b .car-pill{color:var(--green-d)}

/* Search mode toggle */
.mode-toggle{display:flex;background:var(--gray-100);border-radius:var(--radius-xs);padding:3px;margin-bottom:12px;gap:2px}
.mode-btn{flex:1;padding:6px 10px;border:none;background:transparent;border-radius:5px;font-size:12px;font-weight:600;color:var(--gray-500);cursor:pointer;transition:all .15s}
.mode-btn.active{background:white;color:var(--gray-800);box-shadow:0 1px 3px rgba(0,0,0,.1)}

/* Search inputs */
.search-panel{display:none}.search-panel.active{display:block}
.plate-row{display:flex;gap:8px;margin-bottom:4px}
.plate-input{flex:1;border:1.5px solid var(--gray-200);border-radius:var(--radius-xs);padding:9px 12px;font-size:15px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;outline:none;transition:border-color .15s}
.plate-input:focus{border-color:var(--blue)}
.car-b .plate-input:focus{border-color:var(--green)}
.lookup-btn{padding:0 14px;height:40px;border-radius:var(--radius-xs);border:none;font-size:13px;font-weight:600;cursor:pointer;transition:background .15s;white-space:nowrap}
.car-a .lookup-btn{background:var(--blue-l);color:var(--blue-d)}
.car-a .lookup-btn:hover{background:#bfdbfe}
.car-b .lookup-btn{background:var(--green-l);color:var(--green-d)}
.car-b .lookup-btn:hover{background:#a7f3d0}
.lookup-btn:disabled{opacity:.5;cursor:wait}

/* Manual search */
.manual-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:4px}
.manual-grid .field:last-child{grid-column:1/-1}

/* Dropdown search */
.search-box{position:relative;margin-bottom:4px}
.search-input{width:100%;border:1.5px solid var(--gray-200);border-radius:var(--radius-xs);padding:9px 36px 9px 12px;font-size:14px;outline:none;transition:border-color .15s;background:white url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%239ca3af' viewBox='0 0 16 16'%3E%3Cpath d='M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zm-5.742 1.656a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z'/%3E%3C/svg%3E") no-repeat right 10px center}
.car-a .search-input:focus{border-color:var(--blue)}
.car-b .search-input:focus{border-color:var(--green)}
.dropdown-list{position:absolute;top:calc(100% + 4px);left:0;right:0;background:white;border:1px solid var(--gray-200);border-radius:var(--radius-xs);box-shadow:var(--shadow-md);z-index:50;max-height:220px;overflow-y:auto;display:none}
.dropdown-list.open{display:block}
.dropdown-item{padding:10px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--gray-100);transition:background .1s}
.dropdown-item:last-child{border-bottom:none}
.dropdown-item:hover{background:var(--gray-50)}
.dropdown-item .di-name{font-weight:600;color:var(--gray-800)}
.dropdown-item .di-meta{font-size:11px;color:var(--gray-400);margin-top:1px}
.dropdown-item .di-badge{display:inline-block;font-size:10px;font-weight:600;padding:1px 6px;border-radius:10px;margin-left:4px;vertical-align:middle}

/* Status + banner */
.status-line{font-size:12px;min-height:16px;margin-bottom:6px;padding:0 2px}
.s-ok{color:var(--green)}.s-err{color:#dc2626}.s-load{color:var(--gray-400)}
.vbanner{background:var(--gray-50);border:1px solid var(--gray-200);border-radius:var(--radius-xs);padding:10px 12px;margin-bottom:12px;display:none}
.vbanner.show{display:block}
.vb-name{font-size:14px;font-weight:700;margin-bottom:2px}
.vb-meta{font-size:12px;color:var(--gray-500);line-height:1.6}
.vb-tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}
.tag{font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px}
.tag-fuel-petrol{background:#fef3c7;color:#92400e}
.tag-fuel-diesel{background:#fee2e2;color:#991b1b}
.tag-fuel-ev{background:#d1fae5;color:#065f46}
.tag-fuel-hybrid{background:#e0f2fe;color:#0c4a6e}
.tag-fuel-phev{background:#f3e8ff;color:#6b21a8}
.tag-co2-zero{background:#d1fae5;color:#065f46}
.tag-co2-low{background:#d1fae5;color:#065f46}
.tag-co2-mid{background:#fef3c7;color:#92400e}
.tag-co2-high{background:#fee2e2;color:#991b1b}
.stars-inline{font-size:12px;color:var(--gray-500)}

/* TradeMe button */
.trademe-btn{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--gray-500);background:white;border:1px solid var(--gray-200);border-radius:20px;padding:4px 10px;cursor:pointer;text-decoration:none;transition:all .15s;margin-top:6px}
.trademe-btn:hover{border-color:var(--gray-400);color:var(--gray-700);background:var(--gray-50)}
.trademe-icon{width:14px;height:14px;border-radius:3px;background:#e4002b;display:inline-block;flex-shrink:0}

/* Card fields */
.card-fields{padding:12px 16px 16px;border-top:1px solid var(--gray-100)}
.field{margin-bottom:10px}
.field label{display:block;font-size:11px;font-weight:700;color:var(--gray-400);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}
.field input,.field select{width:100%;border:1.5px solid var(--gray-200);border-radius:var(--radius-xs);padding:7px 10px;font-size:14px;outline:none;background:white;transition:border-color .15s}
.field input:focus,.field select:focus{border-color:var(--blue)}
.fsub{display:none}.fsub.show{display:block}

/* ── Assumptions ── */
.assumptions-card{background:white;border:1px solid var(--gray-200);border-radius:var(--radius);padding:18px 20px;margin-bottom:24px;box-shadow:var(--shadow)}
.agrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px}
.stitle{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--gray-400);margin-bottom:12px}
.compare-row{display:flex;align-items:center;justify-content:space-between;margin-top:14px;gap:10px}
.compare-btn{background:var(--blue);color:white;border:none;border-radius:var(--radius-xs);padding:11px 28px;font-size:14px;font-weight:700;cursor:pointer;transition:background .15s;flex-shrink:0}
.compare-btn:hover{background:var(--blue-d)}
.swap-btn{background:white;border:1px solid var(--gray-200);border-radius:var(--radius-xs);padding:10px 16px;font-size:13px;font-weight:600;color:var(--gray-600);cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:6px}
.swap-btn:hover{border-color:var(--gray-400);color:var(--gray-800)}

/* ── Results ── */
#results{display:none;animation:fadeIn .3s ease}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}

/* Summary metrics */
.summary-bar{background:white;border:1px solid var(--gray-200);border-radius:var(--radius);padding:18px 20px;margin-bottom:20px;box-shadow:var(--shadow)}
.summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--gray-200);border-radius:var(--radius-xs);overflow:hidden}
.smetric{background:white;padding:14px 16px}
.sm-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--gray-400);margin-bottom:5px}
.sm-value{font-size:22px;font-weight:800;letter-spacing:-.02em;color:var(--gray-900)}
.sm-sub{font-size:11px;color:var(--gray-400);margin-top:3px}
.sm-value.win{color:var(--green-d)}

/* Break-even badge */
.be-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px}
.be-badge{font-size:13px;font-weight:700;padding:6px 14px;border-radius:20px}
.be-badge.cross{background:var(--blue-l);color:var(--blue-d)}
.be-badge.nocross{background:var(--gray-100);color:var(--gray-600)}
.share-btn{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--gray-500);background:white;border:1px solid var(--gray-200);border-radius:20px;padding:5px 12px;cursor:pointer;transition:all .15s}
.share-btn:hover{border-color:var(--gray-400);color:var(--gray-700)}
.share-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--gray-900);color:white;padding:10px 20px;border-radius:20px;font-size:13px;font-weight:600;opacity:0;transition:opacity .3s;pointer-events:none;z-index:200}
.share-toast.show{opacity:1}

/* Tabs */
.tabs-card{background:white;border:1px solid var(--gray-200);border-radius:var(--radius);box-shadow:var(--shadow);margin-bottom:20px;overflow:hidden}
.tabs-nav{display:flex;border-bottom:1px solid var(--gray-200);background:var(--gray-50)}
.tab-btn{flex:1;padding:14px 16px;border:none;background:transparent;font-size:13px;font-weight:600;color:var(--gray-500);cursor:pointer;border-bottom:2px solid transparent;transition:all .15s;text-align:center}
.tab-btn.active{color:var(--blue);border-bottom-color:var(--blue);background:white}
.tab-panel{display:none;padding:20px}.tab-panel.active{display:block}

/* Chart */
.legend{display:flex;gap:16px;flex-wrap:wrap}
.leg-item{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--gray-600)}
.leg-sw{width:12px;height:12px;border-radius:3px;flex-shrink:0}

/* CO2 bars */
.co2-bars{display:flex;flex-direction:column;gap:14px;margin-top:4px}
.co2-row{display:flex;align-items:center;gap:12px;font-size:13px}
.co2-lbl{width:180px;flex-shrink:0;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.co2-track{flex:1;background:var(--gray-100);border-radius:4px;height:26px;overflow:hidden}
.co2-fill{height:100%;border-radius:4px;display:flex;align-items:center;padding-left:10px;font-size:11px;font-weight:700;color:white;transition:width .6s ease;min-width:4px}
.co2-val{font-size:12px;color:var(--gray-500);width:80px;text-align:right;flex-shrink:0}

/* Tree card */
.tree-card{background:linear-gradient(135deg,#064e3b,#065f46);border-radius:var(--radius);padding:18px 20px;margin-bottom:20px;color:white;display:flex;align-items:flex-start;gap:14px}
.tree-icon{font-size:38px;line-height:1;flex-shrink:0}
.tree-label{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.6;margin-bottom:5px}
.tree-text{font-size:14px;line-height:1.6}
.tree-num{font-size:28px;font-weight:900;color:#6ee7b7;display:block;margin-bottom:2px}

/* Full comparison table */
.comp-table{width:100%;border-collapse:collapse;font-size:13px}
.comp-table th{text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--gray-400);padding:8px 10px;border-bottom:2px solid var(--gray-200)}
.comp-table td{padding:10px 10px;border-bottom:1px solid var(--gray-100)}
.comp-table tr:last-child td{border-bottom:none}
.comp-table .cat-row td{background:var(--gray-50);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--gray-500);padding:6px 10px}
.comp-table .win-a{color:var(--blue-d);font-weight:700}
.comp-table .win-b{color:var(--green-d);font-weight:700}
.safety-stars{color:#f59e0b;font-size:13px}

/* Responsive */
@media(max-width:640px){
  .cars-grid{grid-template-columns:1fr}
  .summary-grid{grid-template-columns:1fr 1fr}
  .manual-grid{grid-template-columns:1fr}
  .co2-lbl{width:100px}
}
</style>
</head>
<body>
<header>
  <div class="logo">
    <div class="logo-icon">🚗</div>
    <div>
      <h1>NZ Car Comparator</h1>
      <p>Find your best value vehicle</p>
    </div>
  </div>
  <div class="header-badge">NZ Market</div>
</header>

<main>

  <!-- km slider hero -->
  <div class="km-hero">
    <div class="km-hero-top">
      <div class="km-hero-label">How far do you drive each year? <span id="km-display">15,000 km</span></div>
      <div class="km-hero-sub">This is the biggest factor in your cost calculation</div>
    </div>
    <input type="range" id="km" min="5000" max="50000" step="1000" value="15000" oninput="updateKmDisplay()">
  </div>

  <!-- Car cards -->
  <div class="cars-grid">

    <!-- CAR A -->
    <div class="car-card car-a" id="card-a">
      <div class="car-card-top">
        <div class="car-pill">Car A</div>
        <div class="mode-toggle">
          <button class="mode-btn active" onclick="setMode('a','browse')">Browse cars</button>
          <button class="mode-btn" onclick="setMode('a','plate')">Enter plate</button>
          <button class="mode-btn" onclick="setMode('a','manual')">Enter manually</button>
        </div>

        <!-- Browse mode -->
        <div class="search-panel active" id="a-browse">
          <div class="search-box">
            <input class="search-input" id="a-search" placeholder="Search make, model or year…" oninput="filterList('a')" onfocus="openList('a')" onblur="setTimeout(()=>closeList('a'),150)">
            <div class="dropdown-list" id="a-list"></div>
          </div>
        </div>

        <!-- Plate mode -->
        <div class="search-panel" id="a-plate">
          <div class="plate-row">
            <input class="plate-input" id="a-plate-input" placeholder="e.g. ABC123" maxlength="8" oninput="this.value=this.value.toUpperCase()" onkeydown="if(event.key==='Enter')lookupPlate('a')">
            <button class="lookup-btn" id="a-lbtn" onclick="lookupPlate('a')">Look up</button>
          </div>
        </div>

        <!-- Manual mode -->
        <div class="search-panel" id="a-manual">
          <div class="manual-grid">
            <div class="field"><label>Make</label><input type="text" id="a-make" placeholder="e.g. Toyota"></div>
            <div class="field"><label>Model</label><input type="text" id="a-model" placeholder="e.g. Corolla"></div>
            <div class="field"><label>Year</label><input type="number" id="a-year" placeholder="e.g. 2021" min="1990" max="2025"></div>
            <div class="field"><label>Body type</label>
              <select id="a-body"><option>Sedan</option><option>Hatchback</option><option>SUV</option><option>Ute</option><option>Wagon</option><option>Van</option></select>
            </div>
          </div>
          <button class="lookup-btn" style="width:100%;margin-bottom:4px" onclick="applyManual('a')">Use this car</button>
        </div>

        <div class="status-line" id="a-status"></div>
        <div class="vbanner" id="a-banner">
          <div class="vb-name" id="a-vname"></div>
          <div class="vb-meta" id="a-vmeta"></div>
          <div class="vb-tags" id="a-vtags"></div>
          <a class="trademe-btn" id="a-trademe" href="#" target="_blank" rel="noopener">
            <span class="trademe-icon"></span> Search similar on Trade Me
          </a>
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

    <!-- CAR B -->
    <div class="car-card car-b" id="card-b">
      <div class="car-card-top">
        <div class="car-pill">Car B</div>
        <div class="mode-toggle">
          <button class="mode-btn active" onclick="setMode('b','browse')">Browse cars</button>
          <button class="mode-btn" onclick="setMode('b','plate')">Enter plate</button>
          <button class="mode-btn" onclick="setMode('b','manual')">Enter manually</button>
        </div>

        <div class="search-panel active" id="b-browse">
          <div class="search-box">
            <input class="search-input" id="b-search" placeholder="Search make, model or year…" oninput="filterList('b')" onfocus="openList('b')" onblur="setTimeout(()=>closeList('b'),150)">
            <div class="dropdown-list" id="b-list"></div>
          </div>
        </div>

        <div class="search-panel" id="b-plate">
          <div class="plate-row">
            <input class="plate-input" id="b-plate-input" placeholder="e.g. EV2024" maxlength="8" oninput="this.value=this.value.toUpperCase()" onkeydown="if(event.key==='Enter')lookupPlate('b')">
            <button class="lookup-btn" id="b-lbtn" onclick="lookupPlate('b')">Look up</button>
          </div>
        </div>

        <div class="search-panel" id="b-manual">
          <div class="manual-grid">
            <div class="field"><label>Make</label><input type="text" id="b-make" placeholder="e.g. Tesla"></div>
            <div class="field"><label>Model</label><input type="text" id="b-model" placeholder="e.g. Model 3"></div>
            <div class="field"><label>Year</label><input type="number" id="b-year" placeholder="e.g. 2023" min="1990" max="2025"></div>
            <div class="field"><label>Body type</label>
              <select id="b-body"><option>Sedan</option><option>Hatchback</option><option>SUV</option><option>Ute</option><option>Wagon</option><option>Van</option></select>
            </div>
          </div>
          <button class="lookup-btn" style="width:100%;margin-bottom:4px" onclick="applyManual('b')">Use this car</button>
        </div>

        <div class="status-line" id="b-status"></div>
        <div class="vbanner" id="b-banner">
          <div class="vb-name" id="b-vname"></div>
          <div class="vb-meta" id="b-vmeta"></div>
          <div class="vb-tags" id="b-vtags"></div>
          <a class="trademe-btn" id="b-trademe" href="#" target="_blank" rel="noopener">
            <span class="trademe-icon"></span> Search similar on Trade Me
          </a>
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

  <!-- Assumptions + actions -->
  <div class="assumptions-card">
    <div class="stitle">Additional assumptions</div>
    <div class="agrid">
      <div class="field"><label>Petrol ($/L)</label><input type="number" id="pp" value="2.50" step="0.05" min="0"></div>
      <div class="field"><label>Diesel ($/L)</label><input type="number" id="dp" value="1.85" step="0.05" min="0"></div>
      <div class="field"><label>Electricity ($/kWh)</label><input type="number" id="ep" value="0.30" step="0.01" min="0"></div>
      <div class="field"><label>RUC diesel ($/1000km)</label><input type="number" id="ruc-d" value="76" step="1" min="0"></div>
      <div class="field"><label>RUC EV ($/1000km)</label><input type="number" id="ruc-e" value="76" step="1" min="0"></div>
      <div class="field"><label>Years to project</label><input type="number" id="yrs" value="10" step="1" min="1" max="30"></div>
    </div>
    <div class="compare-row">
      <button class="swap-btn" onclick="swapCars()">⇄ Swap cars</button>
      <button class="compare-btn" onclick="compare()">Compare cars →</button>
    </div>
  </div>

  <!-- Results -->
  <div id="results">

    <div class="be-row">
      <div class="be-badge nocross" id="be-badge">—</div>
      <button class="share-btn" onclick="shareResults()">⬆ Share this comparison</button>
    </div>

    <!-- Summary metrics -->
    <div class="summary-bar">
      <div class="stitle" style="margin-bottom:14px">Summary</div>
      <div class="summary-grid" id="summary-grid"></div>
    </div>

    <!-- Tabs -->
    <div class="tabs-card">
      <div class="tabs-nav">
        <button class="tab-btn active" onclick="setTab('overview')">Overview</button>
        <button class="tab-btn" onclick="setTab('costs')">Cost breakdown</button>
        <button class="tab-btn" onclick="setTab('environment')">Environment</button>
        <button class="tab-btn" onclick="setTab('details')">Full comparison</button>
      </div>

      <!-- Overview tab -->
      <div class="tab-panel active" id="tab-overview">
        <div class="legend" style="margin-bottom:16px">
          <div class="leg-item"><div class="leg-sw" style="background:#2563eb"></div><span id="leg-a">Car A</span></div>
          <div class="leg-item"><div class="leg-sw" style="background:#059669"></div><span id="leg-b">Car B</span></div>
        </div>
        <div style="position:relative;height:280px"><canvas id="chart"></canvas></div>
        <p style="font-size:11px;color:var(--gray-400);margin-top:10px;text-align:center">Cumulative total cost of ownership including purchase price and running costs</p>
      </div>

      <!-- Cost breakdown tab -->
      <div class="tab-panel" id="tab-costs">
        <table class="comp-table" id="cost-table"></table>
      </div>

      <!-- Environment tab -->
      <div class="tab-panel" id="tab-environment">
        <div class="tree-card" id="tree-card">
          <div class="tree-icon">🌳</div>
          <div>
            <div class="tree-label">Environmental impact</div>
            <div class="tree-text" id="tree-text"></div>
          </div>
        </div>
        <div class="stitle">Annual CO₂ emissions</div>
        <div class="co2-bars" id="co2-bars"></div>
      </div>

      <!-- Full comparison tab -->
      <div class="tab-panel" id="tab-details">
        <table class="comp-table" id="detail-table"></table>
      </div>
    </div>

  </div>
</main>

<div class="share-toast" id="share-toast">Link copied to clipboard ✓</div>

<script>
let vehicles=[], chartInst=null;
const state={
  a:{name:'Car A',make:'',model:'',year:'',fuelType:'petrol',co2:0,stars:null,safety:null,seats:null,bodyType:'',trans:'',cc:null,notes:''},
  b:{name:'Car B',make:'',model:'',year:'',fuelType:'ev',  co2:0,stars:null,safety:null,seats:null,bodyType:'',trans:'',cc:null,notes:''}
};

// ── Init ──────────────────────────────────────────────────────────────────────
async function init(){
  try{
    const r=await fetch('/api/vehicles');
    vehicles=await r.json();
    renderList('a','');
    renderList('b','');
  }catch(e){console.error('Failed to load vehicles',e)}

  // Restore from URL params
  const p=new URLSearchParams(location.search);
  if(p.get('km')) document.getElementById('km').value=p.get('km');
  if(p.get('pp')) document.getElementById('pp').value=p.get('pp');
  if(p.get('dp')) document.getElementById('dp').value=p.get('dp');
  if(p.get('ep')) document.getElementById('ep').value=p.get('ep');
  if(p.get('yrs')) document.getElementById('yrs').value=p.get('yrs');
  ['a','b'].forEach(c=>{
    if(p.get(c+'fuel')){document.getElementById(c+'-fuel').value=p.get(c+'fuel');uf(c);}
    if(p.get(c+'price')) document.getElementById(c+'-price').value=p.get(c+'price');
    if(p.get(c+'l100')) document.getElementById(c+'-l100').value=p.get(c+'l100');
    if(p.get(c+'kwh'))  document.getElementById(c+'-kwh').value=p.get(c+'kwh');
    if(p.get(c+'name')){
      state[c].name=p.get(c+'name');
      state[c].co2=parseFloat(p.get(c+'co2'))||0;
      state[c].make=p.get(c+'make')||'';
      state[c].model=p.get(c+'model')||'';
      state[c].year=p.get(c+'year')||'';
      state[c].fuelType=p.get(c+'fuel')||'petrol';
      showBanner(c,{name:state[c].name,fuelType:state[c].fuelType,co2:state[c].co2,make:state[c].make,model:state[c].model,year:state[c].year});
    }
  });
  if(p.get('compare')==='1') compare();
  updateKmDisplay();
}

// ── km display ────────────────────────────────────────────────────────────────
function updateKmDisplay(){
  document.getElementById('km-display').textContent=parseInt(document.getElementById('km').value).toLocaleString()+' km';
}

// ── Mode toggle ───────────────────────────────────────────────────────────────
function setMode(car,mode){
  ['browse','plate','manual'].forEach(m=>{
    document.getElementById(car+'-'+m).classList.toggle('active',m===mode);
  });
  const btns=document.querySelectorAll('#card-'+car+' .mode-btn');
  btns.forEach((b,i)=>b.classList.toggle('active',['browse','plate','manual'][i]===mode));
}

// ── Browse / search ───────────────────────────────────────────────────────────
function renderList(car,query){
  const q=query.toLowerCase().trim();
  const filtered=q
    ?vehicles.filter(v=>(v.name+v.make+v.model+v.year+v.fuelType).toLowerCase().includes(q))
    :vehicles;

  const fuelColors={petrol:'tag-fuel-petrol',diesel:'tag-fuel-diesel',ev:'tag-fuel-ev',hybrid:'tag-fuel-hybrid',phev:'tag-fuel-phev'};
  const list=document.getElementById(car+'-list');
  list.innerHTML=filtered.slice(0,12).map(v=>{
    const stars=v.stars?'★'.repeat(Math.round(v.stars)):'';
    return \`<div class="dropdown-item" onmousedown="selectVehicle('\${car}','\${v.plate}')">
      <div class="di-name">\${v.name}<span class="di-badge \${fuelColors[v.fuelType]||''}">\${v.fuelType.toUpperCase()}</span></div>
      <div class="di-meta">\${v.bodyType||''} · \${v.l100?v.l100+' L/100km':v.kwh?v.kwh+' kWh/100km':''} · \${stars} · $\${v.price.toLocaleString()}</div>
    </div>\`;
  }).join('')||'<div class="dropdown-item" style="color:var(--gray-400)">No matches — try "enter manually"</div>';
}

function filterList(car){
  renderList(car,document.getElementById(car+'-search').value);
  openList(car);
}
function openList(car){ document.getElementById(car+'-list').classList.add('open'); }
function closeList(car){ document.getElementById(car+'-list').classList.remove('open'); }

function selectVehicle(car,plate){
  const v=vehicles.find(x=>x.plate===plate);
  if(!v)return;
  Object.assign(state[car],{name:v.name,make:v.make,model:v.model,year:v.year,fuelType:v.fuelType,co2:v.co2||0,stars:v.stars,safety:v.safety,seats:v.seats,bodyType:v.bodyType,trans:v.trans,cc:v.cc,notes:v.notes});
  document.getElementById(car+'-search').value=v.name;
  closeList(car);
  document.getElementById(car+'-price').value=v.price;
  document.getElementById(car+'-fuel').value=v.fuelType;
  uf(car);
  if(v.l100) document.getElementById(car+'-l100').value=v.l100;
  if(v.kwh)  document.getElementById(car+'-kwh').value=v.kwh;
  if(v.l100&&v.fuelType==='phev') document.getElementById(car+'-pl100').value=v.l100;
  if(v.kwh&&v.fuelType==='phev')  document.getElementById(car+'-pkwh').value=v.kwh;
  showBanner(car,v);
  setStatus(car,'');
}

// ── Plate lookup ──────────────────────────────────────────────────────────────
async function lookupPlate(car){
  const plate=document.getElementById(car+'-plate-input').value.trim();
  if(!plate)return;
  const btn=document.getElementById(car+'-lbtn');
  btn.disabled=true; btn.textContent='…';
  setStatus(car,'Looking up '+plate+'…','s-load');
  hideBanner(car);
  try{
    const r=await fetch('/api/lookup/'+encodeURIComponent(plate));
    const v=await r.json();
    if(!r.ok) throw new Error(v.error||'Not found');
    Object.assign(state[car],{
      name:v.name||plate, make:v.make||'', model:v.model||'',
      year:v.year||'', fuelType:v.fuelType||'petrol',
      co2:v.co2||0, stars:v.stars||null, safety:v.safety||null,
      seats:v.seats||null, bodyType:v.bodyType||'', trans:v.trans||v.transmission||'', cc:v.cc||null, notes:v.notes||''
    });
    document.getElementById(car+'-price').value=v.price||'';
    document.getElementById(car+'-fuel').value=v.fuelType||'petrol';
    uf(car);
    if(v.l100) document.getElementById(car+'-l100').value=v.l100;
    if(v.kwh)  document.getElementById(car+'-kwh').value=v.kwh;
    showBanner(car,{...v,...state[car]});
    setStatus(car,'✓ Found'+(v._cached?' (cached)':v._demo?' (demo)':''),'s-ok');
  }catch(e){
    setStatus(car,'✗ '+e.message,'s-err');
  }finally{
    btn.disabled=false; btn.textContent='Look up';
  }
}

// ── Manual entry ──────────────────────────────────────────────────────────────
function applyManual(car){
  const make=document.getElementById(car+'-make').value.trim();
  const model=document.getElementById(car+'-model').value.trim();
  const year=document.getElementById(car+'-year').value.trim();
  const body=document.getElementById(car+'-body').value;
  if(!make&&!model){setStatus(car,'Enter at least a make or model','s-err');return;}
  const name=[year,make,model].filter(Boolean).join(' ');
  Object.assign(state[car],{name,make,model,year,bodyType:body,fuelType:document.getElementById(car+'-fuel').value,co2:0});
  showBanner(car,state[car]);
  setStatus(car,'✓ Set — fill in fuel economy and price below','s-ok');
}

// ── Banner ────────────────────────────────────────────────────────────────────
function showBanner(car,v){
  const fuelLabels={petrol:'Petrol',diesel:'Diesel',ev:'Electric',hybrid:'Hybrid',phev:'PHEV'};
  const fuelClass={petrol:'tag-fuel-petrol',diesel:'tag-fuel-diesel',ev:'tag-fuel-ev',hybrid:'tag-fuel-hybrid',phev:'tag-fuel-phev'};
  const co2=v.co2||0;
  let co2cls=co2===0?'tag-co2-zero':co2<120?'tag-co2-low':co2<180?'tag-co2-mid':'tag-co2-high';
  let co2txt=co2===0?'Zero emissions':co2+' g/km CO₂';

  let stars='';
  if(v.stars){
    stars='<span class="stars-inline">Economy: ';
    for(let i=1;i<=6;i++) stars+='<span style="color:'+(i<=v.stars?'#F59E0B':'#D1D5DB')+'">★</span>';
    stars+=' '+v.stars+'/6</span>';
  }
  let safety='';
  if(v.safety) safety='<span class="stars-inline" style="margin-left:8px">Safety: '+'<span style="color:#F59E0B">★</span>'.repeat(v.safety)+'★'.repeat(Math.max(0,5-v.safety)).replace(/★/g,'<span style="color:#D1D5DB">★</span>')+'</span>';

  const meta=[(v.bodyType&&v.year?v.year+' '+v.bodyType:v.bodyType||v.year||''), v.seats?v.seats+' seats':'', v.cc?v.cc+'cc':'', v.trans||''].filter(Boolean).join(' · ');

  document.getElementById(car+'-vname').textContent=v.name||'Unknown';
  document.getElementById(car+'-vmeta').textContent=meta;
  document.getElementById(car+'-vtags').innerHTML=
    '<span class="tag '+fuelClass[v.fuelType||'petrol']+'">'+(fuelLabels[v.fuelType||'petrol'])+'</span>'+
    '<span class="tag '+co2cls+'">'+co2txt+'</span>'+
    (v.notes?'<span class="tag" style="background:var(--gray-100);color:var(--gray-600)">'+v.notes+'</span>':'')+
    '<br style="width:100%">'+stars+safety;

  // TradeMe link
  const make=(v.make||'').toLowerCase().replace(/\s+/g,'-');
  const model=(v.model||'').toLowerCase().replace(/\s+/g,'-');
  const tmUrl=make&&model
    ?'https://www.trademe.co.nz/a/motors/cars/'+make+'/'+model
    :make?'https://www.trademe.co.nz/a/motors/cars/'+make
    :'https://www.trademe.co.nz/a/motors/cars';
  document.getElementById(car+'-trademe').href=tmUrl;

  document.getElementById(car+'-banner').classList.add('show');
}

function hideBanner(car){ document.getElementById(car+'-banner').classList.remove('show'); }
function setStatus(car,msg,cls=''){
  const el=document.getElementById(car+'-status');
  el.textContent=msg; el.className='status-line '+(cls||'');
}

// ── Swap ──────────────────────────────────────────────────────────────────────
function swapCars(){
  // Swap state
  const tmp={...state.a}; Object.assign(state.a,state.b); Object.assign(state.b,tmp);

  // Swap field values
  const fields=['price','fuel','l100','kwh','pl100','pkwh','ppct'];
  fields.forEach(f=>{
    const a=document.getElementById('a-'+f), b=document.getElementById('b-'+f);
    if(a&&b){const t=a.value; a.value=b.value; b.value=t;}
  });
  ['a','b'].forEach(c=>uf(c));

  // Swap banners
  const bA=document.getElementById('a-banner').classList.contains('show');
  const bB=document.getElementById('b-banner').classList.contains('show');
  if(bA&&state.a) showBanner('a',state.a); else hideBanner('a');
  if(bB&&state.b) showBanner('b',state.b); else hideBanner('b');

  // Swap search inputs
  const sA=document.getElementById('a-search').value;
  const sB=document.getElementById('b-search').value;
  document.getElementById('a-search').value=sB;
  document.getElementById('b-search').value=sA;
}

// ── Fuel UI ───────────────────────────────────────────────────────────────────
function uf(car){
  const f=document.getElementById(car+'-fuel').value;
  document.getElementById(car+'-liq').classList.toggle('show',['petrol','diesel','hybrid'].includes(f));
  document.getElementById(car+'-elec').classList.toggle('show',f==='ev');
  document.getElementById(car+'-phev').classList.toggle('show',f==='phev');
}
uf('a'); uf('b');

// ── Tabs ──────────────────────────────────────────────────────────────────────
function setTab(id){
  document.querySelectorAll('.tab-btn').forEach((b,i)=>{
    b.classList.toggle('active',['overview','costs','environment','details'][i]===id);
  });
  document.querySelectorAll('.tab-panel').forEach(p=>{
    p.classList.toggle('active',p.id==='tab-'+id);
  });
}

// ── Calculations ──────────────────────────────────────────────────────────────
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
  return {petrol:'Petrol',diesel:'Diesel + RUC',ev:'Electricity + RUC',hybrid:'Hybrid (petrol)',phev:'PHEV blend'}[document.getElementById(car+'-fuel').value]||'';
}

function treeFact(cA,cB,km){
  const KG=21;
  const diff=Math.abs(cA-cB)*km/1000;
  const trees=Math.round(diff/KG);
  const lo=cA<=cB?state.a.name:state.b.name;
  const hi=cA<=cB?state.b.name:state.a.name;
  if(Math.max(cA,cB)===0) return '<span class="tree-num">Both zero! 🎉</span>Both vehicles produce zero tailpipe emissions — great choice either way.';
  if(trees===0) return 'These vehicles have similar emissions — less than one tree\\'s worth of CO₂ difference per year.';
  if(Math.min(cA,cB)===0) return '<span class="tree-num">'+trees+' trees/year</span>Choosing the zero-emission vehicle over the '+hi+' saves the equivalent of planting '+trees+' trees every year — '+Math.round(diff).toLocaleString()+' kg of CO₂ avoided annually.';
  return '<span class="tree-num">'+trees+' trees/year</span>Choosing the '+lo+' over the '+hi+' saves the equivalent of planting '+trees+' trees every year — '+Math.round(diff).toLocaleString()+' kg of CO₂ avoided annually.';
}

// ── Compare ───────────────────────────────────────────────────────────────────
function compare(){
  const yrs=Math.max(1,Math.round(g('yrs')));
  const pA=g('a-price'),pB=g('b-price');
  const rA=runCost('a'),rB=runCost('b');
  const km=g('km');
  const nA=state.a.name,nB=state.b.name;

  // Update state fuel types from selects
  state.a.fuelType=document.getElementById('a-fuel').value;
  state.b.fuelType=document.getElementById('b-fuel').value;

  document.getElementById('leg-a').textContent=nA;
  document.getElementById('leg-b').textContent=nB;

  // Break even
  const labels=[],dA=[],dB=[];
  let beYr=null;
  for(let y=0;y<=yrs;y++){
    labels.push('Yr '+y);
    dA.push(Math.round(pA+rA*y));
    dB.push(Math.round(pB+rB*y));
    if(!beYr&&y>0){
      const pv=(pA+rA*(y-1))-(pB+rB*(y-1)), cv=(pA+rA*y)-(pB+rB*y);
      if(pv*cv<0) beYr=(y-1+Math.abs(pv)/Math.abs(rA-rB)).toFixed(1);
    }
  }
  const badge=document.getElementById('be-badge');
  if(beYr){ badge.textContent='Break-even at '+beYr+' years'; badge.className='be-badge cross'; }
  else{ const ch=(pA+rA*yrs)<=(pB+rB*yrs)?nA:nB; badge.textContent=ch+' cheaper over '+yrs+' yrs'; badge.className='be-badge nocross'; }

  // Chart
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
        y:{ticks:{callback:v=>'$'+(v/1000).toFixed(0)+'k',font:{size:11}},grid:{color:'rgba(0,0,0,0.05)'}}
      }
    }
  });

  // Summary metrics
  const totalA=Math.round(pA+rA*yrs), totalB=Math.round(pB+rB*yrs);
  const aWinsTotal=totalA<=totalB;
  document.getElementById('summary-grid').innerHTML=
    '<div class="smetric"><div class="sm-label">'+nA+' annual cost</div><div class="sm-value">$'+Math.round(rA).toLocaleString()+'</div><div class="sm-sub">'+fdesc('a')+'</div></div>'+
    '<div class="smetric"><div class="sm-label">'+nB+' annual cost</div><div class="sm-value">$'+Math.round(rB).toLocaleString()+'</div><div class="sm-sub">'+fdesc('b')+'</div></div>'+
    '<div class="smetric"><div class="sm-label">Annual saving</div><div class="sm-value">$'+Math.round(Math.abs(rA-rB)).toLocaleString()+'</div><div class="sm-sub">'+(rA<rB?nA:nB)+' saves more/yr</div></div>'+
    '<div class="smetric"><div class="sm-label">Total over '+yrs+' yrs</div><div class="sm-value '+(aWinsTotal?'win':'')+'">$'+Math.min(totalA,totalB).toLocaleString()+'</div><div class="sm-sub">'+(aWinsTotal?nA:nB)+' is cheaper overall</div></div>';

  // Cost table
  const mid=Math.round(yrs/2);
  const cAm=Math.round(pA+rA*mid),cBm=Math.round(pB+rB*mid),aW=cAm<=cBm;
  document.getElementById('cost-table').innerHTML=
    '<tr><th>Cost item</th><th>'+nA+'</th><th>'+nB+'</th></tr>'+
    '<tr><td>Purchase price</td><td>$'+pA.toLocaleString()+'</td><td>$'+pB.toLocaleString()+'</td></tr>'+
    '<tr><td>'+fdesc('a')+' per year</td><td>$'+Math.round(rA).toLocaleString()+'</td><td>—</td></tr>'+
    '<tr><td>'+fdesc('b')+' per year</td><td>—</td><td>$'+Math.round(rB).toLocaleString()+'</td></tr>'+
    '<tr><td>Running costs × '+mid+' yrs</td><td>$'+Math.round(rA*mid).toLocaleString()+'</td><td>$'+Math.round(rB*mid).toLocaleString()+'</td></tr>'+
    '<tr><td>Running costs × '+yrs+' yrs</td><td>$'+Math.round(rA*yrs).toLocaleString()+'</td><td>$'+Math.round(rB*yrs).toLocaleString()+'</td></tr>'+
    '<tr><td><strong>Total over '+yrs+' years</strong></td>'+
    '<td class="'+(aW?'win-a':'')+'">$'+Math.round(pA+rA*yrs).toLocaleString()+'</td>'+
    '<td class="'+(!aW?'win-b':'')+'">$'+Math.round(pB+rB*yrs).toLocaleString()+'</td></tr>';

  // CO2 + trees
  const cA=state.a.co2||0, cB=state.b.co2||0, maxC=Math.max(cA,cB,1);
  const annA=Math.round(cA*km/1000), annB=Math.round(cB*km/1000);
  document.getElementById('co2-bars').innerHTML=
    '<div class="co2-row"><div class="co2-lbl">'+nA+'</div><div class="co2-track"><div class="co2-fill" style="width:'+(cA/maxC*100).toFixed(1)+'%;background:#2563eb">'+(cA>0?cA+' g/km':'')+'</div></div><div class="co2-val">'+(cA===0?'Zero 🌱':annA.toLocaleString()+' kg/yr')+'</div></div>'+
    '<div class="co2-row"><div class="co2-lbl">'+nB+'</div><div class="co2-track"><div class="co2-fill" style="width:'+(cB/maxC*100).toFixed(1)+'%;background:#059669">'+(cB>0?cB+' g/km':'')+'</div></div><div class="co2-val">'+(cB===0?'Zero 🌱':annB.toLocaleString()+' kg/yr')+'</div></div>';
  document.getElementById('tree-text').innerHTML=treeFact(cA,cB,km);

  // Full detail table
  const row=(label,a,b)=>'<tr><td>'+label+'</td><td>'+a+'</td><td>'+b+'</td></tr>';
  const cat=(label)=>'<tr class="cat-row"><td colspan="3">'+label+'</td></tr>';
  const stars=(n,max)=>n?('★'.repeat(Math.round(n))+'☆'.repeat(max-Math.round(n))):'-';
  document.getElementById('detail-table').innerHTML=
    '<tr><th>Specification</th><th>'+nA+'</th><th>'+nB+'</th></tr>'+
    cat('Vehicle')+
    row('Make',state.a.make||'-',state.b.make||'-')+
    row('Model',state.a.model||'-',state.b.model||'-')+
    row('Year',state.a.year||'-',state.b.year||'-')+
    row('Body type',state.a.bodyType||'-',state.b.bodyType||'-')+
    row('Seats',state.a.seats||'-',state.b.seats||'-')+
    row('Transmission',state.a.trans||'-',state.b.trans||'-')+
    row('Engine',state.a.cc?(state.a.cc+'cc'):'-',state.b.cc?(state.b.cc+'cc'):'-')+
    cat('Economy & environment')+
    row('Fuel type',document.getElementById('a-fuel').value,document.getElementById('b-fuel').value)+
    row('Fuel consumption',g('a-l100')>0?g('a-l100').toFixed(1)+' L/100km':'-',g('b-l100')>0?g('b-l100').toFixed(1)+' L/100km':'-')+
    row('Electric consumption',g('a-kwh')>0?g('a-kwh').toFixed(1)+' kWh/100km':'-',g('b-kwh')>0?g('b-kwh').toFixed(1)+' kWh/100km':'-')+
    row('CO₂ emissions',cA===0?'0 g/km 🌱':cA+' g/km',cB===0?'0 g/km 🌱':cB+' g/km')+
    row('Annual CO₂',cA===0?'Zero':annA.toLocaleString()+' kg',cB===0?'Zero':annB.toLocaleString()+' kg')+
    row('Economy rating',state.a.stars?stars(state.a.stars,6)+' /6':'-',state.b.stars?stars(state.b.stars,6)+' /6':'-')+
    cat('Safety')+
    row('Safety rating',state.a.safety?stars(state.a.safety,5)+' /5':'-',state.b.safety?stars(state.b.safety,5)+' /5':'-')+
    cat('Costs')+
    row('Purchase price','$'+pA.toLocaleString(),'$'+pB.toLocaleString())+
    row('Annual running','$'+Math.round(rA).toLocaleString(),'$'+Math.round(rB).toLocaleString())+
    row('Cost per km','$'+(rA/km*100).toFixed(1)+'/100km','$'+(rB/km*100).toFixed(1)+'/100km')+
    row('5-year total','$'+Math.round(pA+rA*5).toLocaleString(),'$'+Math.round(pB+rB*5).toLocaleString())+
    row(yrs+'-year total','$'+Math.round(pA+rA*yrs).toLocaleString(),'$'+Math.round(pB+rB*yrs).toLocaleString());

  document.getElementById('results').style.display='block';
  setTimeout(()=>document.getElementById('results').scrollIntoView({behavior:'smooth',block:'start'}),50);
}

// ── Share ─────────────────────────────────────────────────────────────────────
function shareResults(){
  const p=new URLSearchParams();
  p.set('km',g('km')); p.set('pp',g('pp')); p.set('dp',g('dp')); p.set('ep',g('ep')); p.set('yrs',g('yrs'));
  ['a','b'].forEach(c=>{
    p.set(c+'name',state[c].name); p.set(c+'make',state[c].make||''); p.set(c+'model',state[c].model||''); p.set(c+'year',state[c].year||'');
    p.set(c+'fuel',document.getElementById(c+'-fuel').value);
    p.set(c+'price',g(c+'-price')); p.set(c+'l100',g(c+'-l100')); p.set(c+'kwh',g(c+'-kwh')); p.set(c+'co2',state[c].co2||0);
  });
  p.set('compare','1');
  const url=location.origin+location.pathname+'?'+p.toString();
  navigator.clipboard.writeText(url).then(()=>{
    const t=document.getElementById('share-toast');
    t.classList.add('show');
    setTimeout(()=>t.classList.remove('show'),2500);
  });
}

init();
<\/script>
</body>
</html>`;
