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

// Helper to convert hex string or number to [R, G, B, A]
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

  fillRect(x, y, w, h, color) {
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        this.setPixel(px, py, color);
      }
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

console.log('Generating pixel art raster PNG assets into:', outDir);

/* =========================================================================
 * 1. ROCKET HULLS (32 x 20)
 * ========================================================================= */

// Hull 1: Classic Retro-Futuristic Red & White (32x20)
{
  const c = new PixelCanvas(32, 20);
  const P = {
    '.': [0, 0, 0, 0],
    'D': hexToRgba('#1c1926'), // Dark outline
    'W': hexToRgba('#ecf0f1'), // White body
    'S': hexToRgba('#bdc3c7'), // Silver/shadow white
    'R': hexToRgba('#e74c3c'), // Red stripe
    'r': hexToRgba('#c0392b'), // Dark red
    'C': hexToRgba('#3498db'), // Glass cyan
    'c': hexToRgba('#2980b9'), // Deep cyan
    'G': hexToRgba('#f1c40f'), // Gold headlight
    'Y': hexToRgba('#ffffff'), // White specular
  };
  const art = [
    "................................",
    "...................DDDD.........",
    "..............DDDDDWRRDDD.......",
    "...........DDDWWWWWWRRRRDD......",
    ".........DDWWWWWWWWWWWRRRRDD....",
    ".......DDWWWWCCCYWWWWWWRRRRDD...",
    "......DWWWWWCCCCYYWWWWWWRRRRDD..",
    ".....DWWWWWWCCCCYYWWWWWWWRRRRDG.",
    "....DWWWWWWWCCCYWWWWWWWWWRRRRDG.",
    "...DWWWWWWWWWWWWWWWWWWWWWRRRRDD.",
    "...DWSSSSSSSSSSSSSSSSSSSSrrrrDD.",
    "....DWSSSSSSSrSrrrrrrSSSSrrrrDG.",
    ".....DWSSSSSrSrrrrrrrSSSSrrrrDG.",
    "......DWSSSSSrSrrrrrrSSSSrrrrDD.",
    ".......DDSSSSSSSSSSSSSSSSrrrrDD.",
    ".........DDSSSSSSSSSSSSrrrrDD...",
    "...........DDDDSSSSSSrrrrDD.....",
    "..............DDDDDDDDDDD.......",
    "................................",
    "................................"
  ];
  c.drawAscii(0, 0, P, art);
  fs.writeFileSync(path.join(outDir, 'rocket_hull_1.png'), c.toPngBuffer());
}

// Hull 2: Titanium Armored Blue & Hazard Yellow (32x20)
{
  const c = new PixelCanvas(32, 20);
  const P = {
    '.': [0, 0, 0, 0],
    'D': hexToRgba('#0c1022'), // Dark outline
    'B': hexToRgba('#2980b9'), // Steel blue
    'b': hexToRgba('#1a5276'), // Dark blue
    'S': hexToRgba('#7f8c8d'), // Plate grey
    's': hexToRgba('#34495e'), // Dark plate
    'H': hexToRgba('#f39c12'), // Hazard amber
    'h': hexToRgba('#d35400'), // Dark amber
    'C': hexToRgba('#00d2d3'), // Tech cyan visor
    'Y': hexToRgba('#e0f8ff'), // Highlight
  };
  const art = [
    "................................",
    "...................DDDD.........",
    "..............DDDDDBBHHDD.......",
    "...........DDDsssssBBHHbbD......",
    ".........DDsssssBBBBBHHbbbbD....",
    ".......DDssssCCCYBBBBHHbbbbbD...",
    "......DsssssCCCCYYBBBHHbbbbbbD..",
    ".....DssssssCCCCYYBBBHHbbbbbbHD.",
    "....DsssssssCCCYBBBBBHHbbbbbbHD.",
    "...DsssssssssssssssssHHbbbbbbHD.",
    "...DsssssssssHsHhhhhhHHbbbbbbDD.",
    "....DsssssssHsHhhhhhhHHbbbbbbHD.",
    ".....DssssssHsHhhhhhhHHbbbbbbHD.",
    "......DsssssCCCCYYbbbHHbbbbbbD..",
    ".......DDsssCCCYbbbbbHHbbbbbD...",
    ".........DDbbbbbbbbbbHHbbbbD....",
    "...........DDDDbbbbbbHHbbD......",
    "..............DDDDDDDDDDD.......",
    "................................",
    "................................"
  ];
  c.drawAscii(0, 0, P, art);
  fs.writeFileSync(path.join(outDir, 'rocket_hull_2.png'), c.toPngBuffer());
}

// Hull 3: Stealth Carbon Interceptor with Neon Magenta Conduit (32x20)
{
  const c = new PixelCanvas(32, 20);
  const P = {
    '.': [0, 0, 0, 0],
    'D': hexToRgba('#050508'), // Pitch black outline
    'K': hexToRgba('#1f1f2e'), // Carbon base
    'k': hexToRgba('#12121c'), // Dark carbon
    'M': hexToRgba('#ff007f'), // Neon magenta glow
    'm': hexToRgba('#99004d'), // Dark magenta
    'A': hexToRgba('#00f0ff'), // Cyber cyan
    'a': hexToRgba('#0099aa'), // Tech blue
    'W': hexToRgba('#ffffff'), // Pure highlight
  };
  const art = [
    "................................",
    "...................DDDD.........",
    "..............DDDDDKKMMAAA......",
    "...........DDDKKKKKKKMMMAAAD....",
    ".........DDKKKKKKKKKKMMMMAAAAA..",
    ".......DDKKKAAAAKKKKKMMMAAAAA...",
    "......DKKKKAAAAWWKKKKMMMAAAAA...",
    ".....DKKKKKAAAAWWKKKKMMMAAAAAA..",
    "....DKKKKKKAAAAKKKKKKMMMAAAAAA..",
    "...DKKKMMMMMMMMMMMMMMMMMAAAAAAD.",
    "...DkkkMMMMMMMMMMMMMMMMMAAAAAAD.",
    "....DkkkAAAkAaaaaakkkMMMAAAAAA..",
    ".....DkkkAAkAaaaaakkkMMMAAAAAA..",
    "......DkkkAAAAWWkkkkkMMMAAAAA...",
    ".......DDkAAAAkkkkkkkMMMAAAAA...",
    ".........DDkkkkkkkkkkMMMMAAAAA..",
    "...........DDDDkkkkkkMMMAAAD....",
    "..............DDDDDDDKKMMAAA....",
    "................................",
    "................................"
  ];
  c.drawAscii(0, 0, P, art);
  fs.writeFileSync(path.join(outDir, 'rocket_hull_3.png'), c.toPngBuffer());
}

/* =========================================================================
 * 2. ROCKET ENGINES (16 x 16)
 * ========================================================================= */

// Engine 1: Single Bell Nozzle
{
  const c = new PixelCanvas(16, 16);
  const P = {
    '.': [0, 0, 0, 0],
    'D': hexToRgba('#11141a'),
    'M': hexToRgba('#7f8c8d'),
    'm': hexToRgba('#34495e'),
    'O': hexToRgba('#e67e22'),
    'o': hexToRgba('#d35400'),
  };
  const art = [
    "................",
    "................",
    "......DDDD......",
    "....DDMMMMDD....",
    "...DMMMMMMMMD...",
    "..DMMOmmmmOMMD..",
    "..DMMOmmmmOMMD..",
    ".DMMOommmmoOMMD.",
    ".DMMOommmmoOMMD.",
    "..DMMOmmmmOMMD..",
    "..DMMOmmmmOMMD..",
    "...DMMMMMMMMD...",
    "....DDMMMMDD....",
    "......DDDD......",
    "................",
    "................"
  ];
  c.drawAscii(0, 0, P, art);
  fs.writeFileSync(path.join(outDir, 'rocket_engine_1.png'), c.toPngBuffer());
}

// Engine 2: Dual Turbo Thrusters
{
  const c = new PixelCanvas(16, 16);
  const P = {
    '.': [0, 0, 0, 0],
    'D': hexToRgba('#0c1020'),
    'S': hexToRgba('#57606f'),
    's': hexToRgba('#2f3542'),
    'C': hexToRgba('#00d2d3'),
    'W': hexToRgba('#ffffff'),
  };
  const art = [
    "....DDDD........",
    "..DDSSSSDD......",
    ".DSSCCSSSSD.....",
    ".DSCCCCSSSSD....",
    "..DDSSSSDDDDDD..",
    "....DDDD.DDSSSS.",
    "........DSSCCSS.",
    "........DSCCCCS.",
    "........DSSCCSS.",
    "....DDDD.DDSSSS.",
    "..DDSSSSDDDDDD..",
    ".DSCCCCSSSSD....",
    ".DSSCCSSSSD.....",
    "..DDSSSSDD......",
    "....DDDD........",
    "................"
  ];
  c.drawAscii(0, 0, P, art);
  fs.writeFileSync(path.join(outDir, 'rocket_engine_2.png'), c.toPngBuffer());
}

// Engine 3: Tri-Ion Plasma Vector Thruster
{
  const c = new PixelCanvas(16, 16);
  const P = {
    '.': [0, 0, 0, 0],
    'D': hexToRgba('#050508'),
    'K': hexToRgba('#1e272e'),
    'P': hexToRgba('#ff007f'),
    'C': hexToRgba('#00f0ff'),
    'W': hexToRgba('#ffffff'),
  };
  const art = [
    "...DDD..........",
    "..DKPPDD........",
    ".DKPCCWPD.......",
    "..DKPPDDDD......",
    "...DDD.DKPPD....",
    "......DKPCCWPD..",
    ".....DKPCCWWPD..",
    ".....DKPCCWWPD..",
    "......DKPCCWPD..",
    "...DDD.DKPPD....",
    "..DKPPDDDD......",
    ".DKPCCWPD.......",
    "..DKPPDD........",
    "...DDD..........",
    "................",
    "................"
  ];
  c.drawAscii(0, 0, P, art);
  fs.writeFileSync(path.join(outDir, 'rocket_engine_3.png'), c.toPngBuffer());
}

/* =========================================================================
 * 3. ROCKET WINGS (16 x 20)
 * ========================================================================= */

// Wings 1: Classic Delta Fins
{
  const c = new PixelCanvas(16, 20);
  const P = {
    '.': [0, 0, 0, 0],
    'D': hexToRgba('#1c1926'),
    'R': hexToRgba('#e74c3c'),
    'r': hexToRgba('#c0392b'),
    'W': hexToRgba('#ecf0f1'),
  };
  const art = [
    "DD..............",
    "DRRD............",
    "DRRRD...........",
    "DRRRRD..........",
    "DWRRRRD.........",
    "DWWRRRRD........",
    "DWWWRRRRD.......",
    "DDDDDDDDDD......",
    "................",
    "................",
    "................",
    "................",
    "DDDDDDDDDD......",
    "DWWWRRRRD.......",
    "DWWRRRRD........",
    "DWRRRRD.........",
    "DRRRRD..........",
    "DRRRD...........",
    "DRRD............",
    "DD.............."
  ];
  c.drawAscii(0, 0, P, art);
  fs.writeFileSync(path.join(outDir, 'rocket_wings_1.png'), c.toPngBuffer());
}

// Wings 2: Swept Titanium Wings with Nav Light
{
  const c = new PixelCanvas(16, 20);
  const P = {
    '.': [0, 0, 0, 0],
    'D': hexToRgba('#0c1022'),
    'S': hexToRgba('#7f8c8d'),
    's': hexToRgba('#34495e'),
    'C': hexToRgba('#00d2d3'),
    'L': hexToRgba('#2ecc71'), // Green nav light
  };
  const art = [
    "DDL.............",
    "DSSDD...........",
    "DSSSSD..........",
    ".DSSSSDD........",
    ".DSSSSSSDD......",
    "..DSSSSSSSDD....",
    "..DSSCCCCSSDD...",
    "...DDDDDDDDDD...",
    "................",
    "................",
    "................",
    "................",
    "...DDDDDDDDDD...",
    "..DSSCCCCSSDD...",
    "..DSSSSSSSDD....",
    ".DSSSSSSDD......",
    ".DSSSSDD........",
    "DSSSSD..........",
    "DSSDD...........",
    "DDL............."
  ];
  c.drawAscii(0, 0, P, art);
  fs.writeFileSync(path.join(outDir, 'rocket_wings_2.png'), c.toPngBuffer());
}

// Wings 3: Advanced Cyber Wings with Cyan Edge Glow
{
  const c = new PixelCanvas(16, 20);
  const P = {
    '.': [0, 0, 0, 0],
    'D': hexToRgba('#050508'),
    'K': hexToRgba('#1f1f2e'),
    'C': hexToRgba('#00f0ff'),
    'M': hexToRgba('#ff007f'),
  };
  const art = [
    "DCC.............",
    "DKKCCD..........",
    "DKKKKCCD........",
    ".DKKKKKCCD......",
    ".DKKKMMKKCCD....",
    "..DKKKMMKKKCCD..",
    "..DKKKKKKKKKCCD.",
    "...DDDDDDDDDDDD.",
    "................",
    "................",
    "................",
    "................",
    "...DDDDDDDDDDDD.",
    "..DKKKKKKKKKCCD.",
    "..DKKKMMKKKCCD..",
    ".DKKKMMKKCCD....",
    ".DKKKKKCCD......",
    "DKKKKCCD........",
    "DKKCCD..........",
    "DCC............."
  ];
  c.drawAscii(0, 0, P, art);
  fs.writeFileSync(path.join(outDir, 'rocket_wings_3.png'), c.toPngBuffer());
}

/* =========================================================================
 * 4. ROCKET BOOST TANKS (16 x 16)
 * ========================================================================= */

// Tank 1: Small Auxiliary Pod
{
  const c = new PixelCanvas(16, 16);
  const P = {
    '.': [0, 0, 0, 0],
    'D': hexToRgba('#1c1926'),
    'S': hexToRgba('#95a5a6'),
    's': hexToRgba('#7f8c8d'),
    'O': hexToRgba('#e67e22'),
  };
  const art = [
    "....DDDDDD......",
    "...DSSSSsODD....",
    "..DSSSSsOOsOD...",
    "..DSSSSsOOsOD...",
    "...DSSSSsODD....",
    "....DDDDDD......",
    "................",
    "................",
    "................",
    "................",
    "....DDDDDD......",
    "...DSSSSsODD....",
    "..DSSSSsOOsOD...",
    "..DSSSSsOOsOD...",
    "...DSSSSsODD....",
    "....DDDDDD......"
  ];
  c.drawAscii(0, 0, P, art);
  fs.writeFileSync(path.join(outDir, 'rocket_tank_1.png'), c.toPngBuffer());
}

// Tank 2: Heavy Nitro Cannisters
{
  const c = new PixelCanvas(16, 16);
  const P = {
    '.': [0, 0, 0, 0],
    'D': hexToRgba('#0c1022'),
    'N': hexToRgba('#00a8ff'),
    'n': hexToRgba('#0077b6'),
    'W': hexToRgba('#ffffff'),
    'H': hexToRgba('#f1c40f'),
  };
  const art = [
    "...DDDDDDDD.....",
    "..DNNNWNNNHH....",
    ".DNNNNWNNNHHD...",
    ".DNNNNWNNNHHD...",
    "..DNNNWNNNHH....",
    "...DDDDDDDD.....",
    "................",
    "................",
    "................",
    "................",
    "...DDDDDDDD.....",
    "..DNNNWNNNHH....",
    ".DNNNNWNNNHHD...",
    ".DNNNNWNNNHHD...",
    "..DNNNWNNNHH....",
    "...DDDDDDDD....."
  ];
  c.drawAscii(0, 0, P, art);
  fs.writeFileSync(path.join(outDir, 'rocket_tank_2.png'), c.toPngBuffer());
}

// Tank 3: Cyber Overcharge Core
{
  const c = new PixelCanvas(16, 16);
  const P = {
    '.': [0, 0, 0, 0],
    'D': hexToRgba('#050508'),
    'K': hexToRgba('#12121c'),
    'C': hexToRgba('#00f0ff'),
    'M': hexToRgba('#ff007f'),
    'W': hexToRgba('#ffffff'),
  };
  const art = [
    "..DDDDDDDDDD....",
    ".DKCCMMWWMMCK...",
    "DKCCCCMMMMCCCCD.",
    "DKCCCCMMMMCCCCD.",
    ".DKCCMMWWMMCK...",
    "..DDDDDDDDDD....",
    "................",
    "................",
    "................",
    "................",
    "..DDDDDDDDDD....",
    ".DKCCMMWWMMCK...",
    "DKCCCCMMMMCCCCD.",
    "DKCCCCMMMMCCCCD.",
    ".DKCCMMWWMMCK...",
    "..DDDDDDDDDD...."
  ];
  c.drawAscii(0, 0, P, art);
  fs.writeFileSync(path.join(outDir, 'rocket_tank_3.png'), c.toPngBuffer());
}

/* =========================================================================
 * 5. THRUSTER FLAMES (16 x 12 idle, 24 x 16 boost)
 * ========================================================================= */

// Flame Idle (16x12)
{
  const c = new PixelCanvas(16, 12);
  const P = {
    '.': [0, 0, 0, 0],
    'R': hexToRgba('#e74c3c'),
    'O': hexToRgba('#e67e22'),
    'Y': hexToRgba('#f1c40f'),
    'W': hexToRgba('#ffffff'),
  };
  const art = [
    "................",
    "................",
    ".....RRRR.......",
    "..RRROOOORR.....",
    ".ROOOYYYYOOOR...",
    "ROOYYYYYYYYOOW..",
    "ROOYYYYYYYYOOW..",
    ".ROOOYYYYOOOR...",
    "..RRROOOORR.....",
    ".....RRRR.......",
    "................",
    "................"
  ];
  c.drawAscii(0, 0, P, art);
  fs.writeFileSync(path.join(outDir, 'flame_idle.png'), c.toPngBuffer());
}

// Flame Boost (24x16)
{
  const c = new PixelCanvas(24, 16);
  const P = {
    '.': [0, 0, 0, 0],
    'D': hexToRgba('#0984e3'),
    'B': hexToRgba('#00a8ff'),
    'C': hexToRgba('#00f0ff'),
    'W': hexToRgba('#ffffff'),
  };
  const art = [
    "........................",
    ".........DDDDDD.........",
    "......DDBBBBBBBBDD......",
    "....DDBBCCCCCCCCBBDD....",
    "...DBBCCCCWWWWCCCCBBD...",
    "..DBCCCWWWWWWWWCCCCBWW..",
    ".DBCCWWWWWWWWWWWWCCBWW..",
    "DBCCWWWWWWWWWWWWWWCBWW..",
    "DBCCWWWWWWWWWWWWWWCBWW..",
    ".DBCCWWWWWWWWWWWWCCBWW..",
    "..DBCCCWWWWWWWWCCCCBWW..",
    "...DBBCCCCWWWWCCCCBBD...",
    "....DDBBCCCCCCCCBBDD....",
    "......DDBBBBBBBBDD......",
    ".........DDDDDD.........",
    "........................"
  ];
  c.drawAscii(0, 0, P, art);
  fs.writeFileSync(path.join(outDir, 'flame_boost.png'), c.toPngBuffer());
}

/* =========================================================================
 * 6. COLLECTIBLES (16 x 16)
 * ========================================================================= */

// Gear / Factory Part (16x16)
{
  const c = new PixelCanvas(16, 16);
  const P = {
    '.': [0, 0, 0, 0],
    'D': hexToRgba('#573b08'),
    'G': hexToRgba('#f1c40f'),
    'Y': hexToRgba('#f9ca24'),
    'W': hexToRgba('#fff2cc'),
    'd': hexToRgba('#b78103'),
  };
  const art = [
    ".....DD..DD.....",
    "....DYYDDYYD....",
    "..DDDYYYYYYDDD..",
    "..DYYWYYYYYYYD..",
    ".DDYYYY..YYYYDD.",
    ".DYYW......YYYD.",
    ".DYY........YYD.",
    "DDYY........YYDD",
    "DDYY........YYDD",
    ".DYY........YYD.",
    ".DYYD......DYYD.",
    ".DDYYDD..DDYYDD.",
    "..DYYYYYYddYYD..",
    "..DDDYYYYYYDDD..",
    "....DYYddYYD....",
    ".....DD..DD....."
  ];
  c.drawAscii(0, 0, P, art);
  fs.writeFileSync(path.join(outDir, 'pickup_gear.png'), c.toPngBuffer());
}

// Energy Crystal / Fuel (16x16)
{
  const c = new PixelCanvas(16, 16);
  const P = {
    '.': [0, 0, 0, 0],
    'D': hexToRgba('#053947'),
    'C': hexToRgba('#00d2d3'),
    'c': hexToRgba('#01a3a4'),
    'W': hexToRgba('#ffffff'),
    'A': hexToRgba('#e0f8ff'),
  };
  const art = [
    ".......DD.......",
    "......DCCDD.....",
    ".....DCWCCDD....",
    "....DCWWCCCCD...",
    "...DCWCCCCccD...",
    "..DCWWCCCCcccD..",
    ".DCWCCCCCCcccD..",
    "DCWWCCCCCCCcccD.",
    ".DCWCCCCCCCcccD.",
    "..DCWCCCCCcccD..",
    "...DCWCCCcccD...",
    "....DCWCcCD.....",
    ".....DCWCD......",
    "......DCD.......",
    ".......D........",
    "................"
  ];
  c.drawAscii(0, 0, P, art);
  fs.writeFileSync(path.join(outDir, 'pickup_crystal.png'), c.toPngBuffer());
}

// Repair / Hull Nanite (16x16)
{
  const c = new PixelCanvas(16, 16);
  const P = {
    '.': [0, 0, 0, 0],
    'D': hexToRgba('#144023'),
    'G': hexToRgba('#2ecc71'),
    'g': hexToRgba('#27ae60'),
    'W': hexToRgba('#ffffff'),
  };
  const art = [
    ".....DDDDDD.....",
    "...DDGGGGGGDD...",
    "..DGGGGGGGGGGd..",
    ".DGGGGWWGGGGGgd.",
    ".DGGGGWWGGGGGgd.",
    "DGGWWWWWWWWGGggD",
    "DGGWWWWWWWWGGggD",
    "DGGGGWWGGGGGGggD",
    "DGGGGWWGGGGGGggD",
    "DGGGGWWGGGGGGggD",
    ".DGGGGWWGGGGGgd.",
    ".DGGGGWWGGGGGgd.",
    "..DGGGGGGGGGGd..",
    "...DDGGGGGGDD...",
    ".....DDDDDD.....",
    "................"
  ];
  c.drawAscii(0, 0, P, art);
  fs.writeFileSync(path.join(outDir, 'pickup_repair.png'), c.toPngBuffer());
}

/* =========================================================================
 * 7. OBSTACLES (24 x 24)
 * ========================================================================= */

// Asteroid (24x24)
{
  const c = new PixelCanvas(24, 24);
  const P = {
    '.': [0, 0, 0, 0],
    'D': hexToRgba('#1e1f26'),
    'G': hexToRgba('#7f8c8d'),
    'L': hexToRgba('#95a5a6'),
    'W': hexToRgba('#bdc3c7'),
    's': hexToRgba('#34495e'),
    'k': hexToRgba('#2c3e50'),
  };
  const art = [
    "..........DDDD..........",
    "........DDLWWLDD........",
    "......DDLWWWWWWLDD......",
    "....DDLWWWWWWWWWWLDD....",
    "...DLWWWWssWWWWWWWWLD...",
    "..DLWWWWskkssWWWWWWWLD..",
    ".DLWWWWskkkksWWWWWWWWLD.",
    ".DLWWWWskkkksWWWssWWWWLD",
    "DLWWWWWWssksWWWskkssWWLD",
    "DLGWWWWWWWWWWWWskkkksWLD",
    "DLGGWWWWWWWWWWWWskkssWLD",
    "DLGGGWWWWWWWWWWWWssWWGGD",
    "DLGGGGWWWWWWssWWWWWWGGGD",
    "DLGGGGGWWWWskkssWWWWGGGD",
    ".DLGGGGGWWWskkkksWWWGGGD",
    ".DLGGGGGGWWWssksWWWGGGGD",
    "..DLGGGGGGGGWWWWWWGGGGD.",
    "...DLGGGGGsssssGGGGGGGD.",
    "....DDLGGskkkksGGGGDDD..",
    "......DDGskkkksGGDDD....",
    "........DDsssssDDD......",
    "..........DDDDDD........",
    "........................",
    "........................"
  ];
  c.drawAscii(0, 0, P, art);
  fs.writeFileSync(path.join(outDir, 'obstacle_asteroid.png'), c.toPngBuffer());
}

// Sentinel Drone (24x24)
{
  const c = new PixelCanvas(24, 24);
  const P = {
    '.': [0, 0, 0, 0],
    'D': hexToRgba('#0c1020'),
    'S': hexToRgba('#57606f'),
    's': hexToRgba('#2f3542'),
    'R': hexToRgba('#ff4757'), // Glowing red core eye
    'r': hexToRgba('#c23616'),
    'W': hexToRgba('#ffffff'),
    'A': hexToRgba('#ffa502'), // Warning antenna
  };
  const art = [
    "...........AA...........",
    "...........AA...........",
    "...........AA...........",
    ".........DDssDD.........",
    ".......DDSSSSSSDD.......",
    "......DSSSSSSSSSSDD.....",
    "....DDSSssssssssSSDD....",
    "...DSSssRRRRRRRRssSSD...",
    "..DSSssRRRRRRRRRRssSSD..",
    "..DSSsRRRRWWWWWRRRsSSD..",
    ".DSSsRRRRWWWWWWWRRsSSSD.",
    ".DSSsRRRRWWWWWWWRRsSSSD.",
    ".DSSsRRRRWWWWWWWRRsSSSD.",
    "..DSSsRRRRWWWWWRRRsSSD..",
    "..DSSssRRRRRRRRRRssSSD..",
    "...DSSssRRRRRRRRssSSD...",
    "....DDSSssssssssSSDD....",
    "......DSSSSSSSSSSDD.....",
    ".......DDSSSSSSDD.......",
    ".........DDssDD.........",
    "........DD....DD........",
    ".......D........D.......",
    "........................",
    "........................"
  ];
  c.drawAscii(0, 0, P, art);
  fs.writeFileSync(path.join(outDir, 'obstacle_drone.png'), c.toPngBuffer());
}

// Satellite Scrap / Space Debris (24x24)
{
  const c = new PixelCanvas(24, 24);
  const P = {
    '.': [0, 0, 0, 0],
    'D': hexToRgba('#181924'),
    'B': hexToRgba('#0984e3'),
    'b': hexToRgba('#0652dd'),
    'M': hexToRgba('#747d8c'),
    'm': hexToRgba('#2f3542'),
    'W': hexToRgba('#dfe4ea'),
    'Y': hexToRgba('#eccc68'), // Exposed spark wires
  };
  const art = [
    "....DDDD................",
    "...DBBBBDD..............",
    "..DBWWBBBDD.............",
    ".DBBBBBBBBDD......YY....",
    ".DBWWBBBBBDD.....YY.....",
    "..DBBBBBBDD.....YY......",
    "...DBBBBDD....DDmDD.....",
    "....DDDD.....DMMMMMD....",
    "............DMMWWMMMD...",
    "...........DMMMMMMMMMD..",
    "..........DDmmmmmmmmmDD.",
    ".........DMMMMMMMMMMMMMD",
    "........DMMMMMMWWMMMMMMD",
    ".........DMMMMMMMMMMMMMD",
    "..........DDmmmmmmmmmDD.",
    "...........DMMMMMMMMMD..",
    "............DMMWWMMMD...",
    ".....YY......DMMMMMD....",
    "......YY......DDmDD.....",
    ".......YY....DBBBBDD....",
    "............DBBBBBBDD...",
    "...........DBWWBBBBBDD..",
    "..........DBBBBBBBBDD...",
    "...........DBBBBDD......"
  ];
  c.drawAscii(0, 0, P, art);
  fs.writeFileSync(path.join(outDir, 'obstacle_debris.png'), c.toPngBuffer());
}

/* =========================================================================
 * 8. LAUNCH PAD GANTRY (48 x 48)
 * ========================================================================= */
{
  const c = new PixelCanvas(48, 48);
  const P = {
    '.': [0, 0, 0, 0],
    'D': hexToRgba('#10141f'),
    'S': hexToRgba('#57606f'),
    's': hexToRgba('#2f3542'),
    'Y': hexToRgba('#f1c40f'), // Yellow hazard crane
    'y': hexToRgba('#b78103'),
    'R': hexToRgba('#ff4757'), // Beacon light
    'W': hexToRgba('#ffffff'),
  };

  // Draw gantry tower on left, base ramp on bottom
  for (let y = 0; y < 48; y++) {
    for (let x = 0; x < 48; x++) {
      // Base pad
      if (y >= 42) {
        if ((x + y) % 6 < 3) c.setPixel(x, y, P['Y']);
        else c.setPixel(x, y, P['s']);
      } else if (y >= 38) {
        c.setPixel(x, y, P['s']);
      }
      // Left vertical support tower (x: 2 to 14)
      if (x >= 2 && x <= 12 && y >= 4 && y < 38) {
        if (x === 2 || x === 12 || y === 4 || y % 8 === 0 || (x + y) % 8 === 0 || (x - y) % 8 === 0) {
          c.setPixel(x, y, P['Y']);
        } else {
          c.setPixel(x, y, P['s']);
        }
      }
      // Top crane arm extending right (y: 4 to 8, x: 12 to 34)
      if (y >= 4 && y <= 8 && x >= 12 && x <= 34) {
        if (y === 4 || y === 8 || x === 34 || (x + y) % 4 === 0) {
          c.setPixel(x, y, P['Y']);
        } else {
          c.setPixel(x, y, P['y']);
        }
      }
      // Fuel cable umbilical (x: 32, y: 8 to 22)
      if (x === 32 && y >= 8 && y <= 22) {
        c.setPixel(x, y, P['s']);
      }
      // Red warning beacon at top of tower (x: 6 to 8, y: 1 to 3)
      if (x >= 6 && x <= 8 && y >= 1 && y <= 3) {
        c.setPixel(x, y, P['R']);
      }
    }
  }
  fs.writeFileSync(path.join(outDir, 'launch_pad.png'), c.toPngBuffer());
}

/* =========================================================================
 * 9. ENVIRONMENT SPRITES (Clouds, Mountains, Stars)
 * ========================================================================= */

// Cloud Pixel (48x24)
{
  const c = new PixelCanvas(48, 24);
  const P = {
    '.': [0, 0, 0, 0],
    'W': hexToRgba('#ffffff', 180),
    'S': hexToRgba('#dfe4ea', 160),
    's': hexToRgba('#ced6e0', 140),
  };
  // Semi-transparent fluffy pixel cloud
  for (let y = 0; y < 24; y++) {
    for (let x = 0; x < 48; x++) {
      const dx1 = (x - 16) / 12, dy1 = (y - 14) / 7;
      const dx2 = (x - 28) / 14, dy2 = (y - 12) / 9;
      const dx3 = (x - 38) / 10, dy3 = (y - 15) / 6;
      const d1 = dx1 * dx1 + dy1 * dy1;
      const d2 = dx2 * dx2 + dy2 * dy2;
      const d3 = dx3 * dx3 + dy3 * dy3;
      if (d1 <= 1 || d2 <= 1 || d3 <= 1) {
        if (y < 12) c.setPixel(x, y, P['W']);
        else if (y < 17) c.setPixel(x, y, P['S']);
        else c.setPixel(x, y, P['s']);
      }
    }
  }
  fs.writeFileSync(path.join(outDir, 'cloud_pixel.png'), c.toPngBuffer());
}

// Mountain Silhouette (64x32)
{
  const c = new PixelCanvas(64, 32);
  const col1 = hexToRgba('#131a33');
  const col2 = hexToRgba('#1a2344');
  for (let x = 0; x < 64; x++) {
    // Two peaks
    const h1 = Math.max(0, 26 - Math.abs(x - 22) * 1.2);
    const h2 = Math.max(0, 20 - Math.abs(x - 48) * 1.0);
    const peakH = Math.max(h1, h2);
    const startY = Math.round(32 - peakH);
    for (let y = startY; y < 32; y++) {
      c.setPixel(x, y, x > 35 ? col2 : col1);
    }
  }
  fs.writeFileSync(path.join(outDir, 'mountain_pixel.png'), c.toPngBuffer());
}

// Star Pixel (8x8)
{
  const c = new PixelCanvas(8, 8);
  const W = hexToRgba('#ffffff');
  const Y = hexToRgba('#f1c40f');
  c.setPixel(3, 1, Y);
  c.setPixel(4, 1, Y);
  c.setPixel(3, 6, Y);
  c.setPixel(4, 6, Y);
  c.setPixel(1, 3, Y);
  c.setPixel(1, 4, Y);
  c.setPixel(6, 3, Y);
  c.setPixel(6, 4, Y);
  c.fillRect(2, 2, 4, 4, W);
  fs.writeFileSync(path.join(outDir, 'star_pixel.png'), c.toPngBuffer());
}

console.log('All pixel art raster PNG sprites created successfully!');
