/* state.js — game state shape, derived stats, player actions (ops), save/load. */
'use strict';
(function (NG) {
  NG.MODEL_MAP = {}; NG.MODELS.forEach(m => { NG.MODEL_MAP[m.id] = m; });
  NG.JOB_MAP = {};   NG.JOBS.forEach(j => { NG.JOB_MAP[j.id] = j; });
  NG.UPG_MAP = {};   NG.UPGRADES.forEach(u => { NG.UPG_MAP[u.id] = u; });

  /* ---------- formatting ---------- */
  NG.fmt = function (n) {
    if (!isFinite(n)) return '0';
    const neg = n < 0;
    n = Math.abs(n);
    let s;
    if (n < 10) s = n.toFixed(1).replace(/\.0$/, '');
    else if (n < 1e4) s = Math.round(n).toLocaleString('en-US');
    else {
      const u = ['K', 'M', 'B', 'T', 'Q'];
      let i = -1;
      while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
      s = (n < 100 ? n.toFixed(n < 10 ? 2 : 1) : Math.round(n)) + u[i];
    }
    return (neg ? '-' : '') + s;
  };
  NG.fmtTime = function (sec) {
    sec = Math.max(0, Math.ceil(sec));
    if (sec < 60) return sec + 's';
    if (sec < 3600) return Math.floor(sec / 60) + 'm ' + (sec % 60) + 's';
    return Math.floor(sec / 3600) + 'h ' + Math.floor((sec % 3600) / 60) + 'm';
  };

  /* ---------- state ---------- */
  NG.makeModel = function (s, typeId) {
    const T = NG.MODEL_MAP[typeId];
    const n = (s.hireCount[typeId] || 0) + 1;
    s.hireCount[typeId] = n;
    return { uid: s.uidSeq++, type: typeId, name: n > 1 ? T.name + ' #' + n : T.name, level: 1, aff: Object.assign({}, T.aff) };
  };

  NG.newState = function () {
    const s = {
      v: 1, cash: 300, rep: 0, peakRep: 0, totalEarned: 0, jobsDone: 0, rejects: 0, jobCounts: {},
      models: [], bays: [], pods: [], hireCount: {},
      upgrades: { rack: 0, gpu: 0, network: 0, cooling: 0, pod: 0, lab: 0 },
      market: {}, surgeUntil: 0, nextEventAt: 45, time: 0,
      goalsDone: {}, uidSeq: 1, netHistory: [], bucket: 0, bucketT: 0, earnRate: 0,
      won: false, muted: false, lastSave: Date.now(), created: Date.now(),
      tut: { active: true, step: 0, boosts: 0 }, storySeen: []
    };
    for (let i = 0; i < 8; i++) s.bays.push({ unlocked: i < 2, modelUid: null, jobId: null, progress: 0 });
    for (let i = 0; i < 3; i++) s.pods.push({ modelUid: null, focus: null, t: 0, dur: 0, cost: 0, fromBay: null });
    const starter = NG.makeModel(s, 'pico');
    s.models.push(starter);
    s.bays[0].modelUid = starter.uid;
    s.bays[0].jobId = 'blog';
    return s;
  };

  /* ---------- lookups & derived stats ---------- */
  NG.getModel = (s, uid) => s.models.find(m => m.uid === uid) || null;
  NG.whereIs = function (s, uid) {
    for (let i = 0; i < s.bays.length; i++) if (s.bays[i].modelUid === uid) return { kind: 'bay', i };
    for (let i = 0; i < s.pods.length; i++) if (s.pods[i].modelUid === uid) return { kind: 'pod', i };
    return { kind: 'idle' };
  };
  NG.computeCap = s => NG.RACK_CAP[s.upgrades.rack];
  NG.computeUsed = s => s.bays.reduce((a, b) => {
    const m = b.modelUid && NG.getModel(s, b.modelUid);
    return a + (m ? NG.MODEL_MAP[m.type].compute : 0);
  }, 0);
  NG.surging = s => s.time < s.surgeUntil;
  NG.gpuMult = s => Math.pow(1.2, s.upgrades.gpu) * (NG.surging(s) ? 1.5 : 1);
  NG.payMult = s => 1 + 0.15 * s.upgrades.network;
  NG.costMult = s => Math.pow(0.88, s.upgrades.cooling);
  NG.podCount = s => 1 + s.upgrades.pod;
  NG.demand = (s, jobId) => { const e = s.market[jobId]; return e && e.until > s.time ? e.mult : 1; };
  NG.jobUnlocked = (s, j) => s.peakRep >= j.rep;
  NG.modelUnlocked = (s, T) => s.peakRep >= T.rep;
  NG.nextLockedBay = s => s.bays.findIndex(b => !b.unlocked);

  NG.fit = function (m, job) {
    let f = 0;
    for (const k in job.skills) f += job.skills[k] * m.aff[k];
    return f;
  };
  NG.modelSpeed = m => NG.MODEL_MAP[m.type].speed * (1 + 0.15 * (m.level - 1));
  NG.modelQuality = m => NG.MODEL_MAP[m.type].quality * (1 + 0.08 * (m.level - 1));

  // expected economics of model m running job once
  NG.calcJob = function (s, m, job) {
    const T = NG.MODEL_MAP[m.type];
    const fit = NG.fit(m, job);
    const speed = NG.modelSpeed(m) * fit * NG.gpuMult(s);
    const dur = Math.max(0.4, job.work / speed);
    const q = Math.max(1, Math.min(100, NG.modelQuality(m) * (0.6 + 0.4 * fit)));
    const pay = job.pay * (0.5 + q / 100) * NG.payMult(s) * NG.demand(s, job.id);
    const cost = T.cps * dur * NG.costMult(s);
    const reject = q < job.qReq ? Math.min(0.95, (job.qReq - q) / job.qReq * 2) : 0;
    const net = pay * (1 - reject) - cost;
    return { fit, speed, dur, q, pay, cost, reject, net, perSec: net / dur };
  };
  NG.bestJob = function (s, m) {
    let best = null, bestV = -Infinity;
    for (const j of NG.JOBS) {
      if (!NG.jobUnlocked(s, j)) continue;
      const v = NG.calcJob(s, m, j).perSec;
      if (v > bestV) { bestV = v; best = j; }
    }
    return best || NG.JOBS[0];
  };
  NG.trainCost = m => Math.round(NG.MODEL_MAP[m.type].cost * 0.5 * Math.pow(1.8, m.level - 1));
  NG.trainTime = (s, m) => 20 * Math.pow(1.45, m.level - 1) * Math.pow(0.8, s.upgrades.lab);
  NG.MAX_LEVEL = 10;

  NG.titleFor = function (rep) {
    let t = NG.TITLES[0][1];
    for (const [r, name] of NG.TITLES) if (rep >= r) t = name;
    return t;
  };
  NG.nextTitle = function (rep) {
    for (const [r, name] of NG.TITLES) if (rep < r) return { rep: r, name };
    return null;
  };

  /* ---------- player actions ---------- */
  const ok = msg => ({ ok: true, msg });
  const no = msg => ({ ok: false, msg });
  const fmt$ = n => '$' + NG.fmt(n);

  NG.ops = {
    hire(s, typeId) {
      const T = NG.MODEL_MAP[typeId];
      if (!T) return no('Unknown model');
      if (!NG.modelUnlocked(s, T)) return no('Needs ' + T.rep + ' reputation');
      if (s.cash < T.cost) return no('Not enough cash');
      s.cash -= T.cost;
      const m = NG.makeModel(s, typeId);
      s.models.push(m);
      let msg = 'Hired ' + m.name;
      const i = s.bays.findIndex(b => b.unlocked && !b.modelUid);
      if (i >= 0 && NG.computeUsed(s) + T.compute <= NG.computeCap(s)) {
        const b = s.bays[i];
        b.modelUid = m.uid; b.progress = 0;
        b.jobId = NG.bestJob(s, m).id;
        msg += ' → BAY ' + (i + 1);
      } else if (i >= 0) msg += ' (not enough compute to deploy — add a Server Rack)';
      NG.bus.emit('hire', { m });
      return ok(msg);
    },
    sell(s, uid) {
      const m = NG.getModel(s, uid);
      if (!m) return no('Unknown model');
      const w = NG.whereIs(s, uid);
      if (w.kind === 'pod') return no('Model is training');
      if (w.kind === 'bay') { s.bays[w.i].modelUid = null; s.bays[w.i].progress = 0; }
      const refund = Math.round(NG.MODEL_MAP[m.type].cost * 0.4);
      s.cash += refund;
      s.models = s.models.filter(x => x.uid !== uid);
      return ok('Retired ' + m.name + ' (+' + fmt$(refund) + ')');
    },
    assign(s, bi, uid) {
      const b = s.bays[bi];
      const m = NG.getModel(s, uid);
      if (!b || !b.unlocked || !m) return no('Cannot assign');
      const w = NG.whereIs(s, uid);
      if (w.kind === 'pod') return no('Model is training');
      const T = NG.MODEL_MAP[m.type];
      let used = NG.computeUsed(s);
      if (w.kind === 'bay') used -= T.compute;
      if (b.modelUid) used -= NG.MODEL_MAP[NG.getModel(s, b.modelUid).type].compute;
      if (used + T.compute > NG.computeCap(s)) return no('Needs ' + T.compute + ' compute — install more Server Racks');
      if (w.kind === 'bay') { s.bays[w.i].modelUid = null; s.bays[w.i].progress = 0; }
      b.modelUid = uid; b.progress = 0;
      if (!b.jobId) b.jobId = NG.bestJob(s, m).id;
      return ok(m.name + ' → BAY ' + (bi + 1));
    },
    unassign(s, bi) {
      const b = s.bays[bi];
      if (!b || !b.modelUid) return no('Bay is empty');
      b.modelUid = null; b.progress = 0;
      return ok('Bay ' + (bi + 1) + ' cleared');
    },
    setJob(s, bi, jobId) {
      const b = s.bays[bi], j = NG.JOB_MAP[jobId];
      if (!b || !j) return no('Unknown contract');
      if (!NG.jobUnlocked(s, j)) return no('Needs ' + j.rep + ' reputation');
      if (b.jobId !== jobId) { b.jobId = jobId; b.progress = 0; }
      return ok(null);
    },
    unlockBay(s, bi) {
      if (bi !== NG.nextLockedBay(s)) return no('Unlock bays in order');
      const cost = NG.BAY_COSTS[bi];
      if (s.cash < cost) return no('Not enough cash');
      s.cash -= cost;
      s.bays[bi].unlocked = true;
      NG.bus.emit('upgrade', { id: 'bay' });
      return ok('BAY ' + (bi + 1) + ' online');
    },
    buy(s, id) {
      const U = NG.UPG_MAP[id];
      const l = s.upgrades[id];
      if (!U) return no('Unknown upgrade');
      if (l >= U.max) return no('Already maxed');
      const cost = U.cost(l);
      if (s.cash < cost) return no('Not enough cash');
      s.cash -= cost;
      s.upgrades[id]++;
      NG.bus.emit('upgrade', { id });
      return ok(U.name + ' → LV ' + (l + 1));
    },
    train(s, uid, skill) {
      const m = NG.getModel(s, uid);
      if (!m) return no('Unknown model');
      if (m.level >= NG.MAX_LEVEL) return no('Already max level');
      if (NG.SKILLS.indexOf(skill) < 0) return no('Pick a skill');
      const w = NG.whereIs(s, uid);
      if (w.kind === 'pod') return no('Already training');
      const pi = s.pods.findIndex((p, i) => i < NG.podCount(s) && !p.modelUid);
      if (pi < 0) return no('No free training pod');
      const cost = NG.trainCost(m);
      if (s.cash < cost) return no('Not enough cash');
      s.cash -= cost;
      let from = null;
      if (w.kind === 'bay') { s.bays[w.i].modelUid = null; s.bays[w.i].progress = 0; from = w.i; }
      Object.assign(s.pods[pi], { modelUid: uid, focus: skill, t: 0, dur: NG.trainTime(s, m), cost, fromBay: from });
      NG.bus.emit('trainStart', { m, pod: pi });
      return ok(m.name + ' entered POD ' + (pi + 1));
    },
    cancelTrain(s, pi) {
      const p = s.pods[pi];
      if (!p || !p.modelUid) return no('Pod is empty');
      const refund = Math.round(p.cost * 0.5);
      s.cash += refund;
      Object.assign(p, { modelUid: null, focus: null, t: 0, dur: 0, cost: 0, fromBay: null });
      return ok('Training aborted (+' + fmt$(refund) + ')');
    },
    // clicking a working bay pushes one extra second of work (at least 2% of the job) through it
    boost(s, bi) {
      const b = s.bays[bi];
      if (!b || !b.unlocked || !b.modelUid || !b.jobId) return no(null);
      const m = NG.getModel(s, b.modelUid);
      const c = NG.calcJob(s, m, NG.JOB_MAP[b.jobId]);
      b.progress = Math.min(0.999, b.progress + Math.max(0.02, 1 / c.dur));
      return ok(null);
    }
  };

  /* ---------- persistence ---------- */
  const KEY = 'neuralGarage.save.v1';
  NG.save = function (s) {
    try { s.lastSave = Date.now(); localStorage.setItem(KEY, JSON.stringify(s)); return true; }
    catch (e) { return false; }
  };
  // Turns parsed save data into a valid state, or returns null. Save files can be edited by hand,
  // so anything that would break the game is rejected rather than trusted.
  NG.parseSave = function (d) {
    if (d && d.game === 'neural-garage' && d.state) d = d.state;
    if (!d || d.v !== 1 || !Array.isArray(d.models) || !Array.isArray(d.bays) || !Array.isArray(d.pods)) return null;
    if (d.bays.length !== 8 || d.pods.length !== 3) return null;
    if (!d.models.every(m => m && NG.MODEL_MAP[m.type] && Number.isFinite(m.uid) && m.aff)) return null;
    if (![d.cash, d.rep, d.peakRep, d.totalEarned].every(Number.isFinite)) return null;
    const s = Object.assign(NG.newState(), d);
    s.upgrades = Object.assign(NG.newState().upgrades, d.upgrades);
    for (const U of NG.UPGRADES) s.upgrades[U.id] = Math.max(0, Math.min(U.max, s.upgrades[U.id] | 0));
    s.hireCount = d.hireCount || {};
    s.market = d.market || {};
    s.jobCounts = d.jobCounts || {};
    s.goalsDone = d.goalsDone || {};
    s.netHistory = Array.isArray(d.netHistory) ? d.netHistory.filter(Number.isFinite) : [];
    s.tut = Object.assign({ active: false, step: 0, boosts: 0 }, d.tut);
    s.storySeen = Array.isArray(d.storySeen) ? d.storySeen.filter(id => NG.STORY_MAP && NG.STORY_MAP[id]) : [];
    const uids = new Set(s.models.map(m => m.uid));
    s.bays.forEach(b => { if (b.modelUid != null && !uids.has(b.modelUid)) b.modelUid = null; if (b.jobId && !NG.JOB_MAP[b.jobId]) b.jobId = null; });
    s.pods.forEach(p => { if (p.modelUid != null && !uids.has(p.modelUid)) Object.assign(p, { modelUid: null, focus: null, t: 0, dur: 0 }); });
    s.uidSeq = Math.max(s.uidSeq | 0, ...s.models.map(m => m.uid + 1), 1);
    return s;
  };
  NG.load = function () {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? NG.parseSave(JSON.parse(raw)) : null;
    } catch (e) { return null; }
  };
  // save file contents for download
  NG.exportSave = function (s) {
    s.lastSave = Date.now();
    return JSON.stringify({ game: 'neural-garage', format: 1, exported: new Date().toISOString(), state: s }, null, 1);
  };
  NG.importSave = function (text) {
    try { return NG.parseSave(JSON.parse(text)); } catch (e) { return null; }
  };
  NG.wipe = function () { try { localStorage.removeItem(KEY); } catch (e) { /* storage blocked */ } };
})(window.NG);
