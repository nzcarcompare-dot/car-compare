import express from 'express';
import NodeCache from 'node-cache';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const cache = new NodeCache({ stdTTL: 3600 });

const CARJAM_KEY   = process.env.CARJAM_TEST_KEY || '';
const PORT         = process.env.PORT || 3001;
const CARJAM_BASIC = 'Basic ' + Buffer.from('test:test').toString('base64');

const FUEL_TYPE_MAP = {
  '01': 'petrol', '02': 'diesel', '06': 'hybrid',
  '12': 'ev',     '14': 'phev',   '15': 'hybrid',
};

const VEHICLES = JSON.parse(readFileSync(join(__dirname, 'public', 'vehicles.json'), 'utf8'));
const PRICES   = JSON.parse(readFileSync(join(__dirname, 'public', 'prices.json'),   'utf8'));

app.use(express.static(join(__dirname, 'public')));

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Allows 10 real (non-demo) plate lookups per IP per hour.
// Demo lookups are always free and never counted.
const rateLimitMap = new Map();
const RATE_LIMIT   = 10;
const RATE_WINDOW  = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip) {
  const now   = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_WINDOW) {
    rateLimitMap.set(ip, { windowStart: now, count: 1 });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// Clean stale entries every hour
setInterval(() => {
  const cutoff = Date.now() - RATE_WINDOW;
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (entry.windowStart < cutoff) rateLimitMap.delete(ip);
  }
}, RATE_WINDOW);

// ── Price lookup helper ───────────────────────────────────────────────────────
function lookupPrice(make, model, year) {
  if (!make || !model || !year) return null;
  const makeKey  = make.toLowerCase().trim();
  const modelKey = model.toLowerCase().trim();
  const yearNum  = parseInt(year);
  const makeData = PRICES[makeKey];
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

// ── Carjam lookup ─────────────────────────────────────────────────────────────
async function fetchCarjam(plate) {
  const hit = cache.get('cj:' + plate);
  if (hit) return { ...hit, _cached: true };
  if (!CARJAM_KEY) throw new Error('No CARJAM_TEST_KEY set');
  const url  = `https://test.carjam.co.nz/a/vehicle:abcd?key=${encodeURIComponent(CARJAM_KEY)}&plate=${encodeURIComponent(plate)}`;
  const res  = await fetch(url, { headers: { Authorization: CARJAM_BASIC } });
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

// ── API routes ────────────────────────────────────────────────────────────────
app.get('/api/vehicles', (_req, res) => res.json(VEHICLES));

// Fuel prices — read from fuel-prices.json each request so updates go live instantly
app.get('/api/fuel-prices', (_req, res) => {
  try {
    const fp = JSON.parse(readFileSync(join(__dirname, 'public', 'fuel-prices.json'), 'utf8'));
    res.json(fp);
  } catch {
    res.status(500).json({ error: 'Could not load fuel prices' });
  }
});

app.get('/api/lookup/:plate', async (req, res) => {
  const plate = req.params.plate.toUpperCase().replace(/\s/g, '');
  if (!/^[A-Z0-9]{1,8}$/.test(plate)) return res.status(400).json({ error: 'Invalid plate format' });

  // Demo vehicles — free, unlimited, no Carjam call
  const demo = VEHICLES.find(v => v.plate === plate);
  if (demo) return res.json({ ...demo, _demo: true });

  // Rate limit real Carjam lookups by IP
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    console.log('[rate-limit] blocked', ip, plate);
    return res.status(429).json({
      error: `You've looked up ${RATE_LIMIT} plates this hour. Please try again later.`
    });
  }

  try {
    const cj       = await fetchCarjam(plate);
    const fuelType = FUEL_TYPE_MAP[String(cj.fuel_type)] || 'petrol';
    const make     = cj.make  || '';
    const model    = cj.model || '';
    const year     = cj.year_of_manufacture || '';
    const price    = lookupPrice(make, model, year);
    return res.json({
      plate:        cj.plate,
      name:         [year, make, model].filter(Boolean).join(' '),
      make, model, year, fuelType,
      colour:       cj.main_colour,
      trans:        cj.transmission,
      cc:           cj.cc_rating,
      odometer:     cj.latest_odometer_reading,
      wof:          cj.result_of_latest_wof_inspection,
      price:        price || null,
      _priceSource: price ? 'Trade Me average' : null,
      _cached:      cj._cached || false,
    });
  } catch (err) {
    console.error('[lookup]', plate, err.message);
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, vehicles: VEHICLES.length, carjam: !!CARJAM_KEY, rateLimitIPs: rateLimitMap.size });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('\n  NZ Car Compare');
  console.log('  ─────────────────────────────');
  console.log('  Open: http://localhost:' + PORT);
  console.log('  Vehicles: ' + VEHICLES.length);
  console.log('  Carjam: ' + (CARJAM_KEY ? 'enabled' : 'not set'));
  console.log('  Rate limit: ' + RATE_LIMIT + ' lookups/hour per IP\n');
});
