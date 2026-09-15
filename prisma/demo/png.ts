import { deflateSync } from "node:zlib";

/**
 * A tiny PNG writer, for the demo seed's placeholder photographs.
 *
 * Written by hand rather than adding an image dependency, for the
 * reason in AGENTS.md: the runtime dependency list is deliberately
 * short, and this is sixty lines of well-specified format that runs
 * once, in a seed script, and never ships to a browser.
 *
 * What it draws is deliberately ILLUSTRATIVE and obviously not a
 * photograph — a flat silhouette on a warm ground. A demo must never
 * show something a judge could mistake for a real family's picture,
 * and an abstract figure also makes it visually obvious at a glance
 * that this is seeded data.
 */

const SIZE = 480;

/** CRC-32, as the PNG spec defines it. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

export type RGB = [number, number, number];

/** Encode raw RGB pixels as an 8-bit truecolour PNG. */
function encodePng(pixels: Uint8Array, size: number): Buffer {
  // Each scanline is prefixed with a filter byte; 0 means "none",
  // which costs a little size and saves a great deal of code.
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 3 + 1);
    raw[rowStart] = 0;
    pixels.subarray(y * size * 3, (y + 1) * size * 3).forEach((value, i) => {
      raw[rowStart + 1 + i] = value;
    });
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    // Declare sRGB, and the matching gamma beside it as the spec
    // recommends. Without these a browser has to guess at the colour
    // space, and on a wide-gamut display it guesses differently from
    // the CSS around the image — which is why the first version of
    // these illustrations rendered a warm cream ground as flat grey.
    chunk("sRGB", Buffer.from([0])), // perceptual rendering intent
    chunk("gAMA", (() => {
      const g = Buffer.alloc(4);
      g.writeUInt32BE(45455); // 1/2.2, the sRGB companion value
      return g;
    })()),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

interface Canvas {
  set: (x: number, y: number, colour: RGB) => void;
  pixels: Uint8Array;
}

function canvas(size: number, top: RGB, bottom: RGB): Canvas {
  const pixels = new Uint8Array(size * size * 3);
  for (let y = 0; y < size; y++) {
    const ground = mix(top, bottom, y / (size - 1));
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 3;
      pixels[i] = ground[0];
      pixels[i + 1] = ground[1];
      pixels[i + 2] = ground[2];
    }
  }
  return {
    pixels,
    set(x, y, colour) {
      // Coordinates are FLOORED, not trusted to be integers. Every
      // shape here is positioned as a fraction of the canvas, so they
      // arrive fractional — and a fractional index into a typed array
      // is a silent no-op, which is exactly how the first version of
      // this file produced six perfectly valid, perfectly blank
      // gradients.
      const px = Math.floor(x);
      const py = Math.floor(y);
      if (px < 0 || py < 0 || px >= size || py >= size) return;
      const i = (py * size + px) * 3;
      pixels[i] = colour[0];
      pixels[i + 1] = colour[1];
      pixels[i + 2] = colour[2];
    },
  };
}

function fillCircle(c: Canvas, cx: number, cy: number, r: number, colour: RGB) {
  const top = Math.floor(cy - r);
  const bottom = Math.ceil(cy + r);
  const left = Math.floor(cx - r);
  const right = Math.ceil(cx + r);

  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r * r) c.set(x, y, colour);
    }
  }
}

/** A head-and-shoulders silhouette, for a PERSON memory. */
export function personPng(top: RGB, bottom: RGB, figure: RGB): Buffer {
  const c = canvas(SIZE, top, bottom);
  const cx = SIZE / 2;

  // Shoulders: a wide circle clipped by the bottom of the frame.
  fillCircle(c, cx, SIZE * 0.95, SIZE * 0.34, figure);
  // Head.
  fillCircle(c, cx, SIZE * 0.4, SIZE * 0.16, figure);

  return encodePng(c.pixels, SIZE);
}

/** Hills under a sky, for a PLACE memory. */
export function placePng(sky: RGB, ground: RGB, hills: RGB): Buffer {
  const c = canvas(SIZE, sky, ground);

  for (let x = 0; x < SIZE; x++) {
    // Two overlapping sine ridges — the tea-garden hills, flattened.
    const back = SIZE * 0.55 + Math.sin((x / SIZE) * Math.PI * 1.6) * SIZE * 0.07;
    const front = SIZE * 0.68 + Math.sin((x / SIZE) * Math.PI * 2.6 + 1.2) * SIZE * 0.05;
    for (let y = Math.round(back); y < SIZE; y++) {
      c.set(x, y, y < front ? mix(hills, ground, 0.35) : hills);
    }
  }

  // A low sun, well clear of the ridge line.
  fillCircle(c, SIZE * 0.72, SIZE * 0.26, SIZE * 0.07, mix(sky, [255, 255, 255], 0.55));

  return encodePng(c.pixels, SIZE);
}

/** A simple object on a table, for a THING memory. */
export function thingPng(top: RGB, bottom: RGB, object: RGB): Buffer {
  const c = canvas(SIZE, top, bottom);

  // Table edge.
  for (let y = Math.round(SIZE * 0.72); y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) c.set(x, y, mix(bottom, object, 0.25));
  }
  // A rounded vessel: a body, with a domed top.
  for (let y = Math.round(SIZE * 0.5); y < Math.round(SIZE * 0.74); y++) {
    for (let x = Math.round(SIZE * 0.36); x < Math.round(SIZE * 0.64); x++) {
      c.set(x, y, object);
    }
  }
  fillCircle(c, SIZE / 2, SIZE * 0.5, SIZE * 0.14, object);

  return encodePng(c.pixels, SIZE);
}

/** Three figures together, for a MOMENT memory. */
export function momentPng(top: RGB, bottom: RGB, figure: RGB): Buffer {
  const c = canvas(SIZE, top, bottom);

  for (const [cx, scale] of [
    [SIZE * 0.28, 0.85],
    [SIZE * 0.5, 1],
    [SIZE * 0.72, 0.85],
  ] as const) {
    fillCircle(c, cx, SIZE * 1.02, SIZE * 0.26 * scale, figure);
    fillCircle(c, cx, SIZE * 0.52, SIZE * 0.11 * scale, figure);
  }

  return encodePng(c.pixels, SIZE);
}
