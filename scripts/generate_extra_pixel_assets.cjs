const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Standard CRC32 table
let crcTable;
function getCrcTable() {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    crcTable[n] = c;
  }
  return crcTable;
}

function calcCrc(buf) {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createPng(width, height, rgbaBuffer) {
  const scanlineLength = width * 4 + 1;
  const filtered = Buffer.alloc(height * scanlineLength);
  for (let y = 0; y < height; y++) {
    filtered[y * scanlineLength] = 0; // Filter None
    rgbaBuffer.copy(filtered, y * scanlineLength + 1, y * width * 4, (y + 1) * width * 4);
  }
  const compressed = zlib.deflateSync(filtered);

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crc = calcCrc(Buffer.concat([typeBuf, data]));
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // 8-bit depth
  ihdr.writeUInt8(6, 9); // RGBA
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);

  const chunks = [
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0))
  ];
  return Buffer.concat(chunks);
}

function hexToRgba(hex, alpha = 255) {
  if (typeof hex === 'string') {
    hex = parseInt(hex.replace('#', ''), 16);
  }
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  return [r, g, b, alpha];
}

class PixelCanvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.buffer = Buffer.alloc(width * height * 4, 0);
  }

  setPixel(x, y, color) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const idx = (y * this.width + x) * 4;
    this.buffer[idx] = color[0];
    this.buffer[idx + 1] = color[1];
    this.buffer[idx + 2] = color[2];
    this.buffer[idx + 3] = color[3];
  }

  getPixel(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return [0, 0, 0, 0];
    const idx = (y * this.width + x) * 4;
    return [
      this.buffer[idx],
      this.buffer[idx + 1],
      this.buffer[idx + 2],
      this.buffer[idx + 3]
    ];
  }

  fillRect(x, y, w, h, color) {
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        this.setPixel(px, py, color);
      }
    }
  }

  strokeRect(x, y, w, h, color) {
    for (let px = x; px < x + w; px++) {
      this.setPixel(px, y, color);
      this.setPixel(px, y + h - 1, color);
    }
    for (let py = y; py < y + h; py++) {
      this.setPixel(x, py, color);
      this.setPixel(x + w - 1, py, color);
    }
  }

  drawAscii(x, y, palette, map) {
    for (let r = 0; r < map.length; r++) {
      const line = map[r];
      for (let c = 0; c < line.length; c++) {
        const char = line[c];
        if (palette[char]) {
          this.setPixel(x + c, y + r, palette[char]);
        }
      }
    }
  }

  toPngBuffer() {
    return createPng(this.width, this.height, this.buffer);
  }
}

const outDir = path.join(__dirname, '..', 'public', 'assets');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

console.log('Generating comprehensive Pixel Art Raster PNG Assets into:', outDir);

/* =========================================================================
 * 1. FACTORY ENVIRONMENT (Background, Floor, Belt, Intake, Crate)
 * ========================================================================= */

// Factory Background (128 x 128 seamless repeating, calm, eye-friendly industrial wall)
{
  const c = new PixelCanvas(128, 128);
  const wallBase = hexToRgba('#090d18');
  const panelSeam = hexToRgba('#111728');
  const seamLight = hexToRgba('#182035');

  // Fill base deep wall
  c.fillRect(0, 0, 128, 128, wallBase);

  // Large subtle structural panels (64x64 grids)
  for (let y = 0; y < 128; y += 64) {
    c.fillRect(0, y, 128, 1, panelSeam);
    c.fillRect(0, y + 1, 128, 1, seamLight);
  }
  for (let x = 0; x < 128; x += 64) {
    c.fillRect(x, 0, 1, 128, panelSeam);
    c.fillRect(x + 1, 0, 1, 128, seamLight);
  }

  // Very subtle 32px secondary accent seam
  for (let y = 32; y < 128; y += 64) {
    for (let x = 0; x < 128; x += 4) {
      c.setPixel(x, y, panelSeam);
    }
  }

  fs.writeFileSync(path.join(outDir, 'factory_bg.png'), c.toPngBuffer());
}

// Factory Floor (64 x 32 seamless repeating, calm & subtle industrial floor)
{
  const c = new PixelCanvas(64, 32);
  const floorBase = hexToRgba('#0d1222');
  const plateSeam = hexToRgba('#192238');
  const plateLight = hexToRgba('#222d4a');
  const curbTop = hexToRgba('#1b243b');
  const curbEdge = hexToRgba('#2b3859');

  // Clean curb edge at top (y: 0 to 4)
  c.fillRect(0, 0, 64, 2, curbEdge);
  c.fillRect(0, 2, 64, 3, curbTop);

  // Clean steel floor plates (y: 5 to 31)
  c.fillRect(0, 5, 64, 27, floorBase);
  for (let y = 5; y < 32; y += 14) {
    c.fillRect(0, y, 64, 1, plateSeam);
    c.fillRect(0, y + 1, 64, 1, plateLight);
  }
  for (let x = 0; x < 64; x += 32) {
    c.fillRect(x, 5, 1, 27, plateSeam);
    c.fillRect(x + 1, 5, 1, 27, plateLight);
  }

  fs.writeFileSync(path.join(outDir, 'factory_floor.png'), c.toPngBuffer());
}

// Conveyor Belt Segment (64 x 24 seamless)
{
  const c = new PixelCanvas(64, 24);
  const rubberDark = hexToRgba('#151926');
  const rubberMid = hexToRgba('#242b3d');
  const rubberLight = hexToRgba('#3d475f');
  const steelFrame = hexToRgba('#57606f');
  const steelLight = hexToRgba('#a4b0be');
  const steelDark = hexToRgba('#2f3542');
  const rollerColor = hexToRgba('#747d8c');

  // Roller guide rail (y: 0 to 4)
  c.fillRect(0, 0, 64, 2, steelLight);
  c.fillRect(0, 2, 64, 2, steelDark);

  // Belt surface (y: 4 to 12)
  c.fillRect(0, 4, 64, 8, rubberDark);
  // Tread ribs
  for (let x = 0; x < 64; x += 8) {
    c.fillRect(x, 4, 3, 8, rubberMid);
    c.fillRect(x + 1, 4, 1, 8, rubberLight);
  }

  // Steel chassis under belt (y: 12 to 18)
  c.fillRect(0, 12, 64, 4, steelFrame);
  c.fillRect(0, 12, 64, 1, steelLight);
  c.fillRect(0, 15, 64, 1, steelDark);

  // Support rollers & legs (y: 16 to 23)
  for (let lx = 8; lx < 64; lx += 32) {
    c.fillRect(lx, 16, 6, 8, steelDark);
    c.fillRect(lx + 1, 16, 4, 7, steelFrame);
    c.fillRect(lx - 2, 22, 10, 2, steelLight);
    // Circular roller hub
    c.fillRect(lx + 18, 14, 4, 4, rollerColor);
  }

  fs.writeFileSync(path.join(outDir, 'conveyor_belt.png'), c.toPngBuffer());
}

// Factory Intake Bunker (48 x 64)
{
  const c = new PixelCanvas(48, 64);
  const P = {
    '.': [0, 0, 0, 0],
    'D': hexToRgba('#0c1020'), // Dark outline
    'S': hexToRgba('#2f3542'), // Dark steel
    'M': hexToRgba('#57606f'), // Mid steel
    'L': hexToRgba('#a4b0be'), // Light steel
    'W': hexToRgba('#f1f2f6'), // Specular
    'C': hexToRgba('#00d2d3'), // Cyan tech line
    'G': hexToRgba('#2ecc71'), // Green status LED
    'g': hexToRgba('#27ae60'),
    'Y': hexToRgba('#f1c40f'), // Yellow hazard
  };

  // Funnel silo hopper
  for (let y = 4; y < 64; y++) {
    const halfW = y < 36 ? 20 : Math.max(8, 20 - Math.floor((y - 36) * 0.5));
    for (let x = 24 - halfW; x <= 24 + halfW; x++) {
      if (x === 24 - halfW || x === 24 + halfW || y === 4 || y === 63) {
        c.setPixel(x, y, P['D']);
      } else if (x === 24 - halfW + 1 || y === 5) {
        c.setPixel(x, y, P['L']);
      } else if (x === 24 + halfW - 1 || y === 62) {
        c.setPixel(x, y, P['S']);
      } else {
        c.setPixel(x, y, P['M']);
      }
    }
  }

  // Top intake grill slots
  c.fillRect(10, 8, 28, 4, P['S']);
  for (let gx = 12; gx <= 36; gx += 4) {
    c.fillRect(gx, 8, 2, 4, P['D']);
  }

  // Digital status gauge / LEDs
  c.fillRect(18, 18, 12, 6, P['D']);
  c.fillRect(20, 20, 3, 2, P['G']);
  c.fillRect(25, 20, 3, 2, P['G']);

  // Cyber cyan horizontal energy band
  c.fillRect(8, 30, 32, 2, P['C']);
  c.fillRect(10, 30, 28, 1, P['W']);

  // Discharge nozzle teeth at bottom
  c.fillRect(17, 56, 14, 6, P['S']);
  c.fillRect(19, 58, 10, 4, P['D']);

  fs.writeFileSync(path.join(outDir, 'factory_intake.png'), c.toPngBuffer());
}

// Shipping Crate with Pallet (48 x 48)
{
  const c = new PixelCanvas(48, 48);
  const D = hexToRgba('#0c1020');
  const woodBase = hexToRgba('#d35400');
  const woodLight = hexToRgba('#e67e22');
  const woodDark = hexToRgba('#ba4a00');
  const steelCorner = hexToRgba('#57606f');
  const steelHighlight = hexToRgba('#ced6e0');
  const palletWood = hexToRgba('#785338');
  const palletDark = hexToRgba('#4a3222');
  const labelWhite = hexToRgba('#f5f6fa');
  const labelYellow = hexToRgba('#f1c40f');

  // Bottom pallet (y: 38 to 47)
  c.fillRect(4, 38, 40, 4, palletWood);
  c.fillRect(4, 38, 40, 1, hexToRgba('#a57a5a'));
  c.fillRect(4, 41, 40, 1, palletDark);
  // Pallet feet
  c.fillRect(6, 42, 8, 5, palletDark);
  c.fillRect(20, 42, 8, 5, palletDark);
  c.fillRect(34, 42, 8, 5, palletDark);
  c.strokeRect(4, 38, 40, 9, D);

  // Main crate body (x: 6 to 42, y: 6 to 37)
  c.fillRect(6, 6, 36, 32, woodBase);
  c.fillRect(7, 7, 34, 1, woodLight);
  c.fillRect(7, 7, 1, 30, woodLight);
  c.fillRect(40, 7, 1, 30, woodDark);
  c.fillRect(7, 36, 34, 1, woodDark);

  // Steel corner brackets & rivets
  const corners = [
    [6, 6], [36, 6], [6, 31], [36, 31]
  ];
  for (const [cx, cy] of corners) {
    c.fillRect(cx, cy, 6, 6, steelCorner);
    c.strokeRect(cx, cy, 6, 6, D);
    c.setPixel(cx + 2, cy + 2, steelHighlight);
  }

  // Cross reinforcement diagonal braces
  for (let i = 0; i < 28; i++) {
    c.setPixel(10 + i, 9 + Math.floor(i * 0.9), woodDark);
    c.setPixel(37 - i, 9 + Math.floor(i * 0.9), woodDark);
  }

  // Shipping barcode / fragile label
  c.fillRect(16, 18, 16, 10, labelWhite);
  c.strokeRect(16, 18, 16, 10, D);
  c.fillRect(18, 20, 12, 2, labelYellow);
  // Barcode stripes
  for (let bx = 18; bx < 30; bx += 2) {
    c.fillRect(bx, 23, 1, 4, D);
  }

  c.strokeRect(6, 6, 36, 32, D);
  fs.writeFileSync(path.join(outDir, 'shipping_crate.png'), c.toPngBuffer());
}

/* =========================================================================
 * 2. FOUR DETAILED PIXEL ART MACHINES (64 x 64 each) + MOVING PARTS
 * ========================================================================= */

// Machine 0: Assembly Bench (Montaj Tezgahı) (64 x 64)
{
  const c = new PixelCanvas(64, 64);
  const D = hexToRgba('#0c1020');
  const benchWood = hexToRgba('#f4a261');
  const benchLight = hexToRgba('#f8c291');
  const benchDark = hexToRgba('#e77f3a');
  const steelMid = hexToRgba('#57606f');
  const steelLight = hexToRgba('#a4b0be');
  const steelDark = hexToRgba('#2f3542');
  const cyanGlow = hexToRgba('#00d2d3');
  const lampYellow = hexToRgba('#f1c40f');

  // Heavy steel base table legs (y: 38 to 61)
  c.fillRect(8, 38, 10, 23, steelDark);
  c.fillRect(46, 38, 10, 23, steelDark);
  c.fillRect(9, 39, 2, 22, steelLight);
  c.fillRect(47, 39, 2, 22, steelLight);
  c.fillRect(6, 60, 52, 3, steelMid); // Cross footer
  c.strokeRect(6, 60, 52, 3, D);

  // Workbench top slab (y: 28 to 38)
  c.fillRect(6, 28, 52, 10, benchWood);
  c.fillRect(6, 28, 52, 2, benchLight);
  c.fillRect(6, 36, 52, 2, benchDark);
  c.strokeRect(6, 28, 52, 10, D);

  // Drawers in the middle
  c.fillRect(20, 39, 24, 18, steelMid);
  c.strokeRect(20, 39, 24, 18, D);
  for (let dy = 41; dy < 56; dy += 6) {
    c.fillRect(22, dy, 20, 4, steelDark);
    c.fillRect(29, dy + 1, 6, 2, benchLight); // Handle
  }

  // Vise clamp on right (x: 46 to 56, y: 16 to 28)
  c.fillRect(48, 20, 8, 8, steelMid);
  c.fillRect(46, 18, 3, 10, steelLight);
  c.fillRect(55, 18, 3, 10, steelDark);
  c.strokeRect(46, 18, 12, 10, D);

  // Articulated desk lamp on left
  c.fillRect(10, 16, 2, 12, steelLight);
  c.fillRect(11, 10, 8, 2, steelLight);
  c.fillRect(17, 8, 8, 6, benchDark);
  c.fillRect(21, 14, 4, 3, lampYellow); // Lamp bulb glow

  // Tool pegboard back wall (x: 8 to 56, y: 4 to 27)
  c.fillRect(10, 4, 44, 23, hexToRgba('#1c233c'));
  c.strokeRect(10, 4, 44, 23, D);
  // Hanging wrench, hammer, gears
  c.fillRect(16, 8, 2, 10, steelLight);
  c.fillRect(15, 7, 4, 3, steelMid);
  c.fillRect(24, 8, 2, 8, benchDark);
  c.fillRect(22, 16, 6, 4, steelMid);
  // Gear wheel
  c.fillRect(34, 8, 6, 6, cyanGlow);
  c.fillRect(36, 10, 2, 2, D);

  fs.writeFileSync(path.join(outDir, 'machine_bench.png'), c.toPngBuffer());
}

// Machine 0 Part: Hammer / Piston Tool (32 x 32)
{
  const c = new PixelCanvas(32, 32);
  const D = hexToRgba('#0c1020');
  const steelMid = hexToRgba('#747d8c');
  const steelLight = hexToRgba('#ced6e0');
  const amber = hexToRgba('#f4a261');

  // Vertical shaft
  c.fillRect(14, 2, 4, 18, steelLight);
  c.fillRect(16, 2, 2, 18, steelMid);
  c.strokeRect(14, 2, 4, 18, D);

  // Heavy hammer head / robotic grip at bottom
  c.fillRect(8, 20, 16, 8, amber);
  c.fillRect(9, 21, 14, 2, hexToRgba('#ffd166'));
  c.strokeRect(8, 20, 16, 8, D);

  fs.writeFileSync(path.join(outDir, 'machine_bench_part.png'), c.toPngBuffer());
}

// Machine 1: Hydraulic Press (Pres Makinesi) (64 x 64)
{
  const c = new PixelCanvas(64, 64);
  const D = hexToRgba('#0c1020');
  const orangeBody = hexToRgba('#e67e22');
  const orangeLight = hexToRgba('#f39c12');
  const orangeDark = hexToRgba('#d35400');
  const steelPlate = hexToRgba('#7f8c8d');
  const steelLight = hexToRgba('#bdc3c7');
  const steelDark = hexToRgba('#2c3e50');
  const hazardY = hexToRgba('#f1c40f');
  const gaugeRed = hexToRgba('#e74c3c');

  // Bottom anvil base (y: 48 to 62)
  c.fillRect(6, 48, 52, 14, steelDark);
  c.fillRect(8, 48, 48, 2, steelLight);
  c.strokeRect(6, 48, 52, 14, D);
  // Anvil strike plate
  c.fillRect(18, 44, 28, 5, steelPlate);
  c.strokeRect(18, 44, 28, 5, D);

  // Dual heavy hydraulic columns (left: 8-16, right: 48-56)
  c.fillRect(8, 12, 10, 36, steelLight);
  c.fillRect(14, 12, 4, 36, steelDark);
  c.strokeRect(8, 12, 10, 36, D);

  c.fillRect(46, 12, 10, 36, steelLight);
  c.fillRect(52, 12, 4, 36, steelDark);
  c.strokeRect(46, 12, 10, 36, D);

  // Top header crosshead (y: 4 to 18)
  c.fillRect(6, 4, 52, 14, orangeBody);
  c.fillRect(6, 4, 52, 2, orangeLight);
  c.fillRect(6, 16, 52, 2, orangeDark);
  c.strokeRect(6, 4, 52, 14, D);

  // Analog pressure gauge in center top
  c.fillRect(26, 6, 12, 10, hexToRgba('#ffffff'));
  c.strokeRect(26, 6, 12, 10, D);
  c.fillRect(31, 8, 2, 4, gaugeRed); // Gauge needle
  c.fillRect(28, 13, 8, 1, hexToRgba('#2c3e50'));

  // Warning stripes on the crossbeam
  for (let z = 10; z < 22; z++) {
    if (z % 4 < 2) c.fillRect(z, 14, 2, 3, hazardY);
  }
  for (let z = 42; z < 54; z++) {
    if (z % 4 < 2) c.fillRect(z, 14, 2, 3, hazardY);
  }

  fs.writeFileSync(path.join(outDir, 'machine_press.png'), c.toPngBuffer());
}

// Machine 1 Part: Press Stamp Die (32 x 32)
{
  const c = new PixelCanvas(32, 32);
  const D = hexToRgba('#0c1020');
  const steelMid = hexToRgba('#95a5a6');
  const steelLight = hexToRgba('#ecf0f1');
  const redBand = hexToRgba('#e74c3c');

  // Hydraulic ram rod
  c.fillRect(13, 0, 6, 14, steelLight);
  c.fillRect(16, 0, 3, 14, hexToRgba('#7f8c8d'));
  c.strokeRect(13, 0, 6, 14, D);

  // Heavy steel stamp head
  c.fillRect(4, 14, 24, 12, steelMid);
  c.fillRect(4, 14, 24, 2, steelLight);
  c.fillRect(6, 18, 20, 3, redBand); // Safety stripe
  c.strokeRect(4, 14, 24, 12, D);

  fs.writeFileSync(path.join(outDir, 'machine_press_part.png'), c.toPngBuffer());
}

// Machine 2: Welding Robot (Kaynak Robotu) (64 x 64)
{
  const c = new PixelCanvas(64, 64);
  const D = hexToRgba('#0c1020');
  const blueBase = hexToRgba('#0984e3');
  const blueLight = hexToRgba('#74b9ff');
  const blueDark = hexToRgba('#0652dd');
  const steelDark = hexToRgba('#2d3436');
  const steelMid = hexToRgba('#636e72');
  const steelLight = hexToRgba('#b2bec3');
  const cyanArc = hexToRgba('#00d2d3');

  // Heavy circular turntable base (y: 44 to 62)
  c.fillRect(12, 50, 40, 12, steelDark);
  c.fillRect(16, 44, 32, 8, blueBase);
  c.fillRect(16, 44, 32, 2, blueLight);
  c.fillRect(16, 50, 32, 2, blueDark);
  c.strokeRect(12, 50, 40, 12, D);
  c.strokeRect(16, 44, 32, 8, D);

  // Turntable degrees dial
  for (let bx = 20; bx < 44; bx += 4) {
    c.fillRect(bx, 54, 2, 4, steelLight);
  }

  // Base pivot knuckle joint (x: 24 to 40, y: 32 to 44)
  c.fillRect(24, 32, 16, 12, blueDark);
  c.fillRect(25, 33, 14, 2, blueLight);
  c.strokeRect(24, 32, 16, 12, D);
  // Center pivot bolt
  c.fillRect(29, 35, 6, 6, steelLight);
  c.fillRect(30, 36, 4, 4, steelDark);

  // Lower arm strut (x: 20 to 28, y: 14 to 32)
  c.fillRect(22, 14, 8, 20, steelMid);
  c.fillRect(22, 14, 2, 20, steelLight);
  c.strokeRect(22, 14, 8, 20, D);

  // Hydraulic booster tube on the side
  c.fillRect(32, 18, 4, 16, steelLight);
  c.strokeRect(32, 18, 4, 16, D);

  // Upper elbow joint
  c.fillRect(20, 8, 12, 10, blueBase);
  c.strokeRect(20, 8, 12, 10, D);
  c.fillRect(24, 11, 4, 4, cyanArc);

  // Black coiled pneumatic cables wrapping around
  c.fillRect(18, 22, 3, 2, D);
  c.fillRect(31, 26, 3, 2, D);
  c.fillRect(19, 32, 3, 2, D);

  fs.writeFileSync(path.join(outDir, 'machine_welder.png'), c.toPngBuffer());
}

// Machine 2 Part: Welder Torch Arm & Arc Tip (32 x 32)
{
  const c = new PixelCanvas(32, 32);
  const D = hexToRgba('#0c1020');
  const steelMid = hexToRgba('#636e72');
  const steelLight = hexToRgba('#dfe6e9');
  const cyanGlow = hexToRgba('#00f0ff');
  const whiteSpark = hexToRgba('#ffffff');

  // Forearm tube
  c.fillRect(4, 14, 16, 4, steelMid);
  c.fillRect(4, 14, 16, 1, steelLight);
  c.strokeRect(4, 14, 16, 4, D);

  // Angled welding nozzle torch
  c.fillRect(20, 12, 6, 8, hexToRgba('#0984e3'));
  c.fillRect(26, 14, 4, 4, hexToRgba('#d63031')); // Copper tip
  c.strokeRect(20, 12, 10, 8, D);

  // Arc plasma spark
  c.fillRect(29, 13, 3, 6, cyanGlow);
  c.fillRect(30, 14, 2, 4, whiteSpark);

  fs.writeFileSync(path.join(outDir, 'machine_welder_part.png'), c.toPngBuffer());
}

// Machine 3: High-Tech Automation Line (Otomasyon Hattı) (64 x 64)
{
  const c = new PixelCanvas(64, 64);
  const D = hexToRgba('#0c1020');
  const cyberPurple = hexToRgba('#6c5ce7');
  const purpleLight = hexToRgba('#a29bfe');
  const purpleDark = hexToRgba('#4834d4');
  const steelDark = hexToRgba('#1e1f26');
  const neonCyan = hexToRgba('#00f0ff');
  const neonPink = hexToRgba('#ff007f');
  const glassBlue = hexToRgba('#00d2d3', 100);

  // Cyber chassis platform (y: 44 to 62)
  c.fillRect(8, 44, 48, 18, steelDark);
  c.fillRect(8, 44, 48, 2, purpleLight);
  c.strokeRect(8, 44, 48, 18, D);

  // Circuit board traces on base
  c.fillRect(14, 50, 10, 2, neonCyan);
  c.fillRect(24, 48, 2, 6, neonCyan);
  c.fillRect(36, 52, 12, 2, neonPink);
  c.fillRect(44, 50, 2, 6, neonPink);

  // Dual laser scanning towers (left: 8-18, right: 46-56)
  c.fillRect(8, 8, 10, 36, cyberPurple);
  c.fillRect(8, 8, 10, 2, purpleLight);
  c.fillRect(8, 8, 2, 36, purpleLight);
  c.fillRect(16, 8, 2, 36, purpleDark);
  c.strokeRect(8, 8, 10, 36, D);

  c.fillRect(46, 8, 10, 36, cyberPurple);
  c.fillRect(46, 8, 10, 2, purpleLight);
  c.fillRect(46, 8, 2, 36, purpleLight);
  c.fillRect(54, 8, 2, 36, purpleDark);
  c.strokeRect(46, 8, 10, 36, D);

  // Top scanner bridge across
  c.fillRect(8, 6, 48, 6, purpleDark);
  c.fillRect(8, 6, 48, 1, purpleLight);
  c.strokeRect(8, 6, 48, 6, D);

  // Optical emitter pods at top
  c.fillRect(12, 12, 4, 6, neonCyan);
  c.fillRect(48, 12, 4, 6, neonCyan);

  // Holographic protective chamber window (center: 18 to 46, 12 to 44)
  c.fillRect(18, 12, 28, 32, glassBlue);
  c.strokeRect(18, 12, 28, 32, hexToRgba('#00d2d3', 180));

  // Digital status terminal in center
  c.fillRect(24, 20, 16, 12, hexToRgba('#050508'));
  c.strokeRect(24, 20, 16, 12, neonCyan);
  c.fillRect(26, 23, 12, 2, neonCyan);
  c.fillRect(26, 27, 8, 2, neonPink);

  fs.writeFileSync(path.join(outDir, 'machine_automation.png'), c.toPngBuffer());
}

// Machine 3 Part: Scanning Laser Beam (32 x 32)
{
  const c = new PixelCanvas(32, 32);
  const cyanCore = hexToRgba('#ffffff');
  const cyanGlow = hexToRgba('#00f0ff', 220);
  const cyanFade = hexToRgba('#00d2d3', 100);

  // Vertical scanning beam with glow
  c.fillRect(13, 2, 6, 28, cyanFade);
  c.fillRect(14, 2, 4, 28, cyanGlow);
  c.fillRect(15, 2, 2, 28, cyanCore);

  // Laser focus emitter dot at top
  c.fillRect(12, 0, 8, 4, hexToRgba('#00f0ff'));
  c.fillRect(14, 1, 4, 2, hexToRgba('#ffffff'));

  fs.writeFileSync(path.join(outDir, 'machine_automation_part.png'), c.toPngBuffer());
}

// Machine Empty Platform (Unbought / Construction Slot) (64 x 64)
{
  const c = new PixelCanvas(64, 64);
  const D = hexToRgba('#0c1020');
  const baseSteel = hexToRgba('#181c2e');
  const hazardY = hexToRgba('#f1c40f', 160);
  const hazardB = hexToRgba('#1c1926');
  const boltColor = hexToRgba('#3d4e7a');

  // Low steel foundation block (y: 44 to 62)
  c.fillRect(8, 44, 48, 18, baseSteel);
  c.fillRect(8, 44, 48, 2, hexToRgba('#242f4c'));
  c.strokeRect(8, 44, 48, 18, D);

  // Hazard warning border on construction slab
  for (let x = 10; x < 54; x++) {
    if (x % 6 < 3) c.setPixel(x, 46, hazardY);
    else c.setPixel(x, 46, hazardB);
  }

  // Heavy steel anchor mounting bolts waiting for machine
  const bolts = [
    [12, 48], [50, 48], [12, 58], [50, 58]
  ];
  for (const [bx, by] of bolts) {
    c.fillRect(bx, by, 4, 4, boltColor);
    c.strokeRect(bx, by, 4, 4, D);
  }

  // Cross lines on slab
  c.fillRect(24, 52, 16, 2, hexToRgba('#242f4c'));
  c.fillRect(31, 47, 2, 12, hexToRgba('#242f4c'));

  fs.writeFileSync(path.join(outDir, 'machine_empty_slot.png'), c.toPngBuffer());
}

/* =========================================================================
 * 3. FLIGHT ENVIRONMENT & SKY BANDS (Ground, Platform, Sky Bands)
 * ========================================================================= */

// Flight Runway Ground (64 x 40 seamless)
{
  const c = new PixelCanvas(64, 40);
  const D = hexToRgba('#0c1020');
  const asphalt = hexToRgba('#2d3436');
  const asphaltDark = hexToRgba('#1e272e');
  const runwayYellow = hexToRgba('#f1c40f');
  const grassTop = hexToRgba('#27ae60');
  const grassDark = hexToRgba('#1e8449');
  const dirt = hexToRgba('#4a3222');

  // Surface grass & soil fringe (y: 0 to 4)
  c.fillRect(0, 0, 64, 2, grassTop);
  c.fillRect(0, 2, 64, 2, grassDark);

  // Runway tarmac surface (y: 4 to 28)
  c.fillRect(0, 4, 64, 24, asphalt);
  c.fillRect(0, 4, 64, 1, hexToRgba('#636e72'));

  // Center dashed runway marker
  for (let x = 0; x < 64; x += 16) {
    c.fillRect(x, 15, 10, 3, runwayYellow);
    c.fillRect(x, 18, 10, 1, hexToRgba('#b78103'));
  }

  // Base concrete & soil underground (y: 28 to 39)
  c.fillRect(0, 28, 64, 4, asphaltDark);
  c.fillRect(0, 32, 64, 8, dirt);
  c.strokeRect(0, 4, 64, 36, D);

  fs.writeFileSync(path.join(outDir, 'flight_ground.png'), c.toPngBuffer());
}

// Launch Platform Gantry Base (64 x 32)
{
  const c = new PixelCanvas(64, 32);
  const D = hexToRgba('#0c1020');
  const steelMid = hexToRgba('#57606f');
  const steelLight = hexToRgba('#a4b0be');
  const steelDark = hexToRgba('#2f3542');
  const hazardY = hexToRgba('#f1c40f');
  const redBeacon = hexToRgba('#ff4757');

  // Raised platform deck (y: 4 to 12)
  c.fillRect(4, 4, 56, 8, steelMid);
  c.fillRect(4, 4, 56, 2, steelLight);
  c.fillRect(4, 11, 56, 1, steelDark);
  c.strokeRect(4, 4, 56, 8, D);

  // Hazard edge
  for (let x = 6; x < 58; x++) {
    if (x % 6 < 3) c.setPixel(x, 6, hazardY);
    else c.setPixel(x, 6, D);
  }

  // Hydraulic legs & gantry footers (y: 12 to 31)
  const legs = [6, 22, 38, 50];
  for (const lx of legs) {
    c.fillRect(lx, 12, 6, 18, steelDark);
    c.fillRect(lx + 1, 12, 2, 17, steelLight);
    c.fillRect(lx - 2, 28, 10, 3, steelMid);
    c.strokeRect(lx - 2, 28, 10, 3, D);
  }

  // Warning light
  c.fillRect(28, 1, 4, 3, redBeacon);
  c.setPixel(29, 2, hexToRgba('#ffffff'));

  fs.writeFileSync(path.join(outDir, 'launch_platform.png'), c.toPngBuffer());
}

// Sky Band Day (64 x 64 dithered)
{
  const c = new PixelCanvas(64, 64);
  const cTop = hexToRgba('#1e3799'); // Deep blue
  const cMid = hexToRgba('#4a69bd'); // Mid blue
  const cBot = hexToRgba('#82ccdd'); // Light cyan
  for (let y = 0; y < 64; y++) {
    const t = y / 63;
    for (let x = 0; x < 64; x++) {
      const dither = ((x ^ y) & 1);
      if (t < 0.5) {
        c.setPixel(x, y, (t * 2 + dither * 0.1 > 0.55) ? cMid : cTop);
      } else {
        c.setPixel(x, y, ((t - 0.5) * 2 + dither * 0.1 > 0.55) ? cBot : cMid);
      }
    }
  }
  fs.writeFileSync(path.join(outDir, 'sky_band_day.png'), c.toPngBuffer());
}

// Sky Band Sunset / Stratosphere (64 x 64 dithered)
{
  const c = new PixelCanvas(64, 64);
  const cTop = hexToRgba('#1a1a3a'); // Dark violet
  const cMid = hexToRgba('#6a1b9a'); // Magenta
  const cBot = hexToRgba('#f39c12'); // Amber gold
  for (let y = 0; y < 64; y++) {
    const t = y / 63;
    for (let x = 0; x < 64; x++) {
      const dither = ((x + y) & 1);
      if (t < 0.5) {
        c.setPixel(x, y, (t * 2 + dither * 0.12 > 0.55) ? cMid : cTop);
      } else {
        c.setPixel(x, y, ((t - 0.5) * 2 + dither * 0.12 > 0.55) ? cBot : cMid);
      }
    }
  }
  fs.writeFileSync(path.join(outDir, 'sky_band_sunset.png'), c.toPngBuffer());
}

// Sky Band Space (64 x 64 dithered with micro stars)
{
  const c = new PixelCanvas(64, 64);
  const cDeep = hexToRgba('#070913'); // Pitch void
  const cNebula = hexToRgba('#181938');
  const cCyanDust = hexToRgba('#0c2444');
  c.fillRect(0, 0, 64, 64, cDeep);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      if ((x * 7 + y * 13) % 19 === 0) c.setPixel(x, y, cNebula);
      if ((x * 11 + y * 5) % 37 === 0) c.setPixel(x, y, cCyanDust);
      // Rare distant stars
      if ((x * 31 + y * 47) % 149 === 0) c.setPixel(x, y, hexToRgba('#ffffff', 200));
      if ((x * 19 + y * 73) % 211 === 0) c.setPixel(x, y, hexToRgba('#00d2d3', 180));
    }
  }
  fs.writeFileSync(path.join(outDir, 'sky_band_space.png'), c.toPngBuffer());
}

/* =========================================================================
 * 4. UI PANELS & CARDS (HUD Bar, Card BG, Modal Frame, Toast)
 * ========================================================================= */

// UI HUD Top Bar (32 x 32 9-slice)
{
  const c = new PixelCanvas(32, 32);
  const D = hexToRgba('#060810'); // Deep clean outer border
  const borderNavy = hexToRgba('#182035'); // Sleek navy frame
  const highlight = hexToRgba('#283556'); // 1px Bevel highlight
  const fillDark = hexToRgba('#0b0f1c'); // Calm deep background
  const shadow = hexToRgba('#070a13');

  c.fillRect(0, 0, 32, 32, fillDark);
  c.strokeRect(0, 0, 32, 32, D);
  c.strokeRect(1, 1, 30, 30, borderNavy);
  for (let x = 2; x < 30; x++) c.setPixel(x, 2, highlight);
  for (let y = 2; y < 30; y++) c.setPixel(2, y, highlight);
  for (let x = 2; x < 30; x++) c.setPixel(x, 29, shadow);
  for (let y = 2; y < 30; y++) c.setPixel(29, y, shadow);

  fs.writeFileSync(path.join(outDir, 'ui_panel_hud.png'), c.toPngBuffer());
}

// UI Card Background (32 x 32 9-slice, clean & calm)
{
  const c = new PixelCanvas(32, 32);
  const D = hexToRgba('#060810');
  const borderOuter = hexToRgba('#1a2238');
  const bevelLight = hexToRgba('#263252');
  const cardFill = hexToRgba('#0e1322');
  const bevelShadow = hexToRgba('#070a14');

  c.fillRect(0, 0, 32, 32, cardFill);
  c.strokeRect(0, 0, 32, 32, D);
  c.strokeRect(1, 1, 30, 30, borderOuter);
  for (let x = 2; x < 30; x++) c.setPixel(x, 2, bevelLight);
  for (let y = 2; y < 30; y++) c.setPixel(2, y, bevelLight);
  for (let x = 2; x < 30; x++) c.setPixel(x, 29, bevelShadow);
  for (let y = 2; y < 30; y++) c.setPixel(29, y, bevelShadow);

  fs.writeFileSync(path.join(outDir, 'ui_card_bg.png'), c.toPngBuffer());
}

// UI Modal Background (32 x 32 9-slice, clean & sleek)
{
  const c = new PixelCanvas(32, 32);
  const D = hexToRgba('#04060c');
  const frameSteel = hexToRgba('#1e273e');
  const frameLight = hexToRgba('#334166');
  const modalFill = hexToRgba('#0a0d18');
  const modalInner = hexToRgba('#0e1322');

  c.fillRect(0, 0, 32, 32, modalFill);
  c.strokeRect(0, 0, 32, 32, D);
  c.strokeRect(1, 1, 30, 30, frameSteel);
  c.strokeRect(2, 2, 28, 28, frameLight);
  c.strokeRect(3, 3, 26, 26, D);
  c.fillRect(4, 4, 24, 24, modalInner);

  fs.writeFileSync(path.join(outDir, 'ui_modal_bg.png'), c.toPngBuffer());
}

// UI Toast Notification Box (32 x 24 9-slice)
{
  const c = new PixelCanvas(32, 24);
  const D = hexToRgba('#070913');
  const goldBorder = hexToRgba('#ffd166');
  const goldLight = hexToRgba('#ffffff');
  const toastBg = hexToRgba('#0e1220', 240);

  c.fillRect(0, 0, 32, 24, toastBg);
  c.strokeRect(0, 0, 32, 24, D);
  c.strokeRect(1, 1, 30, 22, goldBorder);
  c.setPixel(2, 2, goldLight);
  c.setPixel(29, 2, goldLight);

  fs.writeFileSync(path.join(outDir, 'ui_toast_bg.png'), c.toPngBuffer());
}

/* =========================================================================
 * 5. UI BUTTONS IN ALL STATES (Green, Disabled, Red, Arcade, Launch, Tabs)
 * ========================================================================= */

// Helper function to build 32x24 beveled buttons
function createButton(normalHex, lightHex, darkHex, borderHex, isPressed = false) {
  const c = new PixelCanvas(32, 24);
  const D = hexToRgba('#070913');
  const bg = hexToRgba(normalHex);
  const light = hexToRgba(lightHex);
  const dark = hexToRgba(darkHex);
  const border = hexToRgba(borderHex);

  c.fillRect(0, 0, 32, 24, bg);
  c.strokeRect(0, 0, 32, 24, D);
  c.strokeRect(1, 1, 30, 22, border);

  if (!isPressed) {
    // Top & Left highlight
    for (let x = 2; x < 30; x++) {
      c.setPixel(x, 2, light);
      c.setPixel(x, 3, light);
    }
    for (let y = 2; y < 22; y++) c.setPixel(2, y, light);
    // Bottom & Right shadow
    for (let x = 2; x < 30; x++) {
      c.setPixel(x, 21, dark);
      c.setPixel(x, 20, dark);
    }
    for (let y = 2; y < 22; y++) c.setPixel(29, y, dark);
  } else {
    // Pressed: inverted shadow on top & left
    for (let x = 2; x < 30; x++) c.setPixel(x, 2, dark);
    for (let y = 2; y < 22; y++) c.setPixel(2, y, dark);
    for (let x = 2; x < 30; x++) c.setPixel(x, 21, light);
    for (let y = 2; y < 22; y++) c.setPixel(29, y, light);
  }
  return c.toPngBuffer();
}

// Green Buttons (Purchasable / Upgrade)
fs.writeFileSync(path.join(outDir, 'btn_green_normal.png'),
  createButton('#2ecc71', '#58d68d', '#1e8449', '#145a32', false));
fs.writeFileSync(path.join(outDir, 'btn_green_hover.png'),
  createButton('#38e07f', '#7dffaa', '#27ae60', '#196f3d', false));
fs.writeFileSync(path.join(outDir, 'btn_green_pressed.png'),
  createButton('#27ae60', '#58d68d', '#145a32', '#0e3a20', true));

// Disabled Button (Insufficient funds / Locked)
fs.writeFileSync(path.join(outDir, 'btn_disabled.png'),
  createButton('#22293e', '#3d4e7a', '#141a2e', '#0c1020', false));

// Red Danger / Cancel / Reset Button
fs.writeFileSync(path.join(outDir, 'btn_danger_normal.png'),
  createButton('#e74c3c', '#ec7063', '#b03a2e', '#78281f', false));
fs.writeFileSync(path.join(outDir, 'btn_danger_pressed.png'),
  createButton('#c0392b', '#e74c3c', '#78281f', '#4d1913', true));

// Tab Inactive & Active (48 x 24)
{
  const cInact = new PixelCanvas(48, 24);
  cInact.fillRect(0, 0, 48, 24, hexToRgba('#141a2e'));
  cInact.strokeRect(0, 0, 48, 24, hexToRgba('#070913'));
  cInact.strokeRect(1, 1, 46, 22, hexToRgba('#242f4c'));
  fs.writeFileSync(path.join(outDir, 'btn_tab_inactive.png'), cInact.toPngBuffer());

  const cAct = new PixelCanvas(48, 24);
  cAct.fillRect(0, 0, 48, 24, hexToRgba('#242f4c'));
  cAct.strokeRect(0, 0, 48, 24, hexToRgba('#070913'));
  // Top neon amber/cyan indicator line
  cAct.fillRect(2, 1, 44, 2, hexToRgba('#f4a261'));
  cAct.fillRect(2, 2, 44, 1, hexToRgba('#ffffff'));
  fs.writeFileSync(path.join(outDir, 'btn_tab_active.png'), cAct.toPngBuffer());
}

// Manual Production Click Button (Big Industrial Amber Console) (80 x 36)
function createBigConsoleButton(mainHex, lightHex, darkHex, isPressed = false) {
  const c = new PixelCanvas(80, 36);
  const D = hexToRgba('#070913');
  const main = hexToRgba(mainHex);
  const light = hexToRgba(lightHex);
  const dark = hexToRgba(darkHex);
  const border = hexToRgba('#2c3e50');

  // Outer console housing (y: 0 to 35)
  c.fillRect(0, 0, 80, 36, border);
  c.strokeRect(0, 0, 80, 36, D);

  // Inner button face (x: 4 to 75, y: 3 to 32)
  c.fillRect(4, 3, 72, 30, main);
  c.strokeRect(4, 3, 72, 30, D);

  if (!isPressed) {
    // 3D Bevel
    c.fillRect(5, 4, 70, 3, light);
    c.fillRect(5, 4, 3, 28, light);
    c.fillRect(5, 29, 70, 3, dark);
    c.fillRect(72, 4, 3, 28, dark);
  } else {
    c.fillRect(5, 4, 70, 3, dark);
    c.fillRect(5, 4, 3, 28, dark);
    c.fillRect(5, 29, 70, 3, light);
    c.fillRect(72, 4, 3, 28, light);
  }
  return c.toPngBuffer();
}

fs.writeFileSync(path.join(outDir, 'btn_manual_normal.png'),
  createBigConsoleButton('#f4a261', '#ffd166', '#d35400', false));
fs.writeFileSync(path.join(outDir, 'btn_manual_hover.png'),
  createBigConsoleButton('#ffb47b', '#ffffff', '#e67e22', false));
fs.writeFileSync(path.join(outDir, 'btn_manual_pressed.png'),
  createBigConsoleButton('#d35400', '#f4a261', '#963c00', true));

// Launch Rocket Button (Big Cyber Cyan Console) (80 x 36)
fs.writeFileSync(path.join(outDir, 'btn_launch_normal.png'),
  createBigConsoleButton('#00d2d3', '#e0f8ff', '#01a3a4', false));
fs.writeFileSync(path.join(outDir, 'btn_launch_hover.png'),
  createBigConsoleButton('#20e5e6', '#ffffff', '#00d2d3', false));
fs.writeFileSync(path.join(outDir, 'btn_launch_pressed.png'),
  createBigConsoleButton('#01a3a4', '#00d2d3', '#007071', true));

/* =========================================================================
 * 6. GAUGES & PROGRESS BARS (Bar Slot, Green, Red, Cyan, Gold Fills)
 * ========================================================================= */

// Bar Slot Housing (32 x 12 9-slice)
{
  const c = new PixelCanvas(32, 12);
  const D = hexToRgba('#070913');
  const slotDark = hexToRgba('#0e1220');
  const innerShadow = hexToRgba('#05070e');
  const edgeLight = hexToRgba('#242f4c');

  c.fillRect(0, 0, 32, 12, slotDark);
  c.strokeRect(0, 0, 32, 12, D);
  c.strokeRect(1, 1, 30, 10, edgeLight);
  c.fillRect(2, 2, 28, 8, innerShadow);

  fs.writeFileSync(path.join(outDir, 'ui_bar_slot.png'), c.toPngBuffer());
}

// Helper for bar fill pattern (16 x 8)
function createBarFill(mainHex, lightHex, darkHex) {
  const c = new PixelCanvas(16, 8);
  const main = hexToRgba(mainHex);
  const light = hexToRgba(lightHex);
  const dark = hexToRgba(darkHex);

  c.fillRect(0, 0, 16, 8, main);
  c.fillRect(0, 0, 16, 2, light);
  c.fillRect(0, 6, 16, 2, dark);
  // Segment tick lines
  for (let x = 0; x < 16; x += 4) {
    c.fillRect(x, 0, 1, 8, dark);
  }
  return c.toPngBuffer();
}

fs.writeFileSync(path.join(outDir, 'ui_bar_fill_green.png'),
  createBarFill('#2ecc71', '#a8e6cf', '#27ae60'));
fs.writeFileSync(path.join(outDir, 'ui_bar_fill_red.png'),
  createBarFill('#e74c3c', '#ff7675', '#c0392b'));
fs.writeFileSync(path.join(outDir, 'ui_bar_fill_cyan.png'),
  createBarFill('#00d2d3', '#dff9fb', '#0984e3'));
fs.writeFileSync(path.join(outDir, 'ui_bar_fill_gold.png'),
  createBarFill('#ffd166', '#fff3cd', '#f39c12'));

/* =========================================================================
 * 7. ICONS (16 x 16 Pixel Sharp Icons)
 * ========================================================================= */

// Icon Coin (16x16)
{
  const c = new PixelCanvas(16, 16);
  const P = {
    '.': [0, 0, 0, 0],
    'D': hexToRgba('#1c1926'),
    'G': hexToRgba('#f1c40f'),
    'Y': hexToRgba('#ffd166'),
    'W': hexToRgba('#ffffff'),
    'd': hexToRgba('#b78103'),
  };
  const art = [
    ".....DDDD.......",
    "...DDYYYYDD.....",
    "..DYWWYYYYYD....",
    ".DYYWWYYYYYYD...",
    ".DYYYYGGYYYYd...",
    "DYYYYGGGGYYYdD..",
    "DYYYYGddGYYYdD..",
    "DYYYYGddGYYYdD..",
    "DYYYYGGGGYYYdD..",
    "DYYYYGGYYYYYdD..",
    ".DYYYYYYYYYYd...",
    ".DYYddddddYYd...",
    "..DYddddddYD....",
    "...DDddddDD.....",
    ".....DDDD.......",
    "................"
  ];
  c.drawAscii(0, 0, P, art);
  fs.writeFileSync(path.join(outDir, 'icon_coin.png'), c.toPngBuffer());
}

// Icon Gear (16x16)
{
  const c = new PixelCanvas(16, 16);
  const P = {
    '.': [0, 0, 0, 0],
    'D': hexToRgba('#1c1926'),
    'G': hexToRgba('#a4b0be'),
    'W': hexToRgba('#f1f2f6'),
    'S': hexToRgba('#57606f'),
  };
  const art = [
    "....DD....DD....",
    "...DWWDDDDWWD...",
    "..DDWGGGGGGWDD..",
    "..DWGGDDDDGGWD..",
    ".DDGGDD..DDGGDD.",
    ".DWGD......DGWd.",
    ".DWG........GWD.",
    "DDWG........GWDD",
    "DDWG........GWDD",
    ".DWG........GWD.",
    ".DWSD......DSWD.",
    ".DDSGDD..DDGSDD.",
    "..DWSSDDDDSSWD..",
    "..DDWSSSSSSWDD..",
    "...DWWDDDDWWD...",
    "....DD....DD...."
  ];
  c.drawAscii(0, 0, P, art);
  fs.writeFileSync(path.join(outDir, 'icon_gear.png'), c.toPngBuffer());
}

// Icon Settings (16x16)
{
  const c = new PixelCanvas(16, 16);
  const P = {
    '.': [0, 0, 0, 0],
    'D': hexToRgba('#0c1020'),
    'S': hexToRgba('#3d4e7a'),
    'L': hexToRgba('#74b9ff'),
    'W': hexToRgba('#ffffff'),
  };
  const art = [
    ".....DDDD.......",
    "....DWLLWD......",
    "..DDDWLLWDDD....",
    ".DWLDDWWDDLWD...",
    ".DWL......LWD...",
    "DDW........WDD..",
    "DLL........LLD..",
    "DLL...DD...LLD..",
    "DLL...DD...LLD..",
    "DDW........WDD..",
    ".DWL......LWD...",
    ".DWLDDWWDDLWD...",
    "..DDDWSSWDDD....",
    "....DWSSWD......",
    ".....DDDD.......",
    "................"
  ];
  c.drawAscii(0, 0, P, art);
  fs.writeFileSync(path.join(outDir, 'icon_settings.png'), c.toPngBuffer());
}

// Icon Rocket (16x16)
{
  const c = new PixelCanvas(16, 16);
  const P = {
    '.': [0, 0, 0, 0],
    'D': hexToRgba('#0c1020'),
    'W': hexToRgba('#ffffff'),
    'R': hexToRgba('#e74c3c'),
    'C': hexToRgba('#00d2d3'),
    'F': hexToRgba('#f39c12'),
  };
  const art = [
    "............DD..",
    "...........DRRD.",
    "..........DRWWRD",
    ".........DRWWWWD",
    "........DRWCCWWD",
    ".......DRWWCCWWD",
    "......DRWWWWWWWD",
    ".....DRWWWWWWWWD",
    "....DRWWWWWWWWD.",
    "...DRRWWWWWRRD..",
    "..DRRDDRRRRD....",
    ".DRD...DFFD.....",
    "DD......DFD.....",
    ".........D......",
    "................",
    "................"
  ];
  c.drawAscii(0, 0, P, art);
  fs.writeFileSync(path.join(outDir, 'icon_rocket.png'), c.toPngBuffer());
}

// Icon Factory (16x16)
{
  const c = new PixelCanvas(16, 16);
  const P = {
    '.': [0, 0, 0, 0],
    'D': hexToRgba('#0c1020'),
    'Y': hexToRgba('#f4a261'),
    'S': hexToRgba('#57606f'),
    'W': hexToRgba('#ffffff'),
    's': hexToRgba('#a4b0be'),
  };
  const art = [
    ".....ss.........",
    "....ssss........",
    "...ssssss.......",
    "..DD...DD.......",
    "..DYD..DYD......",
    "..DYD..DYD......",
    ".DDYD.DDYD.DD...",
    ".DYYD.DYYD.DSD..",
    "DYYYYDYYYYDYYSD.",
    "DYYWWDYYWWDYYSD.",
    "DYYWWDYYWWDYYSD.",
    "DYYYYYYYYYYYYSD.",
    "DYYDDYYYYDDYYSD.",
    "DYYDDYYYYDDYYSD.",
    "DDDDDDDDDDDDDDD.",
    "................"
  ];
  c.drawAscii(0, 0, P, art);
  fs.writeFileSync(path.join(outDir, 'icon_factory.png'), c.toPngBuffer());
}

// Icon Heart / HP (16x16)
{
  const c = new PixelCanvas(16, 16);
  const P = {
    '.': [0, 0, 0, 0],
    'D': hexToRgba('#1c1926'),
    'R': hexToRgba('#ff4757'),
    'W': hexToRgba('#ffffff'),
    'r': hexToRgba('#c23616'),
  };
  const art = [
    "................",
    "..DDD....DDD....",
    ".DRRRD..DRRRD...",
    "DRRWWRDDRRRRRD..",
    "DRRWWWRRRRRRRD..",
    "DRRRRRRRRRRRRD..",
    ".DRRRRRRRRRRD...",
    "..DRRRRRRRRD....",
    "...DRRRRRRD.....",
    "....DRRRRD......",
    ".....DRRD.......",
    "......DD........",
    "................",
    "................",
    "................",
    "................"
  ];
  c.drawAscii(0, 0, P, art);
  fs.writeFileSync(path.join(outDir, 'icon_heart.png'), c.toPngBuffer());
}

// Icon Lightning / Boost (16x16)
{
  const c = new PixelCanvas(16, 16);
  const P = {
    '.': [0, 0, 0, 0],
    'D': hexToRgba('#053947'),
    'C': hexToRgba('#00d2d3'),
    'W': hexToRgba('#ffffff'),
    'c': hexToRgba('#01a3a4'),
  };
  const art = [
    ".......DD.......",
    "......DCCD......",
    ".....DCWCD......",
    "....DCWWCD......",
    "...DCWCCCD......",
    "..DCWCCCCDDDDD..",
    ".DCWCCCCCCCCCD..",
    ".DDDDDDDCCCCD...",
    ".......DCCCD....",
    "......DCCCD.....",
    ".....DCCCD......",
    "....DCWCD.......",
    "...DCWCD........",
    "..DCCD..........",
    "..DD............",
    "................"
  ];
  c.drawAscii(0, 0, P, art);
  fs.writeFileSync(path.join(outDir, 'icon_lightning.png'), c.toPngBuffer());
}

// Icon Trophy / Highscore (16x16)
{
  const c = new PixelCanvas(16, 16);
  const P = {
    '.': [0, 0, 0, 0],
    'D': hexToRgba('#1c1926'),
    'G': hexToRgba('#f1c40f'),
    'W': hexToRgba('#ffffff'),
    'd': hexToRgba('#b78103'),
  };
  const art = [
    ".DDDDDDDDDDDD...",
    "DGWWGGGGGGGGdD..",
    "DGDDGGGGGGDDdD..",
    "DGD.DGGGGd.DdD..",
    ".D..DGGGGd...D..",
    "....DGGGGd......",
    ".....DGGd.......",
    "......DGd.......",
    "......DGD.......",
    ".....DGGGD......",
    "....DGGGGGD.....",
    "....DDDDDDD.....",
    "................",
    "................",
    "................",
    "................"
  ];
  c.drawAscii(0, 0, P, art);
  fs.writeFileSync(path.join(outDir, 'icon_trophy.png'), c.toPngBuffer());
}

// Icon Distance / Flag (16x16)
{
  const c = new PixelCanvas(16, 16);
  const P = {
    '.': [0, 0, 0, 0],
    'D': hexToRgba('#1c1926'),
    'W': hexToRgba('#ffffff'),
    'B': hexToRgba('#0c1020'),
    'S': hexToRgba('#a4b0be'),
  };
  const art = [
    "..DDDDDDDDDD....",
    "..DWBWBWBD......",
    "..DBWBWBWD......",
    "..DWBWBWBD......",
    "..DBWBWBWD......",
    "..DDDDDDDD......",
    "..DS............",
    "..DS............",
    "..DS............",
    "..DS............",
    "..DS............",
    "..DS............",
    "..DS............",
    ".DDD............",
    "................",
    "................"
  ];
  c.drawAscii(0, 0, P, art);
  fs.writeFileSync(path.join(outDir, 'icon_flag.png'), c.toPngBuffer());
}

// Icon Close X (16x16)
{
  const c = new PixelCanvas(16, 16);
  const P = {
    '.': [0, 0, 0, 0],
    'D': hexToRgba('#1c1926'),
    'R': hexToRgba('#ff4757'),
    'W': hexToRgba('#ffffff'),
  };
  const art = [
    "................",
    "..DD........DD..",
    ".DRRD......DRRD.",
    ".DRWRD....DRWRD.",
    "..DRRRD..DRRRD..",
    "...DRRRDDRRRD...",
    "....DRRRRRRD....",
    ".....DRRRRD.....",
    ".....DRRRRD.....",
    "....DRRRRRRD....",
    "...DRRRDDRRRD...",
    "..DRRRD..DRRRD..",
    ".DRWRD....DRWRD.",
    ".DRRD......DRRD.",
    "..DD........DD..",
    "................"
  ];
  c.drawAscii(0, 0, P, art);
  fs.writeFileSync(path.join(outDir, 'icon_close.png'), c.toPngBuffer());
}

// Icon Checkmark (16x16)
{
  const c = new PixelCanvas(16, 16);
  const P = {
    '.': [0, 0, 0, 0],
    'D': hexToRgba('#144023'),
    'G': hexToRgba('#2ecc71'),
    'W': hexToRgba('#ffffff'),
  };
  const art = [
    "................",
    ".............DD.",
    "............DGGD",
    "...........DGGGD",
    "..........DGWWGD",
    ".........DGGWGD.",
    "DD......DGGGGD..",
    "DGGD...DGGGGGD..",
    "DGWWGD.DGGWGD...",
    ".DGGWGDGGWGD....",
    "..DGGWGGWGD.....",
    "...DGGWWGD......",
    "....DGGGD.......",
    ".....DGD........",
    "......D.........",
    "................"
  ];
  c.drawAscii(0, 0, P, art);
  fs.writeFileSync(path.join(outDir, 'icon_check.png'), c.toPngBuffer());
}

console.log('Successfully generated all extra pixel art raster PNG assets!');
