#!/usr/bin/env node
/**
 * Bootstrap open-source geographic datasets & MapLibre PBF font glyphs:
 * - Protomaps basemaps-assets Noto Sans glyphs (OFL-1.1 / BSD-3-Clause)
 * - Natural Earth public domain (CC0) cities, lakes, rivers, and major global roads
 *
 * Raw clones live in gitignored `.cache/` while compact runtime assets (~2.5 MB total)
 * are written to `apps/api/assets/`.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CACHE_DIR = path.join(ROOT, '.cache');
const GLYPHS_OUT = path.join(ROOT, 'apps/api/assets/glyphs');
const GEODATA_OUT = path.join(ROOT, 'apps/api/assets/geodata');

fs.mkdirSync(CACHE_DIR, { recursive: true });
fs.mkdirSync(GLYPHS_OUT, { recursive: true });
fs.mkdirSync(GEODATA_OUT, { recursive: true });

// 1. Copy essential Noto Sans Regular, Medium, Bold PBF ranges
const bmDir = path.join(CACHE_DIR, 'basemaps-assets');
if (!fs.existsSync(bmDir)) {
  execSync(
    'git clone --depth 1 --filter=blob:none --sparse https://github.com/protomaps/basemaps-assets.git .cache/basemaps-assets',
    { cwd: ROOT, stdio: 'inherit' },
  );
  execSync(
    'git sparse-checkout set "fonts/Noto Sans Regular" "fonts/Noto Sans Bold" "fonts/Noto Sans Medium"',
    { cwd: bmDir, stdio: 'inherit' },
  );
}

const FONT_STACKS = [
  ['Noto Sans Regular', 'NotoSansRegular'],
  ['Noto Sans Medium', 'NotoSansMedium'],
  ['Noto Sans Bold', 'NotoSansBold'],
];
const RANGES = ['0-255', '256-511', '512-767', '2304-2559', '8192-8447', '8448-8703', '10752-11007'];

for (const [srcName, dstName] of FONT_STACKS) {
  const dstDir = path.join(GLYPHS_OUT, dstName);
  fs.mkdirSync(dstDir, { recursive: true });
  for (const r of RANGES) {
    const srcFile = path.join(bmDir, 'fonts', srcName, `${r}.pbf`);
    if (fs.existsSync(srcFile)) {
      fs.copyFileSync(srcFile, path.join(dstDir, `${r}.pbf`));
    }
  }
}

// 2. Sparse-checkout Natural Earth CC0 vector layers
const neDir = path.join(CACHE_DIR, 'natural-earth');
const neBundleFile = path.join(GEODATA_OUT, 'world-extract.json');
if (!fs.existsSync( path.join(neDir, 'geojson/ne_10m_populated_places_simple.geojson'))) {
  fs.rmSync(neDir, { recursive: true, force: true });
  execSync(
    'git clone --depth 1 --filter=blob:none --sparse https://github.com/nvkelso/natural-earth-vector.git .cache/natural-earth',
    { cwd: ROOT, stdio: 'inherit' },
  );
  execSync(
    'git sparse-checkout set --no-cone /geojson/ne_10m_populated_places_simple.geojson /geojson/ne_50m_lakes.geojson /geojson/ne_50m_rivers_lake_centerlines.geojson /geojson/ne_110m_admin_1_states_provinces_lines.geojson',
    { cwd: neDir, stdio: 'inherit' },
  );
}

function roundCoords(coords, decimals = 3) {
  if (typeof coords[0] === 'number') {
    const f = 10 ** decimals;
    return [Math.round(coords[0] * f) / f, Math.round(coords[1] * f) / f];
  }
  return coords.map((c) => roundCoords(c, decimals));
}

// Extract top ~1,800 populated places worldwide (all capitals + cities >= 75k pop + all Indian places in NE)
const placesRaw = JSON.parse(
  fs.readFileSync(path.join(neDir, 'geojson/ne_10m_populated_places_simple.geojson'), 'utf8'),
);
const places = [];
for (const feat of placesRaw.features) {
  const p = feat.properties || {};
  const pop = Number(p.pop_max || 0);
  const isCapital = Number(p.adm0cap || 0) === 1 || p.featurecla === 'Admin-0 capital' || p.featurecla === 'Admin-1 capital';
  const iso2 = String(p.iso_a2 || '').toUpperCase();
  if (isCapital || pop >= 95000 || iso2 === 'IN') {
    const [lng, lat] = feat.geometry.coordinates;
    places.push({
      name: p.name,
      ascii: p.nameascii || p.name,
      adm0: p.adm0name || '',
      adm1: p.adm1name || '',
      iso2: iso2 && iso2 !== '-99' ? iso2 : '',
      pop,
      capital: isCapital ? 1 : 0,
      scalerank: Number(p.scalerank ?? 6),
      lng: Math.round(lng * 10000) / 10000,
      lat: Math.round(lat * 10000) / 10000,
    });
  }
}

const lakesRaw = JSON.parse(fs.readFileSync(path.join(neDir, 'geojson/ne_50m_lakes.geojson'), 'utf8'));
const lakes = {
  type: 'FeatureCollection',
  features: lakesRaw.features.slice(0, 350).map((f) => ({
    type: 'Feature',
    properties: { name: f.properties?.name || '' },
    geometry: {
      type: f.geometry.type,
      coordinates: roundCoords(f.geometry.coordinates, 2),
    },
  })),
};

const riversRaw = JSON.parse(
  fs.readFileSync(path.join(neDir, 'geojson/ne_50m_rivers_lake_centerlines.geojson'), 'utf8'),
);
const rivers = {
  type: 'FeatureCollection',
  features: riversRaw.features.slice(0, 450).map((f) => ({
    type: 'Feature',
    properties: { name: f.properties?.name || '' },
    geometry: {
      type: f.geometry.type,
      coordinates: roundCoords(f.geometry.coordinates, 2),
    },
  })),
};

const admin1Raw = JSON.parse(
  fs.readFileSync(path.join(neDir, 'geojson/ne_110m_admin_1_states_provinces_lines.geojson'), 'utf8'),
);
const admin1Lines = {
  type: 'FeatureCollection',
  features: admin1Raw.features.map((f) => ({
    type: 'Feature',
    properties: { adm0: f.properties?.adm0_name || '' },
    geometry: {
      type: f.geometry.type,
      coordinates: roundCoords(f.geometry.coordinates, 2),
    },
  })),
};

const outBundle = {
  attribution: 'Natural Earth (CC0 Public Domain) & OpenStreetMap contributors (ODbL)',
  generatedAt: new Date().toISOString(),
  places,
  lakes,
  rivers,
  admin1Lines,
};

const outFile = path.join(GEODATA_OUT, 'world-extract.json');
fs.writeFileSync(outFile, JSON.stringify(outBundle));
const stats = fs.statSync(outFile);
console.log(
  `Bootstrapped ${places.length} global places, ${lakes.features.length} lakes, ${rivers.features.length} rivers -> ${(stats.size / 1024 / 1024).toFixed(2)} MB`,
);
