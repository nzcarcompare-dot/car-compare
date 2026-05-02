import express from 'express';
import NodeCache from 'node-cache';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const cache = new NodeCache({ stdTTL: 3600 });

const CARJAM_KEY   = process.env.CARJAM_API_KEY || '';
const PORT         = process.env.PORT || 3001;

// Production Carjam API — no Basic Auth needed (that was test environment only)
const CARJAM_BASE  = 'https://www.carjam.co.nz';

const FUEL_TYPE_MAP = {
  '01': 'petrol', '02': 'diesel', '06': 'hybrid',
  '12': 'ev',     '14': 'phev',   '15': 'hybrid',
};

// Carjam returns stars out of 10 — convert to out of 6 for our display
function starsOutOf6(carjamStars) {
  if (!carjamStars) return null;
  return Math.round((carjamStars / 10) * 6 * 2) / 2; // rounded to nearest 0.5
}

// Carjam body_style codes → readable names
const BODY_STYLE_MAP = {
  'SW': 'Station Wagon', 'SD': 'Sedan', 'HB': 'Hatchback',
  'CP': 'Coupe',         'UV': 'SUV',   'PU': 'Ute',
  'VN': 'Van',           'BU': 'Bus',   'TR': 'Truck',
  'RV': 'Recreational',  'MC': 'Motorcycle',
};

// Fleet index — hierarchical make->model->year->variants
// Loaded into memory for fast cascade API responses
const FLEET_IDX  = JSON.parse(readFileSync(join(__dirname, 'public', 'fleet-idx.json'),   'utf8'));
const FLEET_MAKES= JSON.parse(readFileSync(join(__dirname, 'public', 'fleet-makes.json'), 'utf8'));

// Price lookup from vehicles-db for price estimates
const VDB        = JSON.parse(readFileSync(join(__dirname, 'public', 'vehicles-db.json'), 'utf8'));
const PRICE_IDX  = {};
for (const v of VDB) {
  const key = v.make.toLowerCase() + '|' + v.model.toLowerCase();
  if (!PRICE_IDX[key]) PRICE_IDX[key] = [];
  PRICE_IDX[key].push({ yearFrom: v.yearFrom, yearTo: v.yearTo, price: v.price });
}

app.use(express.static(join(__dirname, 'public')));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const rateLimitMap = new Map();
const RATE_LIMIT   = 10;
const RATE_WINDOW  = 60 * 60 * 1000;

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

setInterval(() => {
  const cutoff = Date.now() - RATE_WINDOW;
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (entry.windowStart < cutoff) rateLimitMap.delete(ip);
  }
}, RATE_WINDOW);

// ── Market price lookup ───────────────────────────────────────────────────────
function lookupPrice(make, model, year) {
  if (!make || !model || !year) return null;
  const makeKey  = make.toLowerCase().trim();
  const modelKey = model.toLowerCase().trim();
  const yearNum  = parseInt(year);

  // Try exact match first, then partial
  let entries = PRICE_IDX[makeKey + '|' + modelKey];
  if (!entries) {
    const key = Object.keys(PRICE_IDX).find(k => {
      const [m, mo] = k.split('|');
      return m === makeKey && (modelKey.includes(mo) || mo.includes(modelKey));
    });
    entries = key ? PRICE_IDX[key] : null;
  }
  if (!entries) return null;

  const match = entries.find(e => yearNum >= e.yearFrom && yearNum <= e.yearTo);
  return match ? match.price : null;
}

// ── Odometer-adjusted price ───────────────────────────────────────────────────
// Base prices from Trade Me averages run ~8% above typical sale prices.
// We discount the base, then apply downward-only km adjustment.
// Low-km cars: no premium (base price is already optimistic).
// High-km cars: $0.10/km over expected, capped at -35%.
function adjustPriceForOdometer(basePrice, year, odometerStr) {
  if (!basePrice || !year || !odometerStr) return basePrice;
  const actualKm = parseInt(odometerStr);
  if (isNaN(actualKm) || actualKm <= 0) return basePrice;

  // Step 1: discount base price to reflect sale vs asking price gap
  const salePrice = Math.round(basePrice * 0.92);

  // Step 2: downward-only km adjustment
  const currentYear  = new Date().getFullYear();
  const vehicleAge   = Math.max(1, currentYear - parseInt(year));
  const expectedKm   = vehicleAge * 14000;
  const excessKm     = Math.max(0, actualKm - expectedKm); // only penalise over-mileage
  const ratePerKm    = 0.10;                               // $0.10 per excess km
  const maxDiscount  = Math.round(salePrice * 0.35);       // cap at 35% off
  const kmDiscount   = Math.min(maxDiscount, Math.round(excessKm * ratePerKm));
  const adjusted     = salePrice - kmDiscount;

  // Round to nearest $500 for realism
  return Math.max(500, Math.round(adjusted / 500) * 500);
}

// ── Carjam lookup ─────────────────────────────────────────────────────────────
async function fetchCarjam(plate) {
  const hit = cache.get('cj:' + plate);
  if (hit) return { ...hit, _cached: true };
  if (!CARJAM_KEY) throw new Error('No Carjam API key set');

  const url = `${CARJAM_BASE}/a/vehicle:abcd?key=${encodeURIComponent(CARJAM_KEY)}&plate=${encodeURIComponent(plate)}`;

  // Production API — no Basic Auth (only needed for test environment)
  const res  = await fetch(url);
  const text = await res.text();
  console.log('[carjam raw]', plate, text.slice(0, 300));

  if (!res.ok) throw new Error('Carjam HTTP ' + res.status);

  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Bad response from Carjam'); }

  // Carjam error responses use { code: -1, message: "..." }
  if (data.code && data.code < 0) throw new Error(data.message || 'Carjam error');
  if (!data.make) throw new Error('Plate not found');

  cache.set('cj:' + plate, data);
  return data;
}

// ── Map Carjam response to our vehicle format ─────────────────────────────────
function mapCarjamResponse(cj, price) {
  const se = cj.safety_economy || {};

  // Fuel consumption — prefer Carjam's real data over our lookup table
  const l100 = se.fuel_consumption && se.fuel_consumption > 0 ? se.fuel_consumption : null;
  const kwh  = se.electric_consumption && se.electric_consumption > 0 ? se.electric_consumption : null;

  // CO2
  const co2  = se.co2 && se.co2 > 0 ? se.co2 : 0;

  // Safety — Carjam gives driver_safety_stars out of 10, ANCAP is out of 5
  // driver_safety_stars 10 = 5 star ANCAP
  const safety = se.driver_safety_stars
    ? Math.round(se.driver_safety_stars / 2)  // convert 0-10 → 0-5
    : null;

  // Economy stars — Carjam out of 10, we show out of 6
  const stars = starsOutOf6(se.fuel_stars);

  const bodyType = BODY_STYLE_MAP[cj.body_style] || cj.body_style || '';
  const fuelType = FUEL_TYPE_MAP[String(cj.fuel_type)] || 'petrol';

  return {
    plate:        cj.plate,
    name:         [cj.year_of_manufacture, cj.make, cj.model].filter(Boolean).join(' '),
    make:         cj.make,
    model:        cj.model,
    submodel:     cj.submodel,
    year:         cj.year_of_manufacture,
    fuelType,
    colour:       cj.main_colour,
    trans:        cj.transmission,
    cc:           cj.cc_rating,
    power:        cj.power ? cj.power + 'kW' : null,
    seats:        cj.no_of_seats ? parseInt(cj.no_of_seats) : null,
    bodyType,
    odometer:     cj.latest_odometer_reading,
    wof:          cj.result_of_latest_wof_inspection,
    owners:       cj.number_of_owners || null,
    origin:       cj.country_of_origin || null,
    // Economy & environment from safety_economy
    l100:         l100,
    kwh:          kwh,
    co2:          co2,
    stars:        stars,
    co2Stars:     starsOutOf6(se.co2_stars),
    safety:       safety,
    safetyTest:   se.driver_safety_test || null,
    electricRange:se.electric_range && se.electric_range > 0 ? se.electric_range : null,
    yearlyCo2:    se.yearly_co2 || null,
    // Market price — adjusted for actual odometer reading
    price:        price || null,
    adjustedPrice:price ? adjustPriceForOdometer(price, cj.year_of_manufacture, cj.latest_odometer_reading) : null,
    _priceSource: price ? 'Trade Me average (odometer adjusted)' : null,
  };
}

// ── API routes ────────────────────────────────────────────────────────────────
// Fleet cascade API endpoints
// Step 1: all makes + their models (lightweight, 26KB)
app.get('/api/fleet/makes', (_req, res) => res.json(FLEET_MAKES));

// Step 2: years available for a make+model
app.get('/api/fleet/years', (req, res) => {
  const { make, model } = req.query;
  if (!make || !model) return res.status(400).json({ error: 'make and model required' });
  const modelData = FLEET_IDX[make]?.[model];
  if (!modelData) return res.json([]);
  const years = Object.keys(modelData).map(Number).sort((a,b) => b - a);
  res.json(years);
});

// Step 3: variants for a make+model+year (fuel, body, transmission options + full data)
app.get('/api/fleet/variants', (req, res) => {
  const { make, model, year } = req.query;
  if (!make || !model || !year) return res.status(400).json({ error: 'make, model, year required' });
  const variants = FLEET_IDX[make]?.[model]?.[year] || [];
  res.json(variants);
});

// Legacy: keep /api/vehicles working for any code still using it
app.get('/api/vehicles', (_req, res) => res.json(VDB));

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

  // No demo plates in new unified DB — all real lookups go to Carjam
  const demo = null;
  if (demo) return res.json({ ...demo, _demo: true });

  // Rate limit real lookups by IP
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    console.log('[rate-limit] blocked', ip, plate);
    return res.status(429).json({
      error: `You've looked up ${RATE_LIMIT} plates this hour. Please try again later.`
    });
  }

  try {
    const cj    = await fetchCarjam(plate);
    const price = lookupPrice(cj.make, cj.model, cj.year_of_manufacture);
    return res.json(mapCarjamResponse(cj, price));
  } catch (err) {
    console.error('[lookup]', plate, err.message);
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, fleetMakes: Object.keys(FLEET_IDX).length, fleetRecords: Object.values(FLEET_IDX).reduce((n,m) => n + Object.values(m).reduce((a,y) => a + Object.values(y).reduce((b,v) => b+v.length,0),0),0), carjam: !!CARJAM_KEY, rateLimitIPs: rateLimitMap.size });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('\n  NZ Car Compare');
  console.log('  ─────────────────────────────');
  console.log('  Open: http://localhost:' + PORT);
  console.log('  Fleet: ' + Object.keys(FLEET_IDX).length + ' makes, ' + Object.keys(FLEET_MAKES).reduce((n,m) => n + FLEET_MAKES[m].length, 0) + ' models');
  console.log('  Carjam: ' + (CARJAM_KEY ? 'production API enabled' : 'not set — set CARJAM_API_KEY'));
  console.log('  Rate limit: ' + RATE_LIMIT + ' lookups/hour per IP\n');
});
