#!/usr/bin/env node
/**
 * enhance-tilesets.js
 *
 * Uses Replicate flux-2-flex (img2img) to AI-enhance solarpunk tileset images.
 * Each output is resized back to the original dimensions so tile indices in
 * ach2026-map.json remain valid.
 *
 * Usage:
 *   node scripts/enhance-tilesets.js              # process all map tilesets
 *   node scripts/enhance-tilesets.js Nature Party # process named tilesets
 *
 * Originals are backed up to assets/originals/ before being overwritten.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── Load .env from assets/.env ────────────────────────────────────────────────
require('dotenv').config({ path: path.resolve(__dirname, '../assets/.env') });

const REPLICATE_API_KEY = process.env.REPLICATE_API_KEY;
if (!REPLICATE_API_KEY) {
  console.error('ERROR: REPLICATE_API_KEY not found in assets/.env');
  process.exit(1);
}

// ── Tilesets referenced in ach2026-map.json ───────────────────────────────────
// { file, w, h, category } – dimensions must stay EXACT after enhancement
const TILESETS = [
  { file: 'Solarpunk_Nature.png',              w: 1024, h: 1536, category: 'nature'  },
  { file: 'Solarpunk_Nature1.png',             w: 1024, h: 1536, category: 'nature'  },
  { file: 'Solarpunk_City.png',                w: 1024, h: 1536, category: 'city'    },
  { file: 'Highrise_and_Prefab_Punk.png',      w: 1024, h: 1536, category: 'city'    },
  { file: 'Eco_City.png',                      w: 1024, h: 1536, category: 'city'    },
  { file: 'Solarpunk_Geodomes_and_Greenhouses.png', w: 1024, h: 1536, category: 'structures' },
  { file: 'Solarpunk_Urban_Garden1.png',       w: 1024, h: 1536, category: 'nature'  },
  { file: 'Solarpunk_Urban_Garden2.png',       w: 1024, h: 1536, category: 'nature'  },
  { file: 'Eco_Accessories.png',               w: 1536, h: 1024, category: 'accessories' },
  { file: 'Solarpunk_Party.png',               w: 1024, h: 1536, category: 'social'  },
  { file: 'SolarPunk_MarketWagons1.png',       w: 1024, h: 1536, category: 'social'  },
  { file: 'SolarPunk_MarketWagons2.png',       w: 1024, h: 1536, category: 'social'  },
  { file: 'SolarPunk_Bridges_Benches.png',     w: 1024, h: 1536, category: 'structures' },
  { file: 'SolarPunk_Arcade_Small1.png',       w: 1024, h: 1536, category: 'arcade'  },
  { file: 'SolarPunk_Arcade.png',              w: 1024, h: 1536, category: 'arcade'  },
  { file: 'Tropical_Plants.png',               w: 1024, h: 1536, category: 'nature'  },
  { file: 'Plain Tiles.png',                   w: 1024, h: 1536, category: 'ground'  },
  { file: 'Wayfinding.png',                    w: 1024, h: 1536, category: 'wayfinding' },
  { file: 'Stands.png',                        w: 1024, h: 1536, category: 'social'  },
  { file: 'Vegetables and Farm.png',           w: 1024, h: 1536, category: 'nature'  },
  { file: 'SolarPunk_Bridges.png',             w: 1024, h: 1536, category: 'structures' },
];

// ── Per-category enhancement prompts ─────────────────────────────────────────
const PROMPTS = {
  nature: [
    'A solarpunk 2D top-down game tileset sprite sheet. Vibrant lush vegetation: ferns, flowering vines, fruit trees, mossy ground, glowing bioluminescent plants at night. Rich deep greens and warm amber sunlight. Organic, living, joyful. Pixel art aesthetic rendered in high-fidelity painterly style. Exact same tile grid layout as the input image.',
    'Top-down solarpunk nature tileset, bursting with life. Dense canopy, wildflower meadows, crystal-clear streams, pollinator gardens humming with bees and butterflies. Sun-dappled greens and purples. Match the original tile arrangement precisely.',
  ],
  city: [
    'A solarpunk 2D top-down city tileset sprite sheet. Gleaming solar-paneled rooftops, vertical gardens cascading from balconies, rainbow-painted community murals, cobblestone plazas with food forests. Warm terracotta, vibrant mosaic tiles, living walls of ivy. Optimistic sustainable urbanism. Same tile grid as input.',
    'Top-down solarpunk cityscape tileset. Art nouveau curves merged with ecological tech. Rooftop greenhouses, wind turbines shaped like flowers, pedestrian bridges lined with edible plants. Rich warm colour palette with pops of electric teal. Same layout as input.',
  ],
  structures: [
    'Solarpunk geodomes, greenhouses, and bridges top-down tileset sprite sheet. Glass and bamboo domes with interior jungle visible, moss-covered arched bridges, solar pergolas. Crystal blues, verdant greens, warm wood tones. Translucent textures catching light. Same grid as input.',
  ],
  accessories: [
    'Solarpunk eco-accessories and props top-down tileset. Solar lanterns, rain barrels, compost bins, mosaic benches, herb spirals, bicycle racks draped in flowering vines. Cheerful folk-art painted details. Same tile arrangement as input image.',
  ],
  social: [
    'Solarpunk festival market and community gathering tileset top-down view. Colourful canopy stalls selling fresh produce, handcrafted goods, spiced teas. String lights, bunting, hand-painted signs. Joyful crowd energy. Warm golden hour light. Same grid layout as input.',
  ],
  arcade: [
    'Solarpunk community arcade and maker-space top-down tileset. Reclaimed-wood gaming cabinets with glowing hand-painted pixel art screens, communal workshop benches, 3D printers powered by rooftop solar, cozy neon lighting. Retro-futurist punk energy. Same tile grid as input.',
  ],
  ground: [
    'Solarpunk ground and pavement top-down tileset. Permeable mosaic paving with wildflowers growing in gaps, lush grass, living soil with mycelium networks hinted below, mossy stone paths, warm terracotta tiles with decorative inlays. Rich earthy palette. Same grid as input.',
  ],
  wayfinding: [
    'Solarpunk wayfinding and signage top-down tileset. Hand-carved wooden signs, mosaic direction markers, painted murals as landmarks, glowing solar light-post signs, chalkboard community notice boards. Warm organic lettering style. Same grid as input.',
  ],
};

const FALLBACK_PROMPT = 'A solarpunk 2D top-down game tileset sprite sheet, vibrant and alive with living green energy, warm sunlight, sustainable technology, lush plants, and optimistic community spirit. Same tile grid layout and dimensions as the input image.';

// ── Replicate API helpers ─────────────────────────────────────────────────────

async function createPrediction(imageDataUri, prompt, width, height) {
  const body = {
    input: {
      prompt,
      input_images: [imageDataUri],
      aspect_ratio: 'custom',
      width,
      height,
      steps: 30,
      guidance: 4.5,
      output_format: 'png',
      output_quality: 100,
      safety_tolerance: 4,
      prompt_upsampling: false,
    },
  };

  const res = await fetch(process.env.REPLICATE_MODEL_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REPLICATE_API_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'wait',          // ask for synchronous response (up to 60 s)
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Replicate POST failed ${res.status}: ${text}`);
  }

  return res.json();
}

async function pollPrediction(predictionUrl) {
  const maxAttempts = 120; // 10 minutes at 5-second intervals
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(predictionUrl, {
      headers: { Authorization: `Bearer ${REPLICATE_API_KEY}` },
    });
    if (!res.ok) throw new Error(`Poll failed ${res.status}`);
    const pred = await res.json();
    if (pred.status === 'succeeded') return pred;
    if (pred.status === 'failed' || pred.status === 'canceled') {
      throw new Error(`Prediction ${pred.status}: ${pred.error}`);
    }
    process.stdout.write('.');
    await new Promise(r => setTimeout(r, 5000));
  }
  throw new Error('Prediction timed out after 10 minutes');
}

async function downloadBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status} ${url}`);
  const arr = await res.arrayBuffer();
  return Buffer.from(arr);
}

// ── Jimp resize (pure JS, works on Node 18) ──────────────────────────────────

async function resizeToExact(inputBuffer, targetW, targetH) {
  const { Jimp, ResizeStrategy } = require('jimp');
  const img = await Jimp.fromBuffer(inputBuffer);
  if (img.bitmap.width === targetW && img.bitmap.height === targetH) {
    return Buffer.from(await img.getBuffer('image/png'));
  }
  img.resize({ w: targetW, h: targetH, mode: ResizeStrategy.BICUBIC });
  return Buffer.from(await img.getBuffer('image/png'));
}

// ── Main per-tileset logic ────────────────────────────────────────────────────

async function enhanceTileset(tileset) {
  const assetsDir = path.resolve(__dirname, '../assets');
  const origDir   = path.join(assetsDir, 'originals');
  const filePath  = path.join(assetsDir, tileset.file);

  if (!fs.existsSync(filePath)) {
    console.warn(`  SKIP – file not found: ${tileset.file}`);
    return;
  }

  console.log(`\n── ${tileset.file} (${tileset.w}×${tileset.h}) ──`);

  // 1. Back up original (once only)
  fs.mkdirSync(origDir, { recursive: true });
  const backupPath = path.join(origDir, tileset.file);
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
    console.log(`  Backed up to assets/originals/${tileset.file}`);
  }

  // 2. Encode original as base64 data URI
  const imgBuffer = fs.readFileSync(filePath);
  const dataUri = `data:image/png;base64,${imgBuffer.toString('base64')}`;

  // 3. Pick a prompt
  const prompts = PROMPTS[tileset.category] || [FALLBACK_PROMPT];
  const prompt  = prompts[Math.floor(Math.random() * prompts.length)];
  console.log(`  Prompt: "${prompt.slice(0, 80)}…"`);

  // 4. Call Replicate
  console.log('  Submitting to Replicate flux-2-flex…');
  let prediction = await createPrediction(dataUri, prompt, tileset.w, tileset.h);

  // If the synchronous Prefer:wait response isn't succeeded yet, poll
  if (prediction.status !== 'succeeded') {
    if (!prediction.urls?.get) {
      throw new Error(`No polling URL in response: ${JSON.stringify(prediction)}`);
    }
    console.log(`  Polling ${prediction.urls.get} `);
    prediction = await pollPrediction(prediction.urls.get);
    console.log(' done');
  }

  // 5. Get output URL
  const outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  if (!outputUrl) throw new Error('No output URL in prediction');
  console.log(`  Output URL: ${outputUrl}`);

  // 6. Download
  let outBuffer = await downloadBuffer(outputUrl);
  console.log(`  Downloaded ${outBuffer.length} bytes`);

  // 7. Resize to exact original dimensions (safety net)
  outBuffer = await resizeToExact(outBuffer, tileset.w, tileset.h);
  console.log(`  Resized to ${tileset.w}×${tileset.h}`);

  // 8. Save (overwrite)
  fs.writeFileSync(filePath, outBuffer);
  console.log(`  Saved → ${tileset.file}`);
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main() {
  const filters = process.argv.slice(2).map(s => s.toLowerCase());

  const targets = filters.length > 0
    ? TILESETS.filter(t => filters.some(f => t.file.toLowerCase().includes(f)))
    : TILESETS;

  if (targets.length === 0) {
    console.error('No tilesets matched the provided filter(s):', filters.join(', '));
    process.exit(1);
  }

  console.log(`Enhancing ${targets.length} tileset(s) with flux-2-flex…`);

  for (const tileset of targets) {
    try {
      await enhanceTileset(tileset);
    } catch (err) {
      console.error(`  ERROR processing ${tileset.file}: ${err.message}`);
      // Continue with remaining tilesets
    }
  }

  console.log('\nDone! Enhanced tilesets saved. Originals preserved in assets/originals/');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
