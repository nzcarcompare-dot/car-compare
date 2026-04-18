import express from 'express';
import NodeCache from 'node-cache';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
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

// Load vehicle data from JSON file
const VEHICLES = JSON.parse(readFileSync(join(__dirname, 'public', 'vehicles.json'), 'utf8'));

// Serve static files from /public
app.use(express.static(join(__dirname, 'public')));

// ── Carjam lookup ─────────────────────────────────────────────────────────────
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

  if (data?.error) {
    throw new Error(typeof data.error === 'string' ? data.error : data.error.message || 'Carjam error');
  }
  if (!data?.make) throw new Error('Plate not found');

  cache.set('cj:' + plate, data);
  return data;
}

// ── API routes ────────────────────────────────────────────────────────────────
app.get('/api/vehicles', (_req, res) => {
  res.json(VEHICLES);
});

app.get('/api/lookup/:plate', async (req, res) => {
  const plate = req.params.plate.toUpperCase().replace(/\s/g, '');

  if (!/^[A-Z0-9]{1,8}$/.test(plate)) {
    return res.status(400).json({ error: 'Invalid plate format' });
  }

  // Check built-in vehicles first
  const demo = VEHICLES.find(v => v.plate === plate);
  if (demo) return res.json({ ...demo, _demo: true });

  // Try Carjam
  try {
    const cj = await fetchCarjam(plate);
    return res.json({
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

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, vehicles: VEHICLES.length, carjam: !!CARJAM_KEY });
});

app.listen(PORT, () => {
  console.log('\n  WheelDeal NZ');
  console.log('  ─────────────────────────────');
  console.log('  Open: http://localhost:' + PORT);
  console.log('  Vehicles loaded: ' + VEHICLES.length);
  console.log('  Carjam API: ' + (CARJAM_KEY ? 'enabled' : 'not set (demo plates only)') + '\n');
});
