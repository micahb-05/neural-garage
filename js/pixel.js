/* pixel.js — pixel-art toolkit: 3x5 bitmap font, color helpers, seeded rng, and the
   string-art robot sprites (recolored per model accent and cached to offscreen canvases). */
'use strict';
(function (NG) {
  // 3x5 glyphs, row-major, 15 bits each
  const FONT = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
    E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
    I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
    M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
    Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
    U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
    Y: '101101010010010', Z: '111001010100111',
    0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
    4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010',
    8: '111101111101111', 9: '111101111001110',
    '$': '011110010011110', '.': '000000000000010', ',': '000000000010100', ':': '000010000010000',
    '/': '001001010100100', '+': '000010111010000', '-': '000000111000000', '%': '101001010100101',
    '!': '010010010000010', '?': '110001010000010', '^': '010101000000000', '#': '101111101111101',
    '>': '100010001010100', '<': '001010100010001', '=': '000111000111000', '|': '010010010010010',
    '_': '000000000000111', "'": '010010000000000', '(': '010100100100010', ')': '010001001001010',
    ' ': '000000000000000'
  };

  const textCache = new Map();
  const textW = str => Math.max(0, String(str).length * 4 - 1);

  function textCanvas(str, color) {
    const key = color + '|' + str;
    let c = textCache.get(key);
    if (c) return c;
    if (textCache.size > 800) textCache.clear();
    c = document.createElement('canvas');
    c.width = Math.max(1, textW(str));
    c.height = 5;
    const g = c.getContext('2d');
    g.fillStyle = color;
    for (let i = 0; i < str.length; i++) {
      const gl = FONT[str[i]] || FONT['?'];
      for (let p = 0; p < 15; p++) if (gl[p] === '1') g.fillRect(i * 4 + (p % 3), (p / 3) | 0, 1, 1);
    }
    textCache.set(key, c);
    return c;
  }

  function text(ctx, str, x, y, color, opt) {
    opt = opt || {};
    str = String(str).toUpperCase();
    if (!str) return 0;
    const w = textW(str);
    let dx = x;
    if (opt.align === 'center') dx = x - Math.floor(w / 2);
    else if (opt.align === 'right') dx = x - w;
    dx = Math.round(dx); y = Math.round(y);
    if (opt.shadow) ctx.drawImage(textCanvas(str, opt.shadow), dx + 1, y + 1);
    ctx.drawImage(textCanvas(str, color), dx, y);
    return w;
  }

  function hexToRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  // lighten (a > 0) or darken (a < 0) a hex color
  function shade(h, a) {
    const f = v => Math.round(a >= 0 ? v + (255 - v) * a : v * (1 + a));
    const [r, g, b] = hexToRgb(h);
    return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')';
  }
  function rgba(h, a) {
    const [r, g, b] = hexToRgb(h);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hash = n => (Math.imul(n | 0, 2654435761) >>> 0) % 1000;

  /* Robot sprites. o outline, b accent, B accent-light, d accent-dark, g/G metal, k dark metal,
     e eyes, c chest core, w white. Tier 1 = hover drone, tier 2 = bot, tier 3+ = android/mech. */
  const SPRITES = {
    drone: [
      '....oooo....',
      '..oobBBboo..',
      '.obBBbbbbbo.',
      'obkeekkeekbo',
      'obkkkkkkkkbo',
      '.obbbbbbbdo.',
      '..oddddddo..',
      '...og..go...',
      '....g..g....'
    ],
    bot: [
      '...oooooo...',
      '..obBBBbbo..',
      '..oeekkeeo..',
      '..obbbbbdo..',
      '...oddddo...',
      '.oooggggooo.',
      'obBbbbbbbbdo',
      'obBbbccbbbdo',
      'obBbbccbbbdo',
      'okobbbbbbdok',
      'ok.obbbbdo.k',
      'og.oddddo.go',
      '...okkkko...',
      '...ok..ko...',
      '...ok..ko...',
      '..okk..kko..',
      '..ooo..ooo..'
    ],
    mech: [
      '.....oooo.....',
      '....obBBbo....',
      '...obeeeebo...',
      '...obbbbbdo...',
      '....oddddo....',
      '.ooooggggoooo.',
      'obBBbbbbbbbddo',
      'obBbbbccbbbbdo',
      'obbobbccbbobdo',
      'okoobbbbbbdook',
      'ok.obbbbbbdo.k',
      'ok.obbbbbbdo.k',
      'oG.oddddddo.Go',
      'oo.okkkkkko.oo',
      '...okk..kko...',
      '...okk..kko...',
      '...okk..kko...',
      '..oGGk..kGGo..',
      '..oooo..oooo..'
    ],
    // PIP, Repair Unit 7: round rusty body, one big eye, little treads
    pip: [
      '....G.....',
      '....o.....',
      '..oooooo..',
      '.obBBbbbo.',
      'obBwwwwbdo',
      'obwwkkwwdo',
      'obwwkkwwdo',
      'obBwwwwbdo',
      '.obbbbbdo.',
      '..oddddo..',
      '.okkkkkko.',
      '.okGkGkGo.',
      '..oooooo..'
    ]
  };
  const spriteKind = tier => tier <= 1 ? 'drone' : tier === 2 ? 'bot' : 'mech';
  // first leg row per walking sprite; walk poses lift one leg by shifting that half up a row
  const LEG_START = { bot: 13, mech: 14 };

  const spriteCache = new Map();
  function sprite(kind, accent, blink, pose) {
    pose = pose || 0;
    const key = kind + accent + (blink ? 1 : 0) + pose;
    let c = spriteCache.get(key);
    if (c) return c;
    let rows = SPRITES[kind];
    const ls = LEG_START[kind];
    if (pose && ls != null) {
      const src = rows, h = src.length, w = src[0].length, half = w >> 1;
      rows = src.map((row, r) => row.split('').map((ch, col) => {
        const lifted = pose === 1 ? col < half : col >= half;
        if (r < ls || !lifted) return ch;
        return r + 1 < h ? src[r + 1][col] : '.';
      }).join(''));
    }
    const pal = {
      o: '#0b0d12', b: accent, B: shade(accent, 0.4), d: shade(accent, -0.45),
      g: '#8a93a6', G: '#c3cad8', k: '#3a4150', e: blink ? '#3a4150' : '#e4fdff',
      c: '#7fe9ff', w: '#ffffff'
    };
    if (kind === 'pip') { pal.k = '#10141b'; if (blink) { pal.w = shade(accent, -0.2); pal.k = shade(accent, -0.5); } }
    c = document.createElement('canvas');
    c.width = rows[0].length; c.height = rows.length;
    const g = c.getContext('2d');
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const col = pal[row[x]];
        if (!col) continue;
        g.fillStyle = col;
        g.fillRect(x, y, 1, 1);
      }
    });
    spriteCache.set(key, c);
    return c;
  }

  const urlCache = new Map();
  function spriteURL(kind, accent, scale) {
    const k = scale || 3;
    const key = kind + accent + k;
    if (urlCache.has(key)) return urlCache.get(key);
    const src = sprite(kind, accent, false);
    const c = document.createElement('canvas');
    c.width = src.width * k; c.height = src.height * k;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(src, 0, 0, c.width, c.height);
    const url = c.toDataURL();
    urlCache.set(key, url);
    return url;
  }

  NG.px = { text, textW, shade, rgba, hexToRgb, mulberry32, hash, sprite, spriteURL, spriteKind, SPRITES };
})(window.NG);
