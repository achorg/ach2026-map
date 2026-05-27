const fs = require('fs');
const path = require('path');
const sizeOf = require('image-size');

const craftpixDir = path.join(__dirname, '..', 'craftpix-net-381103-free-simple-summer-top-down-vector-tileset', 'PNG');
const mapJsonPath = path.join(__dirname, '..', 'ach2026-map.json');
const TILE_SIZE = parseInt(process.env.TILE_SIZE || '64', 10);

if (!fs.existsSync(craftpixDir)) {
  console.error('Craftpix directory not found:', craftpixDir);
  process.exit(1);
}

const files = fs.readdirSync(craftpixDir).filter(f => f.toLowerCase().endsWith('.png'));
if (files.length === 0) {
  console.error('No PNG files found in craftpix directory');
  process.exit(1);
}

let mapJson = {};
try {
  mapJson = JSON.parse(fs.readFileSync(mapJsonPath, 'utf8'));
} catch (err) {
  console.error('Failed to read map JSON:', err.message);
  process.exit(1);
}

mapJson.tilesets = mapJson.tilesets || [];

files.forEach((file, idx) => {
  const filePath = path.join(craftpixDir, file);
  const dims = sizeOf(filePath);
  const cols = Math.max(1, Math.floor(dims.width / TILE_SIZE));
  const rows = Math.max(1, Math.floor(dims.height / TILE_SIZE));
  const tilecount = cols * rows;

  const tilesetEntry = {
    firstgid: mapJson.tilesets.reduce((acc, ts) => acc + (ts.tilecount || 0), 1),
    image: path.relative(path.join(__dirname, '..'), filePath).replace(/\\/g, '/'),
    imagewidth: dims.width,
    imageheight: dims.height,
    name: path.basename(file, '.png'),
    tilewidth: TILE_SIZE,
    tileheight: TILE_SIZE,
    tilecount: tilecount,
    columns: cols
  };

  mapJson.tilesets.push(tilesetEntry);
  console.log('Added tileset for', file, `(${dims.width}x${dims.height}, cols=${cols}, rows=${rows})`);
});

fs.writeFileSync(mapJsonPath, JSON.stringify(mapJson, null, 2), 'utf8');
console.log('Updated', mapJsonPath);
