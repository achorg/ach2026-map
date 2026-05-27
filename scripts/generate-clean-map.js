const fs = require('fs');
const path = require('path');
const sizeOf = require('image-size');

const projectRoot = path.join(__dirname, '..');
const imagePath = path.join(projectRoot, 'assets', 'ach2026-map.png');
const outPath = path.join(projectRoot, 'ach2026-map.json');
const TILE_SIZE = parseInt(process.env.TILE_SIZE || '16', 10);

if (!fs.existsSync(imagePath)) {
  console.error('Image not found:', imagePath);
  process.exit(1);
}

const dims = sizeOf(imagePath);
const imgW = dims.width;
const imgH = dims.height;
const mapWidth = Math.ceil(imgW / TILE_SIZE);
const mapHeight = Math.ceil(imgH / TILE_SIZE);

const data = new Array(mapWidth * mapHeight).fill(0);

const map = {
  height: mapHeight,
  width: mapWidth,
  infinite: false,
  layers: [
    {
      data: data,
      height: mapHeight,
      id: 1,
      name: 'Base',
      opacity: 1,
      type: 'tilelayer',
      visible: true,
      width: mapWidth,
      x: 0,
      y: 0
    },
    {
      id: 2,
      name: 'Props',
      type: 'objectgroup',
      visible: true,
      opacity: 1,
      x: 0,
      y: 0,
      objects: []
    },
    {
      id: 3,
      name: 'Portals',
      type: 'objectgroup',
      visible: true,
      opacity: 1,
      x: 0,
      y: 0,
      objects: []
    },
    {
      id: 4,
      name: 'Collision',
      type: 'objectgroup',
      visible: true,
      opacity: 1,
      x: 0,
      y: 0,
      objects: []
    }
  ],
  nextlayerid: 5,
  nextobjectid: 100,
  orientation: 'orthogonal',
  renderorder: 'right-down',
  tiledversion: '1.10.1',
  tileheight: TILE_SIZE,
  tilesets: [
    {
      columns: Math.floor(imgW / TILE_SIZE) || 1,
      firstgid: 1,
      image: 'assets/ach2026-map.png',
      imageheight: imgH,
      imagewidth: imgW,
      margin: 0,
      name: 'ach2026-map',
      spacing: 0,
      tilecount: Math.floor(imgW / TILE_SIZE) * Math.floor(imgH / TILE_SIZE),
      tileheight: TILE_SIZE,
      tilewidth: TILE_SIZE
    }
  ],
  tilewidth: TILE_SIZE,
  type: 'map',
  version: 1.10
};

fs.writeFileSync(outPath, JSON.stringify(map, null, 2), 'utf8');
console.log('Wrote clean map to', outPath, `(${mapWidth}x${mapHeight} tiles, image ${imgW}x${imgH})`);
