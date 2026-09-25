/* sim.js — the economy tick: bays produce jobs, pods train models, the market shifts. */
'use strict';
(function (NG) {
  const emit = (e, d) => NG.bus.emit(e, d);

  function checkUnlocks(s, before, after) {
    for (const j of NG.JOBS) if (j.rep > before && j.rep <= after) emit('unlockJob', j);
    for (const T of NG.MODELS) if (T.rep > before && T.rep <= after) emit('unlockModel', T);
    const a = NG.titleFor(before), b = NG.titleFor(after);
    if (a !== b) emit('title', b);
  }

  function completeJob(s, bi, m, job, c) {
    const rejected = Math.random() < c.reject;
    const gross = rejected ? 0 : c.pay;
    const net = gross - c.cost;
    s.cash += net;
    s.totalEarned += gross;
    s.bucket += net;
    s.jobsDone++;
    s.jobCounts[job.id] = (s.jobCounts[job.id] || 0) + 1;
    if (rejected) {
      s.rejects++;
      s.rep = Math.max(0, s.rep - job.work * 0.03);
    } else {
      s.rep += job.work * 0.06 * (c.q / 50);
      if (s.rep > s.peakRep) {
        const before = s.peakRep;
        s.peakRep = s.rep;
        checkUnlocks(s, before, s.peakRep);
      }
    }
    emit('job', { bay: bi, net, gross, rejected, job, model: m });
    if (job.id === 'moonshot' && !s.won) { s.won = true; emit('win', {}); }
  }

  function finishTraining(s, pi) {
    const p = s.pods[pi];
    const m = NG.getModel(s, p.modelUid);
    const from = p.fromBay, focus = p.focus;
    Object.assign(p, { modelUid: null, focus: null, t: 0, dur: 0, cost: 0, fromBay: null });
    if (!m) return;
    m.level = Math.min(NG.MAX_LEVEL, m.level + 1);
    if (focus) m.aff[focus] = Math.min(2.5, Math.round((m.aff[focus] + 0.12) * 100) / 100);
    let back = null;
    if (from != null) {
      const b = s.bays[from];
      const T = NG.MODEL_MAP[m.type];
      if (b.unlocked && !b.modelUid && NG.computeUsed(s) + T.compute <= NG.computeCap(s)) {
        b.modelUid = m.uid; b.progress = 0; back = from;
      }
    }
    emit('trained', { m, pod: pi, back, focus });
  }

  function marketEvent(s) {
    const jobs = NG.JOBS.filter(j => NG.jobUnlocked(s, j) && j.id !== 'moonshot');
    const r = Math.random();
    if (r < 0.12) {
      s.surgeUntil = s.time + 25;
      emit('market', { kind: 'surge' });
    } else if (jobs.length) {
      const j = jobs[(Math.random() * jobs.length) | 0];
      const boom = r < 0.8;
      s.market[j.id] = { mult: boom ? 2 : 0.6, until: s.time + 45 };
      emit('market', { kind: boom ? 'boom' : 'slump', job: j });
    }
    s.nextEventAt = s.time + 50 + Math.random() * 50;
  }

  function checkGoals(s) {
    for (const g of NG.GOALS) {
      if (s.goalsDone[g.id] || !g.check(s)) continue;
      s.goalsDone[g.id] = true;
      s.cash += g.reward;
      emit('goal', g);
    }
  }

  NG.tick = function (s, dt) {
    s.time += dt;

    for (let i = 0; i < s.bays.length; i++) {
      const b = s.bays[i];
      if (!b.unlocked || !b.modelUid || !b.jobId) continue;
      const m = NG.getModel(s, b.modelUid);
      if (!m) { b.modelUid = null; continue; }
      const job = NG.JOB_MAP[b.jobId];
      const c = NG.calcJob(s, m, job);
      b.progress += dt / c.dur;
      let guard = 0;
      while (b.progress >= 1 && guard++ < 50) {
        b.progress -= 1;
        completeJob(s, i, m, job, c);
      }
      if (b.progress >= 1) b.progress = 0;
    }

    for (let i = 0; i < s.pods.length; i++) {
      const p = s.pods[i];
      if (!p.modelUid) continue;
      p.t += dt;
      if (p.t >= p.dur) finishTraining(s, i);
    }

    for (const k in s.market) if (s.market[k].until <= s.time) delete s.market[k];
    if (s.time >= s.nextEventAt) marketEvent(s);

    // net earnings history in 2s buckets → wall chart + $/s readout
    s.bucketT += dt;
    if (s.bucketT >= 2) {
      s.netHistory.push(s.bucket / s.bucketT);
      if (s.netHistory.length > 60) s.netHistory.shift();
      s.bucket = 0; s.bucketT = 0;
      const recent = s.netHistory.slice(-15);
      s.earnRate = recent.reduce((a, b) => a + b, 0) / recent.length;
    }

    checkGoals(s);
  };

  // Simulate time spent away. Up to an hour is simulated exactly; beyond that the garage
  // earns at half its recent rate (capped at 8h).
  NG.catchUp = function (s, secs) {
    if (!(secs > 1)) return { secs: 0, gained: 0 };
    const startCash = s.cash;
    NG.bus.muted = true;
    try {
      const exact = Math.min(secs, 3600);
      for (let t = 0; t < exact; t += 0.5) NG.tick(s, 0.5);
      const rest = Math.min(secs, 8 * 3600) - exact;
      if (rest > 0 && s.earnRate > 0) {
        const bonus = s.earnRate * rest * 0.5;
        s.cash += bonus;
        s.totalEarned += bonus;
      }
    } finally { NG.bus.muted = false; }
    return { secs, gained: s.cash - startCash };
  };
})(window.NG);
