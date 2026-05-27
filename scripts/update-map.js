const fs = require('fs');
const path = require('path');
const sizeOf = require('image-size');

const projectRoot = path.resolve(__dirname, '..');
const assetsDir = path.join(projectRoot, 'assets');
const imagePath = path.join(assetsDir, 'ach2026-map.png');
const mapJsonPath = path.join(projectRoot, 'ach2026-map.json');

const TILE_SIZE = 16; // adjust if needed

if (!fs.existsSync(imagePath)) {
  console.error('Image not found:', imagePath);
  process.exit(2);
}

const dimensions = sizeOf(imagePath);
const imgWidth = dimensions.width;
const imgHeight = dimensions.height;

const mapWidth = Math.ceil(imgWidth / TILE_SIZE);
const mapHeight = Math.ceil(imgHeight / TILE_SIZE);

let mapJson = {};
try {
  mapJson = JSON.parse(fs.readFileSync(mapJsonPath, 'utf8'));
} catch (err) {
  console.error('Failed to read map JSON:', mapJsonPath, err.message);
  process.exit(3);
}

// Update tileset image dimensions
if (mapJson.tilesets && mapJson.tilesets[0]) {
  mapJson.tilesets[0].imagewidth = imgWidth;
  mapJson.tilesets[0].imageheight = imgHeight;
  mapJson.tilesets[0].columns = Math.floor(imgWidth / TILE_SIZE);
  mapJson.tilesets[0].tilecount = mapJson.tilesets[0].columns * Math.floor(imgHeight / TILE_SIZE);
}

mapJson.tilewidth = TILE_SIZE;
mapJson.tileheight = TILE_SIZE;
mapJson.width = mapWidth;
mapJson.height = mapHeight;

// Update the single layer size if present
if (mapJson.layers && mapJson.layers[0]) {
  mapJson.layers[0].width = mapWidth;
  mapJson.layers[0].height = mapHeight;
  // initialize data array with zeros if empty
  if (!Array.isArray(mapJson.layers[0].data) || mapJson.layers[0].data.length !== mapWidth * mapHeight) {
    mapJson.layers[0].data = new Array(mapWidth * mapHeight).fill(0);
  }
}

fs.writeFileSync(mapJsonPath, JSON.stringify(mapJson, null, 2), 'utf8');
console.log('Updated ach2026-map.json with image dimensions and map size:');
console.log(`  image: ${imgWidth}x${imgHeight}`);
console.log(`  tiles: ${mapWidth}x${mapHeight} (tile size ${TILE_SIZE})`);
