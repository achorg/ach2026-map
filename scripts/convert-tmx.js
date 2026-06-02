/**
 * Converts ach2026_map.tmx (Tiled XML format) to ach2026-map.json (Tiled JSON format)
 * and copies tileset PNG assets into the assets/ folder.
 *
 * Usage: node scripts/convert-tmx.js
 */

const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

const projectRoot = path.resolve(__dirname, '..');
const tmxPath = path.join(projectRoot, 'Map and Assets', 'ach2026_map.tmx');
const mapJsonPath = path.join(projectRoot, 'ach2026-map.json');
const assetsDir = path.join(projectRoot, 'assets');
const mapAssetsDir = path.join(projectRoot, 'Map and Assets');

// Ensure assets directory exists
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Copy all PNG files from "Map and Assets" to assets/
console.log('Copying PNG tileset files to assets/ ...');
const pngFiles = fs.readdirSync(mapAssetsDir).filter(f => f.toLowerCase().endsWith('.png'));
for (const file of pngFiles) {
  const src = path.join(mapAssetsDir, file);
  const dest = path.join(assetsDir, file);
  fs.copyFileSync(src, dest);
  console.log(`  Copied: ${file}`);
}

// Parse the TMX file
console.log('\nParsing TMX file...');
const tmxContent = fs.readFileSync(tmxPath, 'utf8');

xml2js.parseString(tmxContent, {
  explicitArray: true,
  preserveChildrenOrder: true,
  explicitChildren: true,
  charsAsChildren: false
}, (err, result) => {
  if (err) {
    console.error('Failed to parse TMX:', err.message);
    process.exit(1);
  }

  const mapEl = result.map;
  const mapAttrs = mapEl.$ || {};

  // Convert tilesets
  const tilesets = convertTilesets(mapEl.tileset || []);

  // Convert top-level layers and groups (preserving document order via $$)
  const layers = convertChildren(mapEl);

  const mapJson = {
    compressionlevel: -1,
    height: parseInt(mapAttrs.height, 10),
    infinite: mapAttrs.infinite === '1',
    layers: layers,
    nextlayerid: parseInt(mapAttrs.nextlayerid, 10),
    nextobjectid: parseInt(mapAttrs.nextobjectid, 10),
    orientation: mapAttrs.orientation || 'orthogonal',
    renderorder: mapAttrs.renderorder || 'right-down',
    tiledversion: mapAttrs.tiledversion || '1.12.1',
    tileheight: parseInt(mapAttrs.tileheight, 10),
    tilesets: tilesets,
    tilewidth: parseInt(mapAttrs.tilewidth, 10),
    type: 'map',
    version: mapAttrs.version || '1.10',
    width: parseInt(mapAttrs.width, 10)
  };

  fs.writeFileSync(mapJsonPath, JSON.stringify(mapJson, null, 2), 'utf8');
  console.log('\nWrote', mapJsonPath);
  console.log(`Map: ${mapJson.width}x${mapJson.height} tiles, ${tilesets.length} tilesets, ${countLayers(layers)} layers`);
});

/**
 * Convert <tileset> elements to JSON tileset objects
 */
function convertTilesets(tilesetEls) {
  return tilesetEls.map(ts => {
    const a = ts.$ || {};
    const imgEl = ts.image && ts.image[0] ? ts.image[0].$ || {} : {};
    const imageSource = imgEl.source || '';
    // Reference image relative to the map JSON (which sits at project root)
    const imageRef = 'assets/' + path.basename(imageSource);

    const obj = {
      firstgid: parseInt(a.firstgid, 10),
      columns: parseInt(a.columns, 10),
      image: imageRef,
      imageheight: parseInt(imgEl.height, 10),
      imagewidth: parseInt(imgEl.width, 10),
      margin: 0,
      name: a.name || '',
      spacing: 0,
      tilecount: parseInt(a.tilecount, 10),
      tileheight: parseInt(a.tileheight, 10),
      tilewidth: parseInt(a.tilewidth, 10)
    };

    // Handle per-tile properties (e.g. collides on Special_Zones)
    if (ts.tile && ts.tile.length > 0) {
      obj.tiles = ts.tile.map(tileEl => {
        const ta = tileEl.$ || {};
        const tileObj = { id: parseInt(ta.id, 10) };
        if (tileEl.properties && tileEl.properties[0] && tileEl.properties[0].property) {
          tileObj.properties = tileEl.properties[0].property.map(prop => {
            const pa = prop.$ || {};
            return {
              name: pa.name,
              type: pa.type || 'string',
              value: convertPropertyValue(pa.type, pa.value)
            };
          });
        }
        return tileObj;
      });
    }

    return obj;
  });
}

/**
 * Convert a TMX property value string to the appropriate JS type
 */
function convertPropertyValue(type, value) {
  switch (type) {
    case 'bool':  return value === 'true';
    case 'int':   return parseInt(value, 10);
    case 'float': return parseFloat(value);
    default:      return value;
  }
}

/**
 * Convert CSV layer data string to a flat integer array
 */
function csvToArray(csvText) {
  return csvText
    .split(/[\r\n,]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(s => parseInt(s, 10));
}

/**
 * Recursively convert child layer/group/objectgroup elements of a parent,
 * preserving the original document order via xml2js's $$ array.
 */
function convertChildren(parentEl) {
  const result = [];

  // Use $$ for ordered children (requires preserveChildrenOrder + explicitChildren)
  const orderedChildren = parentEl.$$ || [];

  for (const child of orderedChildren) {
    const tag = child['#name'];
    if (tag === 'group') {
      result.push(convertGroup(child));
    } else if (tag === 'layer') {
      result.push(convertTileLayer(child));
    } else if (tag === 'objectgroup') {
      result.push(convertObjectGroup(child));
    } else if (tag === 'imagelayer') {
      result.push(convertImageLayer(child));
    }
    // tileset elements are handled separately at the top level
  }

  return result;
}

/**
 * Convert a <group> element
 */
function convertGroup(groupEl) {
  const a = groupEl.$ || {};
  const obj = {
    id: parseInt(a.id, 10),
    layers: convertChildren(groupEl),
    name: a.name || '',
    opacity: parseFloat(a.opacity != null ? a.opacity : '1'),
    type: 'group',
    visible: a.visible !== '0',
    x: 0,
    y: 0
  };
  if (a.class) obj.class = a.class;
  return obj;
}

/**
 * Convert a <layer> (tile layer) element
 */
function convertTileLayer(layerEl) {
  const a = layerEl.$ || {};
  const dataEl = layerEl.data && layerEl.data[0] ? layerEl.data[0] : null;
  let data = [];
  if (dataEl) {
    const rawData = typeof dataEl === 'string' ? dataEl : (dataEl._ || dataEl);
    data = csvToArray(rawData);
  }

  const obj = {
    data: data,
    height: parseInt(a.height, 10),
    id: parseInt(a.id, 10),
    name: a.name || '',
    opacity: parseFloat(a.opacity != null ? a.opacity : '1'),
    type: 'tilelayer',
    visible: a.visible !== '0',
    width: parseInt(a.width, 10),
    x: 0,
    y: 0
  };

  if (a.class) obj.class = a.class;

  // Handle layer-level properties if present
  if (layerEl.properties && layerEl.properties[0] && layerEl.properties[0].property) {
    obj.properties = layerEl.properties[0].property.map(prop => {
      const pa = prop.$ || {};
      return {
        name: pa.name,
        type: pa.type || 'string',
        value: convertPropertyValue(pa.type, pa.value)
      };
    });
  }

  return obj;
}

/**
 * Convert an <objectgroup> element
 */
function convertObjectGroup(objGroupEl) {
  const a = objGroupEl.$ || {};
  const objects = (objGroupEl.object || []).map(objEl => {
    const oa = objEl.$ || {};
    const obj = {
      height: parseFloat(oa.height || '0'),
      id: parseInt(oa.id, 10),
      name: oa.name || '',
      rotation: parseFloat(oa.rotation || '0'),
      type: oa.type || '',
      visible: oa.visible !== '0',
      width: parseFloat(oa.width || '0'),
      x: parseFloat(oa.x || '0'),
      y: parseFloat(oa.y || '0')
    };
    if (oa.class) obj.class = oa.class;
    if (objEl.properties && objEl.properties[0] && objEl.properties[0].property) {
      obj.properties = objEl.properties[0].property.map(prop => {
        const pa = prop.$ || {};
        return {
          name: pa.name,
          type: pa.type || 'string',
          value: convertPropertyValue(pa.type, pa.value)
        };
      });
    }
    return obj;
  });

  const result = {
    draworder: a.draworder || 'topdown',
    id: parseInt(a.id, 10),
    name: a.name || '',
    objects: objects,
    opacity: parseFloat(a.opacity != null ? a.opacity : '1'),
    type: 'objectgroup',
    visible: a.visible !== '0',
    x: 0,
    y: 0
  };

  if (a.class) result.class = a.class;
  return result;
}

/**
 * Convert an <imagelayer> element
 */
function convertImageLayer(imgLayerEl) {
  const a = imgLayerEl.$ || {};
  const imgEl = imgLayerEl.image && imgLayerEl.image[0] ? imgLayerEl.image[0].$ || {} : {};
  return {
    id: parseInt(a.id, 10),
    image: imgEl.source ? 'assets/' + path.basename(imgEl.source) : '',
    name: a.name || '',
    opacity: parseFloat(a.opacity != null ? a.opacity : '1'),
    type: 'imagelayer',
    visible: a.visible !== '0',
    x: 0,
    y: 0
  };
}

/**
 * Count total layers (recursively, for reporting)
 */
function countLayers(layers) {
  let count = 0;
  for (const l of layers) {
    count++;
    if (l.type === 'group' && l.layers) {
      count += countLayers(l.layers);
    }
  }
  return count;
}
