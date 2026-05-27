const fs = require('fs');
const path = require('path');

const mapJsonPath = path.join(__dirname, '..', 'ach2026-map.json');
const mapJson = JSON.parse(fs.readFileSync(mapJsonPath, 'utf8'));

if (!Array.isArray(mapJson.tilesets)) {
  console.error('No tilesets found');
  process.exit(1);
}

let gid = 1;
mapJson.tilesets.forEach((ts, idx) => {
  const effectiveCount = (ts.tilecount && ts.tilecount > 0) ? ts.tilecount : 1;
  ts.firstgid = gid;
  gid += effectiveCount;
  console.log(`tileset[${idx}] ${ts.name || ts.image} -> firstgid=${ts.firstgid} (count=${ts.tilecount||0}, effective=${effectiveCount})`);
});

fs.writeFileSync(mapJsonPath, JSON.stringify(mapJson, null, 2), 'utf8');
console.log('Rewrote firstgid values in', mapJsonPath);
