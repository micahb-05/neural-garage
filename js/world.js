/* world.js — renders Calloway's garage at 512x288 native pixels, runs the walking robots,
   and handles hit-testing. Everything is drawn from rects; the only images are the cached
   text/sprite canvases. */
'use strict';
(function (NG) {
  const P = NG.px;
  const W = 512, H = 288;
  const BAY_W = 60, BAY_H = 52;
  const BAY_POS = [[12, 66], [80, 66], [12, 140], [80, 140], [372, 66], [440, 66], [372, 140], [440, 140]];
  const POD_POS = [[196, 146], [242, 146], [288, 146]];
  const POD_W = 28, POD_H = 48;
  const CONV_Y = 212;
  const PAD_X = 478;
  const CORE = { x: 256, y: 80 };

  const C = {
    cyan: '#3ee8ff', cyanD: '#1aa6c4', ice: '#7fe9ff', gold: '#ffd76a', amber: '#ffb640',
    red: '#e0343c', steel: '#4a5263', steelL: '#6a7488', steelD: '#2a303c', ink: '#0d1015',
    dim: '#5a6378', text: '#c3cad8', green: '#46f08c', violet: '#c69bff'
  };

  let ctx = null, bg = null, vignette = null;
  let hover = null;
  const fx = { particles: [], floats: [], crates: [], flashes: [] };

  function R(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  const rand = (a, b) => a + Math.random() * (b - a);
  const skillOf = job => {
    let best = null, v = -1;
    for (const k in job.skills) if (job.skills[k] > v) { v = job.skills[k]; best = k; }
    return best;
  };
  const secondSkillOf = job => {
    const ks = Object.keys(job.skills).sort((a, b) => job.skills[b] - job.skills[a]);
    return ks[1] || ks[0];
  };
  const skillColor = k => (NG.SKILL_META[k] || { color: C.cyan }).color;
  function outline(x, y, w, h, c) {
    R(x, y, w, 1, c); R(x, y + h - 1, w, 1, c); R(x, y, 1, h, c); R(x + w - 1, y, 1, h, c);
  }
  function marching(x, y, w, h, t, c) {
    const off = Math.floor(t * 10) % 4;
    for (let k = -off; k < w; k += 4) { if (k >= 0) { R(x + k, y, 2, 1, c); R(x + w - 1 - k, y + h - 1, 2, 1, c); } }
    for (let k = -off; k < h; k += 4) { if (k >= 0) { R(x + w - 1, y + k, 1, 2, c); R(x, y + h - 1 - k, 1, 2, c); } }
  }
  function glow(x, y, r, color, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, P.rgba(color, Math.max(0, a)));
    g.addColorStop(1, P.rgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function disc(cx, cy, r, col) {
    for (let dy = -r; dy <= r; dy++) {
      const hw = Math.round(Math.sqrt(r * r - dy * dy));
      R(cx - hw, cy + dy, hw * 2 + 1, 1, typeof col === 'function' ? col(dy) : col);
    }
  }

  /* ---------- baked background: floor + wall + cable runs ---------- */
  function bake() {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const r = P.mulberry32(7);
    const F = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    F(0, 56, W, H - 56, '#1a1e26');
    for (let ty = 56; ty < H; ty += 16) {
      for (let tx = 0; tx < W; tx += 16) {
        F(tx, ty, 16, 16, r() < 0.15 ? '#1c2029' : '#1a1e26');
        F(tx, ty, 16, 1, '#141821'); F(tx, ty, 1, 16, '#141821');
        F(tx + 1, ty + 1, 14, 1, '#20252f');
        for (let k = 0; k < 3; k++) F(tx + 2 + ((r() * 12) | 0), ty + 2 + ((r() * 12) | 0), 1, 1, r() < 0.5 ? '#222733' : '#171a22');
      }
    }
    // oil stains, because it used to be a real repair shop
    [[60, 134, 9], [300, 262, 7], [420, 128, 6], [210, 206, 5]].forEach(([x, y, rr]) => {
      for (let dy = -rr; dy <= rr; dy++) {
        const hw = Math.round(Math.sqrt(rr * rr - dy * dy) * 1.6);
        g.fillStyle = 'rgba(8,9,12,0.28)'; g.fillRect(x - hw, y + dy * 0.6, hw * 2, 1);
      }
    });
    F(0, 56, W, 3, '#11141a');
    // walkway markings along the lanes the robots use
    for (let x = 4; x < W; x += 10) { F(x, 130, 5, 1, '#262b20'); F(x, 204, 5, 1, '#262b20'); }
    for (let y = 60; y < 206; y += 6) { F(146, y, 1, 3, '#3a3524'); F(365, y, 1, 3, '#3a3524'); }
    // floor cable runs from the racks
    F(3, 58, 2, 150, '#0e1015'); F(3, 58, 1, 150, '#272c38');
    F(3, 206, 140, 2, '#0e1015'); F(3, 206, 140, 1, '#272c38');
    F(150, 58, 2, 60, '#0e1015'); F(150, 58, 1, 60, '#3a2a18');
    // wall
    F(0, 0, W, 56, '#232833');
    for (let x = 0; x < W; x += 32) { F(x, 4, 1, 46, '#1b1f28'); F(x + 1, 4, 1, 46, '#2b313d'); }
    F(0, 24, W, 1, '#1b1f28'); F(0, 25, W, 1, '#2b313d');
    for (let x = 4; x < W; x += 32) {
      F(x, 8, 1, 1, '#3a4150'); F(x, 44, 1, 1, '#3a4150'); F(x + 24, 8, 1, 1, '#3a4150'); F(x + 24, 44, 1, 1, '#3a4150');
    }
    F(0, 0, W, 4, '#14171d');
    for (let x = 0; x < W; x += 8) F(x, 4, 4, 1, '#0f1116');
    F(0, 50, W, 6, '#394050'); F(0, 50, W, 1, '#4d5668'); F(0, 55, W, 1, '#232833');
    bg = c;

    const v = document.createElement('canvas');
    v.width = W; v.height = H;
    const vg = v.getContext('2d');
    const grd = vg.createRadialGradient(W / 2, H / 2, 140, W / 2, H / 2, 330);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, 'rgba(0,0,0,0.5)');
    vg.fillStyle = grd;
    vg.fillRect(0, 0, W, H);
    vignette = v;
  }

  /* ---------- wall ---------- */
  function drawRacks(s, t) {
    const n = s.upgrades.rack + 1;
    const load = NG.computeUsed(s) / Math.max(1, NG.computeCap(s));
    const leds = [C.green, C.cyan, C.amber];
    for (let i = 0; i < 12; i++) {
      const x = 6 + i * 12, y = 8;
      if (i < n) {
        R(x, y, 10, 42, '#0d1015');
        R(x, y, 10, 1, C.steel); R(x, y, 1, 42, '#3a4150'); R(x + 9, y, 1, 42, C.steelD); R(x, y + 41, 10, 1, C.steelD);
        for (let u = 0; u < 6; u++) {
          const uy = y + 3 + u * 6, h = P.hash(i * 7 + u);
          R(x + 2, uy, 6, 4, '#1a1e26'); R(x + 2, uy, 6, 1, '#262b36');
          const on = Math.sin(t * (2 + load * 10 + (h % 5)) + h) > 0.2 - load;
          R(x + 3, uy + 2, 1, 1, on ? leds[h % 3] : '#1f2a2a');
          R(x + 5, uy + 2, 2, 1, Math.sin(t * 3 + h * 0.3) > 0 ? C.cyanD : '#16232a');
        }
      } else if (i === n) {
        for (let k = 0; k < 42; k += 3) { R(x, y + k, 1, 1, '#3a4150'); R(x + 9, y + k, 1, 1, '#3a4150'); }
        for (let k = 0; k < 10; k += 3) { R(x + k, y, 1, 1, '#3a4150'); R(x + k, y + 41, 1, 1, '#3a4150'); }
        P.text(ctx, '+', x + 4, y + 18, '#4a5263');
      }
    }
  }

  function tickerText(s) {
    const parts = [];
    if (NG.surging(s)) parts.push('GPU SURGE X1.5');
    for (const k in s.market) {
      const e = s.market[k];
      if (e.until <= s.time) continue;
      parts.push((e.mult > 1 ? 'DEMAND ^ ' : 'SLUMP - ') + NG.JOB_MAP[k].short + ' X' + e.mult);
    }
    if (!parts.length) parts.push('ALL SYSTEMS NOMINAL', 'REP ' + Math.floor(s.rep), NG.titleFor(s.peakRep), 'HALDEN FALLS WEATHER: DRIZZLE');
    return parts.join('  //  ');
  }

  function drawScreen(s, t) {
    const x0 = 156, y0 = 8, w = 156, h = 40;
    R(x0 - 2, y0 - 2, w + 4, h + 4, '#394050'); R(x0 - 1, y0 - 1, w + 2, h + 2, '#0b0e13');
    R(x0, y0, w, h, '#06151d');
    ctx.fillStyle = 'rgba(62,232,255,0.05)';
    for (let y = y0; y < y0 + h; y += 2) ctx.fillRect(x0, y, w, 1);
    P.text(ctx, 'WREN-OS', x0 + 3, y0 + 3, C.cyan);
    const rate = s.earnRate;
    P.text(ctx, (rate < 0 ? '-$' : '$') + NG.fmt(Math.abs(rate)) + '/S', x0 + w - 3, y0 + 3, rate < 0 ? '#ff4a52' : C.gold, { align: 'right' });
    const hist = s.netHistory.slice(-37);
    const max = Math.max(1, ...hist.map(Math.abs));
    const base = y0 + 30;
    R(x0 + 3, base, w - 6, 1, '#0f3a48');
    hist.forEach((v, i) => {
      const bx = x0 + 4 + i * 4;
      const bh = Math.round(Math.abs(v) / max * 18);
      if (v >= 0) {
        R(bx, base - bh, 3, bh, i === hist.length - 1 ? C.gold : C.cyanD);
        if (bh) R(bx, base - bh, 3, 1, C.ice);
      } else R(bx, base + 1, 3, Math.min(3, bh), '#ff4a52');
    });
    ctx.save();
    ctx.beginPath(); ctx.rect(x0 + 1, y0 + 32, w - 2, 7); ctx.clip();
    const msg = tickerText(s);
    const tw = P.textW(msg);
    const off = (t * 22) % (tw + w);
    const hot = NG.surging(s) || Object.keys(s.market).length;
    P.text(ctx, msg, x0 + w - off, y0 + 33, hot ? C.amber : '#4fb7c9');
    ctx.restore();
  }

  // breaker panel with a live oscilloscope — Wren wired the whole building herself
  function drawBreaker(t) {
    R(318, 4, 40, 48, '#394050'); R(319, 5, 38, 46, '#1b2029');
    R(322, 8, 32, 14, '#06140c'); outline(321, 7, 34, 16, '#2a303c');
    for (let gx = 0; gx < 32; gx += 8) R(322 + gx, 8, 1, 14, '#0c2414');
    R(322, 15, 32, 1, '#0c2414');
    const amp = 3 + Math.sin(t * 0.7) * 2;
    for (let x = 0; x < 32; x++) R(322 + x, 15 + Math.sin(t * 5 + x * 0.45) * amp, 1, 1, C.green);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 2; c++) {
        const sx = 325 + c * 16, sy = 26 + r * 6;
        const on = P.hash(r * 2 + c + Math.floor(t * 0.25 + r)) % 6 !== 0;
        R(sx, sy, 12, 4, '#0d1015');
        R(sx + (on ? 7 : 1), sy + 1, 4, 2, on ? '#c3cad8' : '#5a6378');
        R(sx - 2, sy + 1, 1, 2, on ? C.green : '#5a1a1a');
      }
    }
    P.text(ctx, 'HIGH VOLT', 338, 45, C.amber, { align: 'center' });
  }

  function drawDoor(t) {
    R(362, 2, 146, 52, '#394050'); R(363, 3, 144, 50, '#1b1f28');
    R(366, 44, 138, 6, '#0a1020');
    const r = P.mulberry32(3);
    for (let x = 366; x < 504; x += 5) {
      const h = 2 + ((r() * 4) | 0);
      R(x, 50 - h, 4, h, '#141c30');
      if (r() < 0.6) R(x + 1, 50 - h + 1, 1, 1, Math.sin(t * 0.7 + x) > -0.6 ? (r() < 0.5 ? '#ffd76a' : '#7fe9ff') : '#141c30');
    }
    for (let y = 6; y < 44; y += 4) {
      R(366, y, 138, 3, '#2c323e'); R(366, y, 138, 1, '#363d4b'); R(366, y + 3, 138, 1, '#1c2029');
    }
    // the old hand-painted sign
    R(398, 15, 74, 13, '#2a2418');
    outline(398, 15, 74, 13, '#5a4a2a');
    P.text(ctx, 'CALLOWAY', 435, 17, '#d9a65a', { align: 'center' });
    P.text(ctx, 'REPAIR', 435, 23, '#a07a44', { align: 'center' });
    for (let x = 364; x < 506; x += 8) { R(x, 50, 4, 3, C.amber); R(x + 4, 50, 4, 3, '#16181c'); }
  }

  /* ---------- floor décor (upper half) ---------- */
  function drawWhiteboard() {
    R(158, 104, 2, 14, '#3a4150'); R(186, 104, 2, 14, '#3a4150');
    R(155, 117, 6, 2, '#10141b'); R(183, 117, 6, 2, '#10141b');
    R(154, 70, 38, 35, '#8a93a6'); R(155, 71, 36, 32, '#e4e8ee');
    R(158, 74, 14, 1, '#2a4a8a'); R(158, 77, 22, 1, '#2a4a8a'); R(158, 80, 10, 1, '#2a4a8a');
    outline(159, 84, 8, 6, '#2a4a8a'); R(168, 87, 6, 1, '#c8202c'); R(173, 86, 1, 3, '#c8202c');
    outline(176, 84, 8, 6, '#2a4a8a');
    P.text(ctx, 'LANTERN?', 173, 94, '#c8202c', { align: 'center' });
    R(184, 72, 5, 5, C.gold); R(184, 72, 5, 1, '#f7e7a0');
    R(155, 103, 36, 1, '#6a7488'); R(160, 102, 4, 1, '#c8202c'); R(166, 102, 4, 1, '#2a4a8a');
  }

  function drawCoolant(t) {
    R(334, 56, 4, 12, '#394050'); R(335, 56, 1, 12, '#4d5668');
    R(322, 68, 28, 44, C.steelD); R(322, 68, 28, 3, C.steel); R(322, 108, 28, 4, C.steel);
    R(327, 74, 18, 30, '#0a1c22');
    const lvl = 78 + Math.sin(t * 0.8) * 1.5;
    ctx.fillStyle = 'rgba(62,232,255,0.35)'; ctx.fillRect(327, lvl, 18, 104 - lvl);
    R(327, Math.round(lvl), 18, 1, C.ice);
    for (let k = 0; k < 6; k++) {
      const h = P.hash(k + 40);
      const by = 103 - ((t * (6 + h % 6) + h) % (104 - lvl));
      R(329 + (h % 14), by, 1, 1, '#bff8ff');
    }
    R(320, 112, 32, 6, '#1d222b');
    R(346, 96, 6, 6, '#0d1015'); R(348, 98, 2, 1, C.green);
  }

  function drawFan(t) {
    R(175, 166, 2, 10, '#3a4150'); R(168, 175, 16, 2, C.steelD);
    for (let a = 0; a < Math.PI * 2; a += 0.2) R(176 + Math.cos(a) * 9, 157 + Math.sin(a) * 9, 1, 1, '#6a7488');
    for (let k = 0; k < 3; k++) {
      const a = t * 11 + k * 2.09;
      for (let rr = 2; rr < 8; rr++) R(176 + Math.cos(a) * rr, 157 + Math.sin(a) * rr, 1, 1, '#c3cad8');
    }
    R(175, 156, 3, 3, C.red);
  }

  function drawGearPile() {
    const box = (x, y, w, h, col, lab) => {
      R(x, y, w, h, col); R(x, y, w, 1, P.shade(col, 0.25)); R(x, y + h - 1, w, 1, P.shade(col, -0.4));
      if (lab) P.text(ctx, lab, x + (w >> 1), y + 3, '#c3cad8', { align: 'center' });
    };
    box(322, 148, 22, 10, '#1d3a2a', 'GPU');
    box(324, 158, 20, 10, '#1d3a2a', 'GPU');
    // toolbox
    R(326, 182, 20, 10, '#b8322b'); R(326, 180, 20, 3, '#d9463e'); R(333, 178, 6, 2, '#8a93a6');
    R(329, 185, 2, 2, '#c3cad8'); R(341, 185, 2, 2, '#c3cad8');
  }

  /* ---------- center: the LANTERN core ---------- */
  function coreProgress(s) { return s.storySeen.length / NG.STORY.length; }

  function drawCoreBase(s, t) {
    const p = coreProgress(s);
    glow(256, 108, 70, C.amber, 0.06 + p * 0.1);
    ctx.fillStyle = P.rgba('#ffb640', 0.035 + p * 0.04);
    ctx.beginPath(); ctx.moveTo(238, 106); ctx.lineTo(274, 106); ctx.lineTo(284, 60); ctx.lineTo(228, 60); ctx.closePath(); ctx.fill();
    R(242, 123, 28, 3, C.steelD); R(248, 113, 16, 10, '#1d222b'); R(248, 113, 16, 1, '#3a4150');
    const rows = [20, 28, 32, 34, 34, 32, 28, 20];
    rows.forEach((hw, r) => R(256 - hw, 106 + r, hw * 2, 1, r < 2 ? '#4a5263' : r < 6 ? C.steelD : '#20252f'));
    R(236, 106, 40, 1, C.amber);
    for (let a = 0; a < 8; a++) {
      const ang = t * 0.9 + a * Math.PI / 4;
      if (Math.sin(ang) > 0) R(256 + Math.cos(ang) * 31, 109 + Math.sin(ang) * 3, 1, 1, C.gold);
    }
  }

  function drawCore(s, t) {
    const p = coreProgress(s);
    const revealed = s.storySeen.indexOf('crate') >= 0;
    const cx = CORE.x, cy = CORE.y;
    glow(cx, cy, 22 + p * 18, C.gold, 0.2 + p * 0.3 + Math.sin(t * 2) * 0.04);
    // crystal lattice: a slowly turning octahedron
    const rot = t * 0.7;
    const V = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map(([x, y, z]) => {
      const X = x * Math.cos(rot) - z * Math.sin(rot), Z = x * Math.sin(rot) + z * Math.cos(rot);
      return [cx + X * 11, cy + y * 15 + Math.sin(t * 1.3) * 1.5, Z];
    });
    const E = [[0, 2], [0, 3], [1, 2], [1, 3], [4, 2], [4, 3], [5, 2], [5, 3], [0, 4], [4, 1], [1, 5], [5, 0]];
    for (const [a, b] of E) {
      const front = (V[a][2] + V[b][2]) / 2 > -0.1;
      ctx.fillStyle = front ? 'rgba(255,225,150,0.95)' : 'rgba(255,182,64,0.3)';
      for (let k = 0; k <= 12; k++) {
        ctx.fillRect(Math.round(V[a][0] + (V[b][0] - V[a][0]) * k / 12), Math.round(V[a][1] + (V[b][1] - V[a][1]) * k / 12), 1, 1);
      }
    }
    // tilted rings
    for (let ring = 0; ring < 2; ring++) {
      const rx = ring ? 22 : 27, ry = ring ? 7 : 4, sp = ring ? -0.5 : 0.35, tilt = ring ? 0.35 : -0.2;
      for (let a = 0; a < Math.PI * 2; a += 0.1) {
        const x = Math.cos(a + t * sp) * rx, y = Math.sin(a + t * sp) * ry + Math.cos(a + t * sp) * rx * tilt * 0.3;
        ctx.fillStyle = Math.sin(a + t * sp) > 0 ? 'rgba(255,215,106,0.75)' : 'rgba(255,215,106,0.2)';
        ctx.fillRect(Math.round(cx + x), Math.round(cy + 3 + y), 1, 1);
      }
    }
    const beat = Math.sin(t * 3) > 0;
    R(cx - 1, cy - 1 + Math.sin(t * 1.3) * 1.5, 3, 3, beat ? '#ffffff' : C.gold);
    if (Math.random() < 0.05 + p * 0.2) fx.particles.push({ x: cx + rand(-18, 18), y: 104, vx: 0, vy: -rand(8, 18), life: 1.4, t: 0, color: C.gold });
    if (Math.random() > 0.03) P.text(ctx, revealed ? 'LANTERN' : '???', cx, 99, revealed ? C.gold : '#8a7a50', { align: 'center' });
  }

  /* ---------- bays ---------- */
  function drawPanel(x, y, w, h, skill, t, seed, on) {
    ctx.fillStyle = on ? 'rgba(62,232,255,0.10)' : 'rgba(90,99,120,0.07)';
    ctx.fillRect(x, y, w, h);
    const edge = on ? 'rgba(62,232,255,0.55)' : 'rgba(90,99,120,0.3)';
    R(x, y, w, 1, edge); R(x, y + h - 1, w, 1, edge);
    if (!on || !skill) return;
    const col = skillColor(skill);
    const f = Math.floor(t * 4) + seed;
    if (skill === 'code') {
      for (let r = 0; r < 4; r++) {
        const len = 3 + (P.hash(f + r) % 8);
        R(x + 2 + (r % 2) * 2, y + 2 + r * 2, Math.min(len, w - 5), 1, r % 3 === 0 ? C.cyan : col);
      }
    } else if (skill === 'write') {
      for (let r = 0; r < 4; r++) R(x + 2, y + 2 + r * 2, r === 3 ? 4 + (f % 5) : w - 4 - (P.hash(seed + r) % 4), 1, 'rgba(244,241,230,0.8)');
      if (Math.floor(t * 2) % 2) R(x + 7 + (f % 5), y + 8, 1, 2, '#ffffff');
    } else if (skill === 'design') {
      const pal = ['#ff5fa2', '#ffd76a', '#7fe9ff', '#9d8bff', '#46f08c'];
      for (let k = 0; k < 4; k++) R(x + 2 + (k % 2) * 5, y + 2 + ((k / 2) | 0) * 4, 4, 3, pal[(P.hash(Math.floor(t) + seed + k)) % 5]);
    } else if (skill === 'data') {
      for (let k = 0; k < 5; k++) {
        const bh = 2 + Math.round((Math.sin(t * 2 + k + seed) + 1) * 3);
        R(x + 2 + k * 2, y + h - 2 - bh, 1, bh, k === 4 ? C.gold : col);
      }
    } else if (skill === 'media') {
      R(x + 5, y + 3, 1, 5, col); R(x + 6, y + 4, 1, 3, col); R(x + 7, y + 5, 1, 1, col);
      R(x + 2, y + h - 3, w - 4, 1, 'rgba(157,139,255,0.3)');
      R(x + 2, y + h - 3, Math.round((w - 4) * ((t * 0.3 + seed * 0.1) % 1)), 1, col);
    }
  }

  function drawBay(s, i, t) {
    const [x, y] = BAY_POS[i];
    const b = s.bays[i];
    const sel = NG.ui && NG.ui.tab === 'bays' && NG.ui.selectedBay === i;
    const hov = hover && hover.type === 'bay' && hover.i === i;
    if (!b.unlocked) {
      const next = NG.nextLockedBay(s) === i;
      const cost = NG.BAY_COSTS[i];
      const col = next && s.cash >= cost ? C.amber : '#3a4150';
      R(x, y, BAY_W, BAY_H, '#15181f');
      for (let k = 0; k < BAY_W; k += 4) { R(x + k, y, 2, 1, col); R(x + k, y + BAY_H - 1, 2, 1, col); }
      for (let k = 0; k < BAY_H; k += 4) { R(x, y + k, 1, 2, col); R(x + BAY_W - 1, y + k, 1, 2, col); }
      const lc = next ? '#5a6378' : '#3a4150';
      R(x + 27, y + 12, 6, 1, lc); R(x + 26, y + 13, 1, 4, lc); R(x + 33, y + 13, 1, 4, lc);
      R(x + 25, y + 17, 10, 8, lc); R(x + 29, y + 20, 2, 3, '#15181f');
      P.text(ctx, next ? '$' + NG.fmt(cost) : 'LOCKED', x + 30, y + 31, next ? col : '#3a4150', { align: 'center' });
      if (next) P.text(ctx, 'UNLOCK', x + 30, y + 39, '#5a6378', { align: 'center' });
      if (hov) outline(x, y, BAY_W, BAY_H, '#5a6378');
      return;
    }
    const m = b.modelUid ? NG.getModel(s, b.modelUid) : null;
    const T = m ? NG.MODEL_MAP[m.type] : null;
    const job = b.jobId ? NG.JOB_MAP[b.jobId] : null;
    const active = !!(m && job);

    R(x, y, BAY_W, BAY_H, '#1d222c'); R(x + 1, y + 1, BAY_W - 2, BAY_H - 2, '#20252f');
    if (active) glow(x + 30, y + 24, 30, T.color, 0.08);
    const cc = active ? C.cyan : '#3a4150';
    R(x, y, 6, 1, cc); R(x, y, 1, 6, cc); R(x + 54, y, 6, 1, cc); R(x + 59, y, 1, 6, cc);
    R(x, y + 51, 6, 1, cc); R(x, y + 46, 1, 6, cc); R(x + 54, y + 51, 6, 1, cc); R(x + 59, y + 46, 1, 6, cc);

    drawPanel(x + 3, y + 6, 14, 12, job ? skillOf(job) : null, t, i * 7, active);
    drawPanel(x + 43, y + 6, 14, 12, job ? secondSkillOf(job) : null, t, i * 7 + 3, active);

    // the model's robot, when it is at its desk (otherwise it is off running an errand)
    const w = m ? walkers.get(m.uid) : null;
    if (w && w.mode === 'work' && w.home && w.home.bay === i) {
      drawRobot(w, x + 30, y + 29, t, false, active);
      if (active && Math.random() < 0.08) {
        fx.particles.push({ x: x + 22 + Math.random() * 16, y: y + 24, vx: 0, vy: -12, life: 0.5, t: 0, color: skillColor(skillOf(job)) });
      }
    }

    R(x + 8, y + 24, 44, 3, C.steel); R(x + 8, y + 24, 44, 1, C.steelL);
    R(x + 8, y + 27, 44, 6, C.steelD); R(x + 8, y + 33, 44, 1, '#171a21');
    R(x + 10, y + 29, 40, 1, active ? P.rgba(T.color, 0.85) : '#232833');
    if (active) R(x + 22, y + 24, 16, 1, Math.sin(t * 9 + i) > 0 ? C.cyan : C.ice);

    if (m) P.text(ctx, 'LV' + m.level, x + 30, y + 1, C.gold, { align: 'center' });

    const training = !m && s.pods.some(p => p.modelUid && p.fromBay === i);
    const label = training ? 'IN TRAINING' : !m ? 'EMPTY BAY' : job ? job.short : 'NO CONTRACT';
    P.text(ctx, label, x + 30, y + 37, training ? C.gold : active ? C.text : '#5a6378', { align: 'center' });
    if (active) {
      const d = NG.demand(s, job.id);
      if (d > 1) P.text(ctx, '^', x + 56, y + 37, C.gold);
      else if (d < 1) P.text(ctx, '-', x + 56, y + 37, '#ff4a52');
    }
    R(x + 4, y + 45, 52, 4, C.ink);
    if (active) {
      const col = skillColor(skillOf(job));
      const pw = Math.floor(50 * Math.min(1, b.progress));
      R(x + 5, y + 46, pw, 2, col);
      R(x + 5, y + 46, pw, 1, 'rgba(255,255,255,0.35)');
    }

    for (const f of fx.flashes) {
      if (f.bay !== i) continue;
      ctx.fillStyle = P.rgba(f.color, 0.35 * (1 - f.t / f.life));
      ctx.fillRect(x, y, BAY_W, BAY_H);
    }
    if (sel) marching(x - 1, y - 1, BAY_W + 2, BAY_H + 2, t, C.gold);
    else if (hov) outline(x, y, BAY_W, BAY_H, '#6a7488');
  }

  /* ---------- training pods ---------- */
  function drawPod(s, i, t) {
    const [x, y] = POD_POS[i];
    const unlocked = i < NG.podCount(s);
    const p = s.pods[i];
    const hov = hover && hover.type === 'pod' && hover.i === i;
    R(x, y + 40, POD_W, 8, C.steelD); R(x, y + 40, POD_W, 1, C.steel); R(x + 2, y + 47, 24, 1, '#171a21');
    R(x + 2, y, 24, 6, C.steelD); R(x + 2, y, 24, 1, C.steel);
    R(x + 4, y + 5, 20, 1, unlocked ? C.cyan : '#3a4150');
    ctx.fillStyle = unlocked ? 'rgba(127,233,255,0.07)' : 'rgba(60,65,80,0.15)';
    ctx.fillRect(x + 4, y + 6, 20, 34);
    R(x + 4, y + 6, 1, 34, unlocked ? 'rgba(62,232,255,0.4)' : '#2a303c');
    R(x + 23, y + 6, 1, 34, unlocked ? 'rgba(62,232,255,0.4)' : '#2a303c');
    if (!unlocked) {
      P.text(ctx, 'LOCK', x + 14, y + 20, '#4a5263', { align: 'center' });
    } else if (p.modelUid) {
      const m = NG.getModel(s, p.modelUid);
      const col = skillColor(p.focus);
      ctx.fillStyle = P.rgba(col, 0.13); ctx.fillRect(x + 5, y + 6, 18, 34);
      glow(x + 14, y + 24, 16, col, 0.25);
      for (let k = 0; k < 7; k++) {
        const h = P.hash(k + i * 11);
        const by = y + 38 - ((t * (10 + (h % 8)) + h) % 32);
        R(x + 6 + (h % 16), by, 1, 1, P.rgba(col, 0.9));
      }
      if (m) {
        const T = NG.MODEL_MAP[m.type];
        const img = P.sprite(P.spriteKind(T.tier), T.color, true);
        ctx.globalAlpha = 0.9;
        ctx.drawImage(img, x + 14 - (img.width >> 1), y + 37 - img.height + Math.round(Math.sin(t * 2 + i) * 1.5));
        ctx.globalAlpha = 1;
        P.text(ctx, 'LV' + (m.level + 1), x + 14, y - 7, C.gold, { align: 'center' });
      }
      R(x + 3, y + 43, 22, 2, C.ink);
      R(x + 3, y + 43, Math.round(22 * Math.min(1, p.t / p.dur)), 2, col);
    } else {
      P.text(ctx, 'IDLE', x + 14, y + 20, '#4a5263', { align: 'center' });
    }
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(x + 7, y + 8, 1, 22);
    if (hov) outline(x - 1, y - 1, POD_W + 2, POD_H + 2, '#6a7488');
  }

  /* ---------- conveyor, crates, dispatch ---------- */
  function drawConveyor(t) {
    const y = CONV_Y;
    R(8, y - 2, 468, 2, C.steel); R(8, y, 468, 10, '#15181e'); R(8, y + 10, 468, 2, '#394050'); R(8, y + 12, 468, 1, '#0d0f13');
    const off = (t * 40) % 6;
    for (let x = 8 + off; x < 476; x += 6) R(x, y + 1, 1, 8, '#232833');
    for (let x = 12; x < 476; x += 16) R(x, y - 1, 2, 1, Math.sin(t * 4 - x * 0.05) > 0.4 ? C.cyan : C.cyanD);
    const pulse = (Math.sin(t * 3) + 1) / 2;
    glow(PAD_X + 14, y + 5, 22, C.cyan, 0.12 + pulse * 0.1);
    R(PAD_X, y - 8, 28, 24, '#20252f'); R(PAD_X, y - 8, 28, 1, C.steel);
    outline(PAD_X + 3, y - 5, 22, 18, P.rgba('#3ee8ff', 0.4 + pulse * 0.5));
    outline(PAD_X + 8, y - 1, 12, 10, 'rgba(62,232,255,0.35)');
    P.text(ctx, 'SHIP', PAD_X + 14, y + 19, '#5a6378', { align: 'center' });
  }

  function drawCrates() {
    for (const c of fx.crates) {
      if (c.phase === 'beam') {
        const a = 1 - c.t / 0.7;
        ctx.fillStyle = 'rgba(127,233,255,' + (0.35 * a) + ')';
        ctx.fillRect(PAD_X + 10, 60, 8, CONV_Y - 58);
        ctx.globalAlpha = Math.max(0, a);
      }
      crate(c.x, c.y, c.color);
      ctx.globalAlpha = 1;
    }
  }
  function crate(x, y, color) {
    R(x - 4, y - 3, 8, 6, P.shade(color, -0.5));
    R(x - 4, y - 3, 8, 2, color);
    R(x - 1, y - 3, 2, 6, '#0d1015');
  }

  // grated step-plates where the robots cross the conveyor
  function drawBridges() {
    for (const bx of [140, 360]) {
      R(bx, CONV_Y - 4, 12, 18, '#3a4150'); R(bx, CONV_Y - 4, 12, 1, '#6a7488');
      for (let k = 0; k < 16; k += 3) R(bx + 1, CONV_Y - 2 + k, 10, 1, '#262b36');
      R(bx, CONV_Y - 4, 1, 18, C.amber); R(bx + 11, CONV_Y - 4, 1, 18, C.amber);
    }
  }

  /* ---------- bottom décor ---------- */
  function drawBench(t) {
    ctx.fillStyle = 'rgba(62,232,255,0.07)'; ctx.fillRect(52, 227, 44, 13);
    outline(52, 227, 44, 13, 'rgba(62,232,255,0.4)');
    const rot = t * 0.9;
    const pts = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]].map(([x, y, z]) => {
      const X = x * Math.cos(rot) - z * Math.sin(rot);
      return [74 + X * 6, 233 + y * 4 + z * Math.sin(rot) * 0.5];
    });
    [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]].forEach(([a, b]) => {
      for (let k = 0; k <= 8; k++) R(pts[a][0] + (pts[b][0] - pts[a][0]) * k / 8, pts[a][1] + (pts[b][1] - pts[a][1]) * k / 8, 1, 1, 'rgba(127,233,255,0.8)');
    });
    R(20, 244, 96, 4, C.steel); R(20, 244, 96, 1, C.steelL); R(20, 248, 96, 10, C.steelD);
    R(22, 258, 4, 8, '#1d222b'); R(110, 258, 4, 8, '#1d222b');
    R(30, 250, 20, 6, '#232833'); R(38, 252, 4, 1, '#8a93a6');
    R(56, 250, 20, 6, '#232833'); R(64, 252, 4, 1, '#8a93a6');
    R(26, 242, 10, 2, '#8a93a6'); R(26, 241, 2, 1, '#8a93a6'); R(34, 241, 2, 1, '#8a93a6');
    R(40, 242, 8, 1, '#c3cad8'); R(48, 241, 4, 3, C.red);
    R(84, 240, 8, 4, '#1d3a2a'); R(85, 241, 6, 1, C.green); // circuit board
    R(104, 240, 5, 4, '#e8e2c8'); R(109, 241, 1, 2, '#e8e2c8');
    if (Math.sin(t * 1.7) > 0.5 && Math.random() < 0.1) fx.particles.push({ x: 106, y: 238, vx: 0, vy: -6, life: 1, t: 0, color: 'rgba(200,210,220,0.5)' });
  }

  function drawPrinter(t) {
    const x = 158;
    R(x + 10, 226, 12, 6, '#ff7a3d'); R(x + 14, 228, 4, 2, '#3a4150');
    R(x, 232, 3, 38, C.steel); R(x + 30, 232, 3, 38, C.steel); R(x, 232, 33, 4, C.steel);
    R(x - 2, 268, 37, 5, C.steelD); R(x - 2, 268, 37, 1, C.steelL);
    R(x + 5, 262, 23, 3, '#1d222b');
    const cyc = (t * 0.12) % 1;
    const oh = Math.floor(cyc * 12);
    R(x + 11, 262 - oh, 11, oh, '#ff7a3d');
    if (oh) R(x + 11, 262 - oh, 11, 1, '#ffa877');
    const gy = 262 - oh - 7;
    R(x + 3, gy, 27, 2, '#6a7488');
    const nx = x + 11 + (Math.sin(t * 6) + 1) * 4.5;
    R(nx, gy + 2, 4, 3, '#c3cad8'); R(nx + 1, gy + 5, 2, 1, C.amber);
    R(x + 24, 264, 4, 2, Math.sin(t * 4) > 0 ? C.green : '#1f5a36');
  }

  function drawCRTs(t) {
    const crt = (x, y, mode) => {
      R(x, y, 18, 16, '#c9c2a8'); R(x, y, 18, 1, '#e0dac4'); R(x, y + 15, 18, 1, '#8f8872');
      R(x + 2, y + 2, 14, 10, '#0b0f0b');
      if (mode === 0) {
        for (let r = 0; r < 4; r++) R(x + 3, y + 3 + r * 2, 3 + P.hash(r + Math.floor(t * 3)) % 10, 1, C.green);
      } else if (mode === 1) {
        const bars = ['#e8e8e8', '#e8d84a', '#4ae8e0', '#4ae84a', '#e84ae0', '#e84a4a', '#4a4ae8'];
        bars.forEach((c, k) => R(x + 2 + k * 2, y + 2, 2, 10, c));
      } else {
        for (let k = 0; k < 26; k++) R(x + 2 + Math.random() * 14, y + 2 + Math.random() * 10, 1, 1, Math.random() < 0.5 ? '#9aa39a' : '#3a403a');
      }
      R(x + 14, y + 13, 2, 1, C.red);
    };
    crt(200, 256, 0); crt(218, 256, 1); crt(209, 240, 2);
  }

  function drawDish(t) {
    R(250, 254, 2, 18, '#6a7488'); R(245, 269, 2, 4, '#6a7488'); R(255, 269, 2, 4, '#6a7488'); R(244, 272, 14, 1, '#3a4150');
    disc(251, 245, 8, dy => dy < 0 ? '#c3cad8' : '#9aa3b6');
    disc(251, 245, 4, '#8a93a6');
    R(250, 244, 3, 3, '#3a4150');
    R(251, 234, 2, 2, Math.sin(t * 3) > 0.6 ? C.red : '#5a1a1a');
  }

  function drawOrb(t) {
    const cx = 276, cy = 252;
    glow(cx, cy, 16, '#9d8bff', 0.22 + Math.random() * 0.06);
    R(270, 262, 13, 9, '#1d222b'); R(268, 270, 17, 3, C.steelD);
    disc(cx, cy, 8, '#150d24');
    for (let k = 0; k < 3; k++) {
      let x = cx, y = cy;
      const a = t * 0.8 + k * 2.1 + Math.sin(t * 3 + k) * 0.4;
      for (let st = 0; st < 8; st++) {
        x += Math.cos(a) + rand(-0.8, 0.8);
        y += Math.sin(a) + rand(-0.8, 0.8);
        R(x, y, 1, 1, st < 6 ? C.violet : '#f2e6ff');
      }
    }
    R(cx - 1, cy - 1, 3, 3, '#f2e6ff');
    R(cx - 5, cy - 6, 2, 1, 'rgba(255,255,255,0.35)');
  }

  function drawScope(t) {
    const x = 292;
    R(x, 256, 38, 4, C.steel); R(x + 2, 266, 34, 2, '#3a4150');
    R(x + 2, 258, 2, 14, '#3a4150'); R(x + 34, 258, 2, 14, '#3a4150');
    R(x + 1, 271, 4, 2, '#10141b'); R(x + 33, 271, 4, 2, '#10141b');
    R(x + 4, 240, 30, 16, '#8a93a6'); R(x + 4, 240, 30, 1, '#c3cad8');
    R(x + 6, 242, 18, 11, '#06140c');
    for (let k = 0; k < 18; k++) {
      const hi = Math.floor((k + t * 20) / 5) % 2;
      R(x + 6 + k, hi ? 244 : 250, 1, 1, C.green);
      if (Math.floor((k + 1 + t * 20) / 5) % 2 !== hi) R(x + 6 + k, 244, 1, 7, 'rgba(70,240,140,0.5)');
    }
    R(x + 26, 244, 3, 3, C.steelD); R(x + 26, 249, 3, 3, C.red);
    R(x + 8, 267, 8, 1, '#ffb640'); // cable on the shelf
  }

  function drawSpools() {
    const spool = (x, y, h) => {
      R(x, y, 3, h, '#8a6a4a'); R(x + 13, y, 3, h, '#8a6a4a');
      R(x + 3, y + 3, 10, h - 6, '#ff7a3d');
      for (let k = y + 5; k < y + h - 3; k += 2) R(x + 3, k, 10, 1, '#c85a24');
    };
    spool(334, 254, 18); spool(350, 260, 12);
  }

  function drawStorage(t) {
    const box = (x, y) => {
      R(x, y, 16, 12, C.steelD); R(x, y, 16, 1, C.steel); R(x, y + 11, 16, 1, '#171a21');
      R(x + 2, y + 4, 12, 2, C.amber); R(x + 2, y + 8, 5, 1, '#5a6378');
    };
    box(374, 256); box(392, 256); box(383, 244);
    // Pip's charging dock
    R(430, 268, 30, 6, C.steelD); R(430, 268, 30, 1, C.steel);
    R(441, 270, 8, 2, Math.sin(t * 2) > 0 ? C.green : '#1f5a36');
    P.text(ctx, 'PIP', 445, 262, '#4a5263', { align: 'center' });
  }

  /* =================================================================================
     Walking robots. Every hired model gets a body (plus Pip). Everyone follows the lane
     graph (drones just hover along it). Robots in a bay alternate desk work and errands.
     ================================================================================= */
  const XS = [42, 110, 146, 256, 366, 402, 470];
  const NODES = {}, ADJ = {};
  function addNode(id, x, y) { NODES[id] = { x, y }; ADJ[id] = []; }
  function link(a, b) { ADJ[a].push(b); ADJ[b].push(a); }
  ['T', 'M', 'B'].forEach((l, li) => {
    const y = [62, 130, 203][li];
    XS.forEach((x, i) => { addNode(l + i, x, y); if (i) link(l + (i - 1), l + i); });
  });
  [30, 146, 256, 366, 450].forEach((x, i) => { addNode('L' + i, x, 283); if (i) link('L' + (i - 1), 'L' + i); });
  link('T2', 'M2'); link('M2', 'B2'); link('B2', 'L1');
  link('T4', 'M4'); link('M4', 'B4'); link('B4', 'L3');

  function route(a, b) {
    const dist = {}, prev = {}, open = new Set(Object.keys(NODES));
    for (const k of open) dist[k] = Infinity;
    dist[a] = 0;
    while (open.size) {
      let u = null;
      for (const k of open) if (u === null || dist[k] < dist[u]) u = k;
      open.delete(u);
      if (u === b || dist[u] === Infinity) break;
      for (const v of ADJ[u]) {
        const d = dist[u] + Math.hypot(NODES[u].x - NODES[v].x, NODES[u].y - NODES[v].y);
        if (d < dist[v]) { dist[v] = d; prev[v] = u; }
      }
    }
    const path = [];
    for (let u = b; u; u = prev[u]) { path.unshift(u); if (u === a) break; }
    return path[0] === a ? path : [b];
  }

  const ACT_LABEL = {
    scan: 'checking the server racks', write: "puzzling over Wren's whiteboard", core: 'studying the LANTERN core',
    check: 'checking coolant levels', fix: 'fixing something', calibrate: 'calibrating the training pods',
    crate: 'hauling crates', weld: 'soldering at the workbench', print: 'running the 3D printer', type: 'reading the old terminals',
    zap: 'poking the plasma orb', charge: 'recharging', look: 'peeking outside', signal: 'aligning the antenna', scope: 'reading the oscilloscope'
  };
  const POIS = [
    { x: 30, y: 62, a: 'T0', act: 'scan', say: 'SCAN' },
    { x: 100, y: 62, a: 'T1', act: 'scan', say: 'PING' },
    { x: 173, y: 130, a: 'M2', act: 'write', say: 'HMM' },
    { x: 256, y: 130, a: 'M3', act: 'core', say: 'OOH' },
    { x: 336, y: 130, a: 'M4', act: 'check', say: 'TEMP OK' },
    { x: 176, y: 203, a: 'B2', act: 'fix', say: 'FIX' },
    { x: 334, y: 203, a: 'B4', act: 'fix', say: 'TIGHTEN' },
    { x: 256, y: 203, a: 'B3', act: 'calibrate', say: 'CALIBRATE' },
    { x: 110, y: 203, a: 'B1', act: 'crate', say: 'LIFT' },
    { x: 402, y: 203, a: 'B5', act: 'crate', say: 'LIFT' },
    { x: 68, y: 283, a: 'L0', act: 'weld', say: 'SOLDER' },
    { x: 175, y: 283, a: 'L1', act: 'print', say: 'PRINT' },
    { x: 218, y: 283, a: 'L2', act: 'type', say: 'LOG' },
    { x: 251, y: 283, a: 'L2', act: 'signal', say: 'SIGNAL' },
    { x: 276, y: 283, a: 'L2', act: 'zap', say: 'ZAP' },
    { x: 311, y: 283, a: 'L2', act: 'scope', say: 'WAVES' },
    { x: 343, y: 283, a: 'L3', act: 'fix', say: 'SPOOL' },
    { x: 396, y: 283, a: 'L3', act: 'crate', say: 'SORT' },
    { x: 445, y: 283, a: 'L4', act: 'charge', say: 'CHARGE' },
    { x: 436, y: 62, a: 'T5', act: 'look', say: '?' }
  ];
  const DOOR = { x: 436, y: 62, a: 'T5' };
  function baySpot(i) {
    const [bx, by] = BAY_POS[i];
    const x = bx + 30;
    return { x, y: by + 29, a: (by < 100 ? 'T' : 'M') + XS.indexOf(x), bay: i, home: true };
  }

  const walkers = new Map();
  let firstSync = true;

  function makeWalker(id, kind, color, tier, at) {
    return {
      id, kind, color, tier, x: at.x, y: at.y, anchor: at.a, path: [], dest: null, mode: 'idle', timer: rand(0.5, 3),
      face: 1, moving: false, home: null, homeKey: null, say: null, sayT: 0, hidden: false, seed: Math.random() * 100,
      speed: kind === 'drone' ? 28 : kind === 'mech' ? 20 : kind === 'pip' ? 26 : 24
    };
  }

  function go(w, spot) {
    w.dest = spot;
    w.mode = 'walk';
    const ids = route(w.anchor || 'M3', spot.a);
    const pts = ids.map(id => NODES[id]).concat([{ x: spot.x, y: spot.y }]);
    w.path = pts.filter((p, i) => i === 0 ? Math.hypot(p.x - w.x, p.y - w.y) > 0.5 : (p.x !== pts[i - 1].x || p.y !== pts[i - 1].y));
  }

  function pickErrand(w, s) {
    const busy = new Set();
    walkers.forEach(o => { if (o !== w && o.dest && o.mode !== 'work') busy.add(o.dest); });
    let pool = POIS.filter(p => !busy.has(p));
    if (!pool.length) pool = POIS;
    if (w.kind === 'pip' && Math.random() < 0.2) return POIS.find(p => p.act === 'charge');
    return pool[(Math.random() * pool.length) | 0];
  }

  function say(w, text, secs) { w.say = text; w.sayT = secs || 1.6; }

  function syncWalkers(s) {
    const seen = new Set(['pip']);
    if (!walkers.has('pip')) {
      const dock = POIS.find(p => p.act === 'charge');
      walkers.set('pip', makeWalker('pip', 'pip', '#d9782b', 0, dock));
    }
    for (const m of s.models) {
      seen.add(m.uid);
      const T = NG.MODEL_MAP[m.type];
      const where = NG.whereIs(s, m.uid);
      let w = walkers.get(m.uid);
      const home = where.kind === 'bay' ? baySpot(where.i) : null;
      if (!w) {
        const start = firstSync ? (home || POIS[(Math.random() * POIS.length) | 0]) : DOOR;
        w = makeWalker(m.uid, P.spriteKind(T.tier), T.color, T.tier, start);
        walkers.set(m.uid, w);
        if (firstSync && home) { w.mode = 'work'; w.timer = rand(2, 12); w.home = home; w.homeKey = 'bay' + where.i; }
        else if (!firstSync) say(w, 'HELLO!', 2);
      }
      w.name = m.name;
      if (where.kind === 'pod') {
        w.hidden = true; w.mode = 'pod'; w.path = [];
        const px = POD_POS[where.i][0] + 14;
        w.x = px; w.y = 203; w.anchor = 'B3';
        continue;
      }
      if (w.mode === 'pod') { w.hidden = false; w.mode = 'idle'; w.timer = 0; say(w, 'LEVEL UP!', 2); }
      const key = home ? 'bay' + where.i : 'none';
      if (key !== w.homeKey) {
        w.homeKey = key; w.home = home;
        if (w.mode === 'work') { w.mode = 'idle'; w.timer = 0; }
      }
    }
    for (const [id, w] of walkers) {
      if (seen.has(id)) continue;
      for (let k = 0; k < 14; k++) fx.particles.push({ x: w.x, y: w.y - 8, vx: rand(-30, 30), vy: rand(-40, 0), g: 60, life: 0.6, t: 0, color: '#c3cad8' });
      walkers.delete(id);
    }
    firstSync = false;
  }

  function updateWalkers(s, dt) {
    for (const w of walkers.values()) {
      if (w.hidden) continue;
      if (w.sayT > 0) w.sayT -= dt;
      w.moving = false;
      if (w.mode === 'walk') {
        const p = w.path[0];
        if (p) {
          const dx = p.x - w.x, dy = p.y - w.y, d = Math.hypot(dx, dy), step = w.speed * dt;
          if (d <= step) { w.x = p.x; w.y = p.y; w.path.shift(); } else { w.x += dx / d * step; w.y += dy / d * step; }
          if (Math.abs(dx) > 0.5) w.face = dx < 0 ? -1 : 1;
          w.moving = true;
        } else {
          const dest = w.dest;
          w.anchor = dest.a;
          if (dest.home) {
            if (w.home && dest.bay === w.home.bay) { w.mode = 'work'; w.timer = rand(15, 32); }
            else { w.mode = 'idle'; w.timer = 0; }
          } else if (dest.act) {
            w.mode = 'task'; w.task = dest; w.timer = rand(2.5, 4.5); say(w, dest.say, 1.5);
          } else { w.mode = 'idle'; w.timer = rand(1, 3); }
        }
        continue;
      }
      w.timer -= dt;
      if (w.mode === 'work') {
        if (!w.home) { w.mode = 'idle'; w.timer = 0; }
        else if (w.timer <= 0) go(w, pickErrand(w, s));
      } else if (w.mode === 'task') {
        taskFx(w, dt);
        if (w.timer <= 0) {
          if (w.home) go(w, w.home);
          else { w.mode = 'idle'; w.timer = rand(0.5, 2.5); }
        }
      } else if (w.mode === 'idle') {
        if (w.timer <= 0) go(w, w.home || pickErrand(w, s));
      }
    }
  }

  function taskFx(w, dt) {
    const act = w.task && w.task.act;
    const hx = w.x + w.face * 5, hy = w.y - 9;
    const chance = dt * 12;
    if ((act === 'fix' || act === 'weld' || act === 'print') && Math.random() < chance) {
      fx.particles.push({ x: hx, y: hy, vx: rand(-25, 25), vy: rand(-35, -5), g: 90, life: 0.4, t: 0, color: Math.random() < 0.5 ? C.gold : '#ffffff' });
    } else if (act === 'core' && Math.random() < chance * 0.5) {
      fx.particles.push({ x: w.x + rand(-6, 6), y: w.y - 4, vx: 0, vy: -rand(10, 20), life: 1, t: 0, color: C.gold });
    } else if (act === 'check' && Math.random() < chance * 0.4) {
      fx.particles.push({ x: w.x + rand(-4, 4), y: w.y - 16, vx: 0, vy: -8, life: 0.8, t: 0, color: C.ice });
    } else if (act === 'zap' && Math.random() < chance) {
      fx.particles.push({ x: hx, y: hy, vx: rand(-15, 15), vy: rand(-15, 15), life: 0.25, t: 0, color: C.violet });
    } else if ((act === 'type' || act === 'write' || act === 'scope') && Math.random() < chance * 0.4) {
      fx.particles.push({ x: hx + rand(-2, 2), y: hy, vx: 0, vy: -6, life: 0.4, t: 0, color: C.cyan });
    } else if (act === 'charge' && Math.random() < chance * 0.5) {
      fx.particles.push({ x: w.x + rand(-4, 4), y: w.y - 12, vx: 0, vy: -10, life: 0.6, t: 0, color: C.green });
    }
  }

  function spriteFor(w, t) {
    if (w.kind === 'pip') return P.sprite('pip', w.color, ((t * 0.8 + w.seed) % 5) < 0.12, 0);
    const pose = w.moving && w.kind !== 'drone' ? (Math.floor(t * 7 + w.seed) % 2 ? 1 : 2) : 0;
    return P.sprite(w.kind, w.color, ((t * 1.3 + w.seed) % 4) < 0.12, pose);
  }

  // draws a robot with its feet at (fx, fy)
  function drawRobot(w, fx0, fy, t, shadow, working) {
    const img = spriteFor(w, t);
    let sx = Math.round(fx0 - img.width / 2), sy = Math.round(fy - img.height);
    if (w.kind === 'drone') sy -= 7 - Math.round(Math.sin(t * 3 + w.seed) * 1.5);
    else if (w.kind === 'pip') sy += w.moving ? Math.round(Math.abs(Math.sin(t * 12))) * -1 : 0;
    else if (working) sy += Math.round(Math.sin(t * 4 + w.seed) * 0.6);
    if (shadow) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(Math.round(fx0 - 5), Math.round(fy - 1), 10, 2); }
    if (w.tier >= 4) {
      glow(fx0, sy + img.height / 2, 14, w.color, 0.3 + Math.sin(t * 3) * 0.08);
      ctx.globalAlpha = 0.8 + Math.sin(t * 7 + w.seed) * 0.12;
    }
    if (w.face < 0) {
      ctx.save(); ctx.translate(sx + img.width, sy); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0); ctx.restore();
    } else ctx.drawImage(img, sx, sy);
    ctx.globalAlpha = 1;
    if (w.tier >= 4) {
      ctx.fillStyle = 'rgba(6,21,29,0.35)';
      for (let yy = sy + ((t * 10) | 0) % 3; yy < sy + img.height; yy += 3) ctx.fillRect(sx, yy, img.width, 1);
    }
    if (w.tier >= 5) for (let k = 0; k < 3; k++) { const a = t * 2 + k * 2.1; R(fx0 + Math.cos(a) * 9, sy + 6 + Math.sin(a) * 3, 1, 1, C.gold); }
    if (w.kind === 'drone') R(fx0 - 1, sy + img.height, 2, 1, Math.sin(t * 20) > 0 ? C.ice : C.cyanD);
    w.box = { x: sx - 2, y: sy - 2, w: img.width + 4, h: img.height + 4 };
    return { sx, sy, img };
  }

  function drawWalker(w, t) {
    const hov = hover && hover.type === 'walker' && hover.id === w.id;
    const { sy } = drawRobot(w, w.x, w.y, t, true, false);
    if (w.mode === 'task' && w.task) {
      const act = w.task.act;
      if (act === 'crate') crate(w.x, sy - 4, '#ffb640');
      else if (act === 'scan' || act === 'signal') {
        ctx.fillStyle = 'rgba(62,232,255,' + (0.25 + Math.random() * 0.3) + ')';
        ctx.fillRect(Math.round(w.x), sy - 14, 1, 13);
      } else if (act === 'calibrate') {
        const r = 4 + ((t * 12) % 8);
        for (let a = 0; a < Math.PI * 2; a += 0.4) R(w.x + Math.cos(a) * r, w.y + Math.sin(a) * r * 0.35, 1, 1, 'rgba(62,232,255,0.7)');
      } else if (act === 'charge' && Math.floor(t * 4) % 2) {
        R(w.x, sy - 7, 2, 2, C.green); R(w.x - 1, sy - 5, 2, 2, C.green); R(w.x, sy - 3, 2, 1, C.green);
      }
    }
    if (w.sayT > 0 && w.say) bubble(w.x, sy - 3, w.say);
    if (hov) outline(w.box.x, w.box.y, w.box.w, w.box.h, C.gold);
  }

  function bubble(x, y, text) {
    const tw = P.textW(text) + 4;
    const bx = Math.round(x - tw / 2), by = y - 8;
    R(bx, by, tw, 7, '#0d1015'); outline(bx, by, tw, 7, C.steel);
    R(Math.round(x) - 1, by + 7, 2, 1, C.steel);
    P.text(ctx, text, bx + 2, by + 1, C.gold);
  }

  /* ---------- effects ---------- */
  function update(dt) {
    for (const p of fx.particles) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.g) p.vy += p.g * dt; }
    fx.particles = fx.particles.filter(p => p.t < p.life);
    if (fx.particles.length > 400) fx.particles.splice(0, fx.particles.length - 400);
    for (const f of fx.floats) { f.t += dt; f.y -= 14 * dt; }
    fx.floats = fx.floats.filter(f => f.t < f.life);
    for (const f of fx.flashes) f.t += dt;
    fx.flashes = fx.flashes.filter(f => f.t < f.life);
    for (const c of fx.crates) {
      c.t += dt;
      if (c.phase === 'drop') {
        c.vy += 400 * dt; c.y += c.vy * dt;
        if (c.y >= CONV_Y + 5) { c.y = CONV_Y + 5; c.phase = 'belt'; }
      } else if (c.phase === 'belt') {
        c.x += 40 * dt;
        if (c.x >= PAD_X + 14) { c.x = PAD_X + 14; c.phase = 'beam'; c.t = 0; }
      } else if (c.phase === 'beam') c.y -= 30 * dt;
    }
    fx.crates = fx.crates.filter(c => !(c.phase === 'beam' && c.t > 0.7));
    if (fx.crates.length > 60) fx.crates.splice(0, fx.crates.length - 60);
  }

  function drawFx() {
    for (const p of fx.particles) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
      R(p.x, p.y, 1, 1, p.color);
    }
    ctx.globalAlpha = 1;
    for (const f of fx.floats) {
      ctx.globalAlpha = Math.max(0, Math.min(1, (f.life - f.t) * 2));
      P.text(ctx, f.text, f.x, f.y, f.color, { align: 'center', shadow: '#05070a' });
    }
    ctx.globalAlpha = 1;
  }

  function drawTutorialArrow(s, t) {
    const target = NG.tutorial && NG.tutorial.worldTarget(s);
    if (!target) return;
    const bounce = Math.round(Math.abs(Math.sin(t * 5)) * 4);
    const x = target.x, y = target.y - 4 - bounce;
    R(x - 3, y - 8, 7, 4, C.gold); R(x - 2, y - 4, 5, 1, C.gold); R(x - 1, y - 3, 3, 1, C.gold); R(x, y - 2, 1, 1, C.gold);
    R(x - 3, y - 8, 7, 1, '#fff4c2');
  }

  function onJob(e) {
    const [x, y] = BAY_POS[e.bay];
    if (e.rejected) {
      fx.floats.push({ x: x + 30, y: y + 12, text: 'REJECTED', color: '#ff4a52', t: 0, life: 1.4 });
      fx.flashes.push({ bay: e.bay, color: '#ff4a52', t: 0, life: 0.5 });
      return;
    }
    fx.floats.push({ x: x + 30, y: y + 12, text: '+$' + NG.fmt(e.gross), color: C.gold, t: 0, life: 1.3 });
    fx.flashes.push({ bay: e.bay, color: '#3ee8ff', t: 0, life: 0.25 });
    fx.crates.push({ x: x + 30, y: CONV_Y - 16, vy: 0, color: skillColor(skillOf(e.job)), phase: 'drop', t: 0 });
  }

  /* ---------- public ---------- */
  NG.world = {
    W, H,
    init(canvas) {
      ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      bake();
      NG.bus.on('job', onJob);
      NG.bus.on('trained', e => {
        const [x, y] = POD_POS[e.pod];
        fx.floats.push({ x: x + 14, y: y + 10, text: 'LEVEL UP', color: C.gold, t: 0, life: 1.6 });
        for (let k = 0; k < 20; k++) fx.particles.push({ x: x + 14, y: y + 24, vx: rand(-30, 30), vy: -Math.random() * 60, g: 60, life: 0.8, t: 0, color: Math.random() < 0.5 ? C.gold : C.ice });
      });
    },
    reset() { walkers.clear(); firstSync = true; },
    setHover(h) { hover = h; },
    boostFx(i) {
      const [x, y] = BAY_POS[i];
      for (let k = 0; k < 6; k++) fx.particles.push({ x: x + 30 + rand(-10, 10), y: y + 20, vx: rand(-25, 25), vy: -20 - Math.random() * 40, g: 80, life: 0.5, t: 0, color: Math.random() < 0.5 ? C.cyan : '#ffffff' });
    },
    walkerInfo(id) {
      const w = walkers.get(id);
      if (!w) return null;
      let doing;
      if (w.mode === 'work') doing = 'working at its desk';
      else if (w.mode === 'task') doing = ACT_LABEL[w.task.act] || 'tinkering';
      else if (w.mode === 'walk') doing = w.dest && w.dest.home ? 'heading back to its bay' : 'on an errand';
      else doing = 'looking for something to do';
      return { id, name: id === 'pip' ? 'PIP' : w.name, doing, home: w.home };
    },
    poke(id, text) { const w = walkers.get(id); if (w) say(w, text, 2.2); },
    hit(x, y) {
      const list = [...walkers.values()].filter(w => !w.hidden && w.box && w.mode !== 'work').sort((a, b) => b.y - a.y);
      for (const w of list) if (x >= w.box.x && x < w.box.x + w.box.w && y >= w.box.y && y < w.box.y + w.box.h) return { type: 'walker', id: w.id };
      for (let i = 0; i < BAY_POS.length; i++) {
        const [bx, by] = BAY_POS[i];
        if (x >= bx && x < bx + BAY_W && y >= by && y < by + BAY_H) return { type: 'bay', i };
      }
      for (let i = 0; i < POD_POS.length; i++) {
        const [px, py] = POD_POS[i];
        if (x >= px && x < px + POD_W && y >= py - 8 && y < py + POD_H) return { type: 'pod', i };
      }
      if (x >= 4 && x < 152 && y >= 6 && y < 52) return { type: 'rack' };
      if (x >= 154 && x < 314 && y >= 6 && y < 50) return { type: 'screen' };
      if (Math.abs(x - CORE.x) < 34 && y >= 58 && y < 126) return { type: 'core' };
      return null;
    },
    draw(s, t, dt) {
      syncWalkers(s);
      updateWalkers(s, dt);
      update(dt);
      ctx.drawImage(bg, 0, 0);
      drawRacks(s, t);
      drawScreen(s, t);
      drawBreaker(t);
      drawDoor(t);
      R(0, 49, W, 1, P.rgba('#3ee8ff', 0.55 + Math.sin(t * 1.3) * 0.1));
      const lg = ctx.createLinearGradient(0, 56, 0, 76);
      lg.addColorStop(0, 'rgba(62,232,255,0.08)'); lg.addColorStop(1, 'rgba(62,232,255,0)');
      ctx.fillStyle = lg; ctx.fillRect(0, 56, W, 20);
      drawCoreBase(s, t);
      drawWhiteboard();
      drawCoolant(t);
      drawFan(t);
      drawGearPile();
      for (let i = 0; i < BAY_POS.length; i++) drawBay(s, i, t);
      P.text(ctx, 'TRAINING LAB', 256, 134, '#5a6378', { align: 'center' });
      for (let i = 0; i < POD_POS.length; i++) drawPod(s, i, t);
      drawCore(s, t);
      drawConveyor(t);
      drawCrates();
      drawBridges();
      drawBench(t);
      drawPrinter(t);
      drawCRTs(t);
      drawDish(t);
      drawOrb(t);
      drawScope(t);
      drawSpools();
      drawStorage(t);
      [...walkers.values()].filter(w => !w.hidden && !(w.mode === 'work' && w.home)).sort((a, b) => a.y - b.y).forEach(w => drawWalker(w, t));
      drawFx();
      drawTutorialArrow(s, t);
      ctx.drawImage(vignette, 0, 0);
    }
  };
})(window.NG);
