/* ui.js — HUD, side panels (bays / models / training / upgrades / goals), toasts, modal, tooltip.
   Panels are rendered as HTML strings; the DOM is only replaced when the markup changes. */
'use strict';
(function (NG) {
  const P = NG.px;
  const ui = NG.ui = { tab: 'bays', selectedBay: 0, trainFocus: null, showSwap: false, confirmReset: false };
  let S = null, body = null, lastHtml = '', holding = false, renderT = 0;
  const el = {};

  const money = n => (n < 0 ? '-$' : '$') + NG.fmt(Math.abs(n));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function btn(label, act, o) {
    o = o || {};
    return '<button class="btn ' + (o.cls || '') + '" data-act="' + act + '"' + (o.dis ? ' disabled' : '') +
      (o.style ? ' style="' + o.style + '"' : '') + '>' + label + '</button>';
  }
  const chip = k => '<span class="chip" style="--c:' + NG.SKILL_META[k].color + '">' + NG.SKILL_META[k].label + '</span>';
  const chips = skills => Object.keys(skills).sort((a, b) => skills[b] - skills[a]).map(chip).join('');
  const spriteImg = (typeId, cls) => {
    const T = NG.MODEL_MAP[typeId];
    return '<img class="spr ' + (cls || '') + ' t' + T.tier + '" src="' + P.spriteURL(P.spriteKind(T.tier), T.color) + '" alt="">';
  };
  function statusTag(m) {
    const w = NG.whereIs(S, m.uid);
    if (w.kind === 'bay') return '<span class="tag cyan">BAY ' + (w.i + 1) + '</span>';
    if (w.kind === 'pod') return '<span class="tag gold">TRAINING</span>';
    return '<span class="tag dim">IDLE</span>';
  }
  function affBars(m) {
    return '<div class="aff">' + NG.SKILLS.map(k =>
      '<div class="affr"><span>' + NG.SKILL_META[k].label + '</span><i><b style="width:' + Math.min(100, m.aff[k] / 2 * 100) +
      '%;background:' + NG.SKILL_META[k].color + '"></b></i><em>' + m.aff[k].toFixed(2) + '</em></div>').join('') + '</div>';
  }
  function bestAt(T) {
    const vals = NG.SKILLS.map(k => T.aff[k]);
    const max = Math.max(...vals), min = Math.min(...vals);
    if (max - min < 0.05) return 'ALL-ROUNDER';
    return NG.SKILLS.filter(k => T.aff[k] >= max - 0.01).map(k => NG.SKILL_META[k].label).join(' + ');
  }

  /* ---------- views ---------- */
  const views = {};

  views.bays = function () {
    const i = ui.selectedBay, b = S.bays[i];
    const used = NG.computeUsed(S), cap = NG.computeCap(S);
    let h = '<div class="sec"><div class="sec-head"><h3>BAY ' + (i + 1) + '</h3><span class="dim small">COMPUTE ' + used + '/' + cap + '</span></div>';
    if (!b.unlocked) {
      const next = NG.nextLockedBay(S);
      if (next === i) {
        const cost = NG.BAY_COSTS[i];
        h += '<p class="dim">An empty corner of the garage. Run power and fiber to it and it can host another model.</p>' +
          btn('UNLOCK BAY — ' + money(cost), 'unlockbay:' + i, { dis: S.cash < cost, cls: 'gold wide' });
      } else h += '<p class="dim">Unlock BAY ' + (next + 1) + ' first.</p>';
    } else {
      const m = b.modelUid ? NG.getModel(S, b.modelUid) : null;
      const cand = S.models.filter(x => x.uid !== b.modelUid && NG.whereIs(S, x.uid).kind !== 'pod');
      if (m) {
        const T = NG.MODEL_MAP[m.type];
        h += '<div class="card"><div class="card-top">' + spriteImg(m.type) + '<div class="grow"><div class="name">' + esc(m.name) +
          ' <span class="lv">LV ' + m.level + '</span></div><div class="dim small">TIER ' + T.tier + ' · ' + T.compute + ' COMPUTE · ' +
          money(T.cps * NG.costMult(S)) + '/S RUN COST</div></div></div><div class="btns">' +
          (cand.length ? btn(ui.showSwap ? 'HIDE SWAP' : 'SWAP MODEL', 'toggleswap', { cls: 'ghost' }) : '') +
          btn('TRAIN', 'gotrain:' + m.uid, { cls: 'ghost', dis: m.level >= NG.MAX_LEVEL }) +
          btn('REMOVE', 'unassign:' + i, { cls: 'ghost red' }) + '</div></div>';
        if (ui.showSwap && cand.length) h += cand.map(x => assignRow(i, x)).join('');
      } else {
        h += '<p class="dim">No model in this bay.</p>';
        if (!cand.length) h += '<p class="dim small">No free models. Hire one in the MODELS tab.</p>' + btn('GO TO MODELS', 'tab:models', { cls: 'ghost' });
        else h += cand.map(x => assignRow(i, x)).join('');
      }
      h += '<div class="sec-head"><h3>CONTRACT</h3><span class="dim small">' + (m ? 'net $/s after run cost' : 'base pay per job') + '</span></div>';
      h += jobList(i, b, m);
    }
    h += '</div><div class="sec"><div class="sec-head"><h3>ALL BAYS</h3><span class="dim small">click a working bay in the garage to boost it</span></div>' +
      S.bays.map(bayRow).join('') + '</div>';
    return h;
  };

  function assignRow(bi, x) {
    const T = NG.MODEL_MAP[x.type];
    const w = NG.whereIs(S, x.uid);
    const b = S.bays[bi];
    const cur = b.modelUid ? NG.MODEL_MAP[NG.getModel(S, b.modelUid).type].compute : 0;
    const free = NG.computeCap(S) - NG.computeUsed(S) + cur + (w.kind === 'bay' ? T.compute : 0);
    const fits = T.compute <= free;
    const job = b.jobId ? NG.JOB_MAP[b.jobId] : NG.bestJob(S, x);
    const c = NG.calcJob(S, x, job);
    return '<div class="row">' + spriteImg(x.type, 'sm') + '<div class="grow"><div>' + esc(x.name) + ' <span class="lv">LV ' + x.level + '</span> ' +
      statusTag(x) + '</div><div class="dim small">' + T.compute + ' CMP · ≈' + money(c.perSec) + '/s on ' + job.name + '</div></div>' +
      btn(fits ? (w.kind === 'bay' ? 'MOVE' : 'ASSIGN') : 'NO CMP', 'assign:' + bi + ':' + x.uid, { dis: !fits, cls: fits ? 'cyan' : '' }) + '</div>';
  }

  function jobList(i, b, m) {
    const open = NG.JOBS.filter(j => NG.jobUnlocked(S, j));
    const locked = NG.JOBS.filter(j => !NG.jobUnlocked(S, j)).slice(0, 2);
    let best = null;
    if (m) best = NG.bestJob(S, m).id;
    let h = '<div class="jobs">';
    for (const j of open) {
      const d = NG.demand(S, j.id);
      const dem = d > 1 ? '<span class="tag gold">DEMAND X' + d + '</span>' : d < 1 ? '<span class="tag red">SLUMP X' + d + '</span>' : '';
      let est;
      if (m) {
        const c = NG.calcJob(S, m, j);
        est = '<b class="' + (c.perSec >= 0 ? 'gold' : 'red') + '">' + money(c.perSec) + '/s</b> <span class="' + (c.reject > 0 ? 'red' : 'dim') + '">Q' +
          Math.round(c.q) + '/' + j.qReq + '</span><span class="dim"> · ' + NG.fmtTime(c.dur) + '</span>' +
          (c.reject > 0 ? ' <span class="red">· ' + Math.round(c.reject * 100) + '% REJECT</span>' : '') +
          (best === j.id ? ' <span class="tag green">BEST</span>' : '');
      } else est = '<span class="dim">' + money(j.pay) + ' / job · needs Q' + j.qReq + '</span>';
      h += '<button class="job' + (b.jobId === j.id ? ' on' : '') + '" data-act="setjob:' + i + ':' + j.id + '"><div class="jl"><span class="jn">' +
        j.name + '</span>' + dem + '</div><div class="jc">' + chips(j.skills) + '</div><div class="je">' + est + '</div></button>';
    }
    for (const j of locked) h += '<div class="job locked"><div class="jl"><span class="jn">' + j.name + '</span><span class="dim small">REP ' + j.rep + '</span></div><div class="jc">' + chips(j.skills) + '</div></div>';
    return h + '</div>';
  }

  function bayRow(b, i) {
    const sel = ui.selectedBay === i ? ' sel' : '';
    if (!b.unlocked) {
      const next = NG.nextLockedBay(S) === i;
      return '<div class="row click' + sel + '" data-act="selbay:' + i + '"><span class="bn">BAY ' + (i + 1) + '</span><span class="grow dim">LOCKED' +
        (next ? ' — ' + money(NG.BAY_COSTS[i]) : '') + '</span></div>';
    }
    const m = b.modelUid ? NG.getModel(S, b.modelUid) : null;
    const job = b.jobId ? NG.JOB_MAP[b.jobId] : null;
    const rate = m && job ? NG.calcJob(S, m, job).perSec : null;
    return '<div class="row click' + sel + '" data-act="selbay:' + i + '"><span class="bn">BAY ' + (i + 1) + '</span><span class="grow">' +
      (m ? esc(m.name) + ' <span class="lv">L' + m.level + '</span>' : '<span class="dim">EMPTY</span>') +
      '<br><span class="dim small">' + (job ? job.name : '—') + '</span></span><span class="' + (rate != null && rate < 0 ? 'red' : 'gold') + '">' +
      (rate != null ? money(rate) + '/s' : '') + '</span></div>';
  }

  views.models = function () {
    let h = '<div class="sec"><div class="sec-head"><h3>ROSTER</h3><span class="dim small">' + S.models.length + ' MODELS · COMPUTE ' +
      NG.computeUsed(S) + '/' + NG.computeCap(S) + '</span></div>';
    h += S.models.length ? S.models.map(rosterCard).join('') : '<p class="dim">No models. Hire one below.</p>';
    h += '</div><div class="sec"><div class="sec-head"><h3>MODEL MARKET</h3><span class="dim small">reputation unlocks bigger brains</span></div>';
    let lockedShown = 0;
    for (const T of NG.MODELS) {
      if (NG.modelUnlocked(S, T)) h += marketCard(T);
      else if (lockedShown++ < 2) h += '<div class="card locked"><div class="card-top"><div class="spr-lock">?</div><div class="grow"><div class="name">' +
        T.name + ' <span class="tag">TIER ' + T.tier + '</span></div><div class="dim small">Unlocks at ' + T.rep + ' reputation</div></div></div></div>';
    }
    return h + '</div>';
  };
  function rosterCard(m) {
    const T = NG.MODEL_MAP[m.type];
    const w = NG.whereIs(S, m.uid);
    return '<div class="card"><div class="card-top">' + spriteImg(m.type) + '<div class="grow"><div class="name">' + esc(m.name) + ' <span class="lv">LV ' + m.level +
      '</span></div><div>' + statusTag(m) + ' <span class="dim small">SPD ' + NG.modelSpeed(m).toFixed(2) + ' · QUAL ' + Math.round(NG.modelQuality(m)) +
      ' · ' + T.compute + ' CMP</span></div></div></div>' + affBars(m) + '<div class="btns">' +
      (w.kind === 'idle' ? btn('DEPLOY', 'deploy:' + m.uid, { cls: 'cyan' }) : '') +
      btn(m.level >= NG.MAX_LEVEL ? 'MAX LV' : 'TRAIN', 'gotrain:' + m.uid, { cls: 'ghost', dis: m.level >= NG.MAX_LEVEL || w.kind === 'pod' }) +
      btn('RETIRE +' + money(T.cost * 0.4), 'sell:' + m.uid, { cls: 'ghost red', dis: w.kind === 'pod' }) + '</div></div>';
  }
  function marketCard(T) {
    return '<div class="card"><div class="card-top">' + spriteImg(T.id) + '<div class="grow"><div class="name">' + T.name + ' <span class="tag">TIER ' + T.tier +
      '</span></div><div class="dim small">' + T.blurb + '</div></div></div><div class="stats small">SPD ' + T.speed + ' · QUAL ' + T.quality + ' · ' + T.compute +
      ' CMP · ' + money(T.cps) + '/s RUN · <span class="cyan">' + bestAt(T) + '</span></div><div class="btns">' +
      btn('HIRE — ' + money(T.cost), 'hire:' + T.id, { dis: S.cash < T.cost, cls: 'gold' }) + '</div></div>';
  }

  views.train = function () {
    const pc = NG.podCount(S);
    let h = '<div class="sec"><div class="sec-head"><h3>TRAINING PODS</h3><span class="dim small">' + pc + '/3 PODS</span></div>' +
      '<p class="dim small">Training adds +1 level (more speed and quality) and sharpens one skill. A model leaves its bay while training and goes back when it finishes.</p>';
    S.pods.forEach((p, i) => {
      if (i >= pc) { h += '<div class="pod locked"><span class="bn">POD ' + (i + 1) + '</span> <span class="dim">— install in UPGRADES</span></div>'; return; }
      if (p.modelUid) {
        const m = NG.getModel(S, p.modelUid);
        const pct = Math.min(100, p.t / p.dur * 100);
        h += '<div class="pod"><div class="row"><span class="bn">POD ' + (i + 1) + '</span><span class="grow">' + esc(m ? m.name : '?') + ' <span class="lv">LV ' +
          (m ? m.level : 0) + ' → ' + (m ? m.level + 1 : 1) + '</span> ' + chip(p.focus) + '</span>' + btn('ABORT', 'canceltrain:' + i, { cls: 'ghost red' }) +
          '</div><div class="bar"><b style="width:' + pct.toFixed(1) + '%;background:' + NG.SKILL_META[p.focus].color + '"></b></div><div class="dim small">' +
          NG.fmtTime(p.dur - p.t) + ' left</div></div>';
      } else h += '<div class="pod"><span class="bn">POD ' + (i + 1) + '</span> <span class="dim">EMPTY — pick a model and focus skill below</span></div>';
    });
    h += '</div>';
    const free = S.pods.some((p, i) => i < pc && !p.modelUid);
    const cands = S.models.filter(m => NG.whereIs(S, m.uid).kind !== 'pod');
    if (ui.trainFocus != null) cands.sort((a, b) => (b.uid === ui.trainFocus) - (a.uid === ui.trainFocus));
    h += '<div class="sec"><div class="sec-head"><h3>CANDIDATES</h3><span class="dim small">' + (free ? 'click a skill to start' : 'all pods busy') + '</span></div>';
    h += cands.length ? cands.map(m => trainCard(m, free)).join('') : '<p class="dim">No models available.</p>';
    return h + '</div>';
  };
  function trainCard(m, free) {
    const hl = ui.trainFocus === m.uid ? ' hl' : '';
    if (m.level >= NG.MAX_LEVEL) {
      return '<div class="card' + hl + '"><div class="card-top">' + spriteImg(m.type, 'sm') + '<div class="grow"><div class="name">' + esc(m.name) +
        ' <span class="lv">LV ' + m.level + '</span></div><div class="dim small">Fully trained.</div></div></div></div>';
    }
    const cost = NG.trainCost(m), time = NG.trainTime(S, m);
    const can = free && S.cash >= cost;
    return '<div class="card' + hl + '"><div class="card-top">' + spriteImg(m.type, 'sm') + '<div class="grow"><div class="name">' + esc(m.name) +
      ' <span class="lv">LV ' + m.level + ' → ' + (m.level + 1) + '</span></div><div class="small">' + statusTag(m) + ' <span class="gold">' + money(cost) +
      '</span> <span class="dim">· ' + NG.fmtTime(time) + '</span></div></div></div><div class="focus">' +
      NG.SKILLS.map(k => btn('+' + NG.SKILL_META[k].label + ' <em>' + m.aff[k].toFixed(2) + '</em>', 'train:' + m.uid + ':' + k,
        { dis: !can, cls: 'skill', style: '--c:' + NG.SKILL_META[k].color })).join('') + '</div></div>';
  }

  views.upgrades = function () {
    let h = '<div class="sec"><div class="sec-head"><h3>GARAGE UPGRADES</h3><span class="dim small">' + money(S.cash) + ' available</span></div>';
    const nb = NG.nextLockedBay(S);
    if (nb >= 0) {
      const cost = NG.BAY_COSTS[nb];
      h += '<div class="card"><div class="row"><div class="grow"><div class="name">Workbay Expansion <span class="lv">' + nb + '/8</span></div>' +
        '<div class="dim small">Wire up another bay so one more model can work.</div><div class="small cyan">BAY ' + (nb + 1) + '</div></div>' +
        btn(money(cost), 'unlockbay:' + nb, { dis: S.cash < cost, cls: 'gold' }) + '</div></div>';
    }
    for (const U of NG.UPGRADES) {
      const l = S.upgrades[U.id], maxed = l >= U.max;
      const eff = U.effect(Math.min(l, U.max - 1));
      const cost = maxed ? 0 : U.cost(l);
      h += '<div class="card"><div class="row"><div class="grow"><div class="name">' + U.name + ' <span class="lv">' + l + '/' + U.max + '</span></div><div class="dim small">' +
        U.desc + '</div><div class="small cyan">' + (maxed ? eff[1] : eff[0] + ' → ' + eff[1]) + '</div></div>' +
        (maxed ? '<span class="tag green">MAXED</span>' : btn(money(cost), 'buy:' + U.id, { dis: S.cash < cost, cls: 'gold' })) + '</div></div>';
    }
    return h + '</div>';
  };

  views.goals = function () {
    const title = NG.titleFor(S.peakRep), next = NG.nextTitle(S.peakRep);
    const prevRep = NG.TITLES.filter(t => t[0] <= S.peakRep).pop()[0];
    const pct = next ? (S.peakRep - prevRep) / (next.rep - prevRep) * 100 : 100;
    let h = '<div class="sec"><div class="sec-head"><h3>REPUTATION</h3><span class="dim small">' + Math.floor(S.rep) + ' REP</span></div>' +
      '<div class="title-big">' + title + '</div><div class="bar"><b style="width:' + pct.toFixed(1) + '%"></b></div><div class="dim small">' +
      (next ? 'Next: ' + next.name + ' at ' + next.rep + ' rep' : 'Top of the food chain.') + '</div></div>';
    h += '<div class="sec"><div class="sec-head"><h3>GOALS</h3><span class="dim small">' + Object.keys(S.goalsDone).length + '/' + NG.GOALS.length + '</span></div>';
    let pending = 0;
    for (const g of NG.GOALS) {
      const done = !!S.goalsDone[g.id];
      if (!done && pending++ >= 4) continue;
      h += '<div class="goal' + (done ? ' done' : '') + '"><span class="ck">' + (done ? '✓' : '○') + '</span><span class="grow">' + g.text + '</span>' +
        (g.reward ? '<span class="' + (done ? 'dim' : 'gold') + '">+' + money(g.reward) + '</span>' : '<span class="gold">★</span>') + '</div>';
    }
    h += '</div>';
    const play = Math.floor((Date.now() - S.created) / 1000);
    h += '<div class="sec"><div class="sec-head"><h3>STATS</h3></div><div class="statgrid">' +
      '<span>Total earned</span><b>' + money(S.totalEarned) + '</b>' +
      '<span>Jobs shipped</span><b>' + S.jobsDone.toLocaleString('en-US') + '</b>' +
      '<span>Jobs rejected</span><b>' + S.rejects.toLocaleString('en-US') + '</b>' +
      '<span>Models on staff</span><b>' + S.models.length + '</b>' +
      '<span>Garage age</span><b>' + NG.fmtTime(play) + '</b></div></div>';
    h += '<div class="sec"><div class="sec-head"><h3>SYSTEM</h3></div><div class="btns">' + btn('SAVE / LOAD', 'savemenu', { cls: 'ghost' }) +
      btn('REPLAY TUTORIAL', 'tutorial', { cls: 'ghost' }) + btn('HOW TO PLAY', 'help', { cls: 'ghost' }) +
      btn(ui.confirmReset ? 'CONFIRM — WIPE SAVE?' : 'RESET GAME', 'reset', { cls: 'ghost red' }) + '</div></div>';
    return h;
  };

  views.story = function () {
    const seen = S.storySeen;
    const pct = seen.length / NG.STORY.length * 100;
    let h = '<div class="sec"><div class="sec-head"><h3>THE CALLOWAY FILES</h3><span class="dim small">' + seen.length + '/' + NG.STORY.length + ' CHAPTERS</span></div>' +
      '<p class="dim small">Aunt Wren left you a garage, a robot named Pip, and a mystery. Grow the garage and the story comes out.</p>' +
      '<div class="small gold">LANTERN CORE CHARGE</div><div class="bar amber"><b style="width:' + pct.toFixed(1) + '%"></b></div></div>';
    h += '<div class="sec">';
    NG.STORY.forEach((c, i) => {
      if (seen.indexOf(c.id) >= 0) {
        const first = c.lines[0][1];
        h += '<div class="row click chapter" data-act="replay:' + c.id + '"><span class="bn">CH ' + (i + 1) + '</span><span class="grow"><span class="ctitle">' + c.title +
          '</span><br><span class="dim small">' + esc(first.length > 72 ? first.slice(0, 70) + '…' : first) + '</span></span><span class="dim small">REPLAY</span></div>';
      } else {
        h += '<div class="row chapter locked"><span class="bn">CH ' + (i + 1) + '</span><span class="grow dim">??? <span class="small">— keep growing the garage</span></span></div>';
      }
    });
    return h + '</div>';
  };

  /* ---------- story scenes ---------- */
  const storyQueue = [];
  let sceneOpen = false;
  ui.checkStory = function () {
    if (!S) return;
    for (const c of NG.STORY) {
      if (S.storySeen.indexOf(c.id) >= 0 || storyQueue.indexOf(c.id) >= 0) continue;
      if (c.when(S)) storyQueue.push(c.id);
    }
    if (!storyQueue.length || !el.modal.hidden) return;
    if (NG.tutorial.active(S) && storyQueue[0] !== 'prologue') return;
    const id = storyQueue.shift();
    if (S.storySeen.indexOf(id) < 0) S.storySeen.push(id);
    ui.playScene(id, false);
  };
  ui.resetStory = function () { storyQueue.length = 0; };

  function portrait(who) {
    if (who === 'pip') return '<img class="portrait" alt="" src="' + P.spriteURL('pip', '#d9782b', 5) + '">';
    if (who === 'wren') return '<div class="portrait note">✎</div>';
    if (who === 'vale') return '<div class="portrait vale"><span>◆</span></div>';
    return '';
  }
  ui.playScene = function (id, replay) {
    const c = NG.STORY_MAP[id];
    if (!c) return;
    const num = NG.STORY.indexOf(c) + 1;
    let i = 0, typer = null, full = '', shown = 0;
    sceneOpen = true;
    const finishTyping = () => { clearInterval(typer); typer = null; const p = el.modal.querySelector('.say p'); if (p) p.textContent = full; };
    const close = () => {
      finishTyping();
      el.modal.hidden = true; sceneOpen = false;
      document.removeEventListener('keydown', onKey);
      if (id === 'ending') NG.audio.level();
    };
    const step = () => {
      if (typer) { finishTyping(); return; }
      NG.audio.click();
      i++;
      if (i >= c.lines.length) close(); else render();
    };
    const onKey = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); step(); } };
    function render() {
      const [who, text] = c.lines[i];
      const sp = NG.SPEAKERS[who];
      el.modal.innerHTML = '<div class="scene"><div class="scene-title">CHAPTER ' + num + ' · ' + c.title.toUpperCase() + '</div>' +
        '<div class="line ' + who + '">' + portrait(who) + '<div class="say">' +
        (sp.name ? '<div class="who">' + sp.name + ' <span>' + sp.role + '</span></div>' : '') + '<p></p></div></div>' +
        '<div class="scene-foot"><span class="dim small">' + (i + 1) + '/' + c.lines.length + ' · click or press Enter</span>' +
        '<button class="btn gold" id="snext">' + (i < c.lines.length - 1 ? 'NEXT ▸' : replay ? 'CLOSE' : 'CONTINUE') + '</button></div></div>';
      el.modal.hidden = false;
      full = text; shown = 0;
      const p = el.modal.querySelector('.say p');
      clearInterval(typer);
      typer = setInterval(() => {
        shown = Math.min(full.length, shown + 2);
        p.textContent = full.slice(0, shown);
        if (shown >= full.length) { clearInterval(typer); typer = null; }
      }, 16);
      el.modal.querySelector('.scene').onclick = step;
    }
    el.modal.onclick = null;
    document.addEventListener('keydown', onKey);
    render();
  };

  /* ---------- save / load ---------- */
  function saveSummary(s) {
    const played = NG.fmtTime((s.lastSave - s.created) / 1000);
    return '<div class="save-card"><div class="name">' + NG.titleFor(s.peakRep) + '</div><div class="statgrid small">' +
      '<span>Cash</span><b class="gold">' + money(s.cash) + '</b>' +
      '<span>Reputation</span><b>' + Math.floor(s.rep).toLocaleString('en-US') + '</b>' +
      '<span>Models</span><b>' + s.models.length + '</b>' +
      '<span>Bays</span><b>' + s.bays.filter(b => b.unlocked).length + '/8</b>' +
      '<span>Story</span><b>' + s.storySeen.length + '/' + NG.STORY.length + ' chapters</b>' +
      '<span>Garage age</span><b>' + played + '</b></div></div>';
  }
  function downloadSave() {
    NG.save(S);
    const blob = new Blob([NG.exportSave(S)], { type: 'application/json' });
    const a = document.createElement('a');
    const d = new Date();
    const stamp = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') +
      '_' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0');
    a.href = URL.createObjectURL(blob);
    a.download = 'neural-garage-save_' + stamp + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    ui.toast('Save file downloaded — check your Downloads folder', 'ok');
  }
  function pickSaveFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { ui.saveMenu('That file is too big to be a Neural Garage save.'); return; }
      file.text().then(text => {
        const loaded = NG.importSave(text);
        if (!loaded) { ui.saveMenu('"' + esc(file.name) + '" isn\'t a valid Neural Garage save file.'); return; }
        confirmLoad(loaded, file.name);
      }, () => ui.saveMenu('Could not read that file.'));
    };
    input.click();
  }
  function confirmLoad(loaded, fileName) {
    el.modal.innerHTML = '<div class="mbox"><h2>LOAD THIS SAVE?</h2><div class="mbody"><p class="dim small">' + esc(fileName) + '</p>' +
      saveSummary(loaded) + '<p class="red small">This replaces the garage you have open now. Download a save file first if you want to keep it.</p>' +
      '</div><div class="btns"><button class="btn gold" data-s="doload">LOAD IT</button><button class="btn ghost" data-s="menu">CANCEL</button></div></div>';
    el.modal.hidden = false;
    el.modal.onclick = e => {
      const b = e.target.closest('[data-s]');
      if (!b) return;
      NG.audio.click();
      el.modal.onclick = null;
      if (b.dataset.s === 'doload') {
        el.modal.hidden = true;
        NG.loadGame(loaded);
        ui.toast('Save loaded. Welcome back, boss.', 'gold');
        NG.audio.level();
      } else ui.saveMenu();
    };
  }
  ui.saveMenu = function (error) {
    const ago = Math.round((Date.now() - S.lastSave) / 1000);
    el.modal.innerHTML = '<div class="mbox"><h2>SAVE / LOAD</h2><div class="mbody">' +
      (error ? '<p class="red">' + error + '</p>' : '') +
      '<p class="dim small">Autosave is on. Your garage saves to this browser every 5 seconds (last save: ' +
      (ago < 2 ? 'just now' : NG.fmtTime(ago) + ' ago') + ').</p>' + saveSummary(S) +
      '<div class="save-btns"><button class="btn cyan wide" data-s="save">SAVE NOW</button>' +
      '<button class="btn gold wide" data-s="export">DOWNLOAD SAVE FILE</button>' +
      '<button class="btn wide" data-s="import">LOAD SAVE FILE…</button></div>' +
      '<p class="dim small">A save file backs up your garage. Use it to move to another computer or browser, or to hand your garage to a friend.</p>' +
      '</div><button class="btn ghost wide" data-s="close">CLOSE</button></div>';
    el.modal.hidden = false;
    el.modal.onclick = e => {
      const b = e.target.closest('[data-s]');
      if (!b) return;
      NG.audio.init(); NG.audio.click();
      const a = b.dataset.s;
      if (a === 'close') { el.modal.hidden = true; el.modal.onclick = null; }
      else if (a === 'save') { const ok = NG.save(S); ui.toast(ok ? 'Game saved' : 'Save failed — browser storage is blocked', ok ? 'ok' : 'bad'); ui.saveMenu(); }
      else if (a === 'export') downloadSave();
      else if (a === 'import') pickSaveFile();
    };
  };

  ui.help = function () {
    ui.modal('HOW TO PLAY',
      '<div class="help">' +
      '<h4>THE GOAL</h4><p>Keep Aunt Wren\'s garage alive, grow it into a real AI shop, and finish <b class="gold">Project LANTERN</b>.</p>' +
      '<h4>1 · HIRE</h4><p>Buy AI models in <b class="cyan">MODELS</b>. Each one has <b>speed</b>, <b>quality</b>, five skills (CODE, DESIGN, WRITE, DATA, MEDIA), a <b>compute</b> cost and a running cost per second. Every model gets a robot body that wanders the garage.</p>' +
      '<h4>2 · PUT THEM TO WORK</h4><p>Each <b class="cyan">BAY</b> runs one model on one contract, over and over. Pay goes up with quality and with how well the model\'s skills fit the contract. If quality is under the contract\'s bar (<b>Q</b> number), clients reject work. Big models on tiny contracts lose money to running costs.</p>' +
      '<h4>3 · TRAIN</h4><p>Pods in <b class="cyan">TRAIN</b> add a level (more speed and quality) and sharpen one skill of your choice. The model leaves its bay while it trains, then goes back on its own.</p>' +
      '<h4>4 · UPGRADE</h4><p><b>Server Racks</b> = compute (every deployed model uses some). <b>GPUs</b> = speed. <b>Client Network</b> = pay. <b>Cooling</b> = cheaper running costs. Plus extra pods, a faster training lab, and more workbays.</p>' +
      '<h4>TIPS</h4><p>Click a working bay to push its job along. Watch the wall screen for market events (demand ×2, slumps, GPU surges). <b>Reputation</b> unlocks bigger contracts, better models, and new story chapters. Click Pip to chat. The garage keeps running while you\'re away.</p>' +
      '</div>', 'GOT IT');
  };

  /* ---------- actions ---------- */
  function result(r, sound) {
    if (!r) return;
    if (r.ok) { if (sound) NG.audio[sound](); if (r.msg) ui.toast(r.msg, 'ok'); }
    else { NG.audio.error(); if (r.msg) ui.toast(r.msg, 'bad'); }
  }
  function act(str) {
    const [a, x, y] = str.split(':');
    const O = NG.ops;
    switch (a) {
      case 'tab': ui.setTab(x); break;
      case 'selbay': ui.selectedBay = +x; ui.showSwap = false; break;
      case 'toggleswap': ui.showSwap = !ui.showSwap; break;
      case 'unlockbay': result(O.unlockBay(S, +x), 'buy'); break;
      case 'assign': result(O.assign(S, +x, +y), 'buy'); ui.showSwap = false; break;
      case 'unassign': result(O.unassign(S, +x), 'click'); break;
      case 'setjob': result(O.setJob(S, +x, y), 'click'); break;
      case 'hire': result(O.hire(S, x), 'buy'); break;
      case 'sell': result(O.sell(S, +x), 'click'); break;
      case 'deploy': {
        const bi = S.bays.findIndex(b => b.unlocked && !b.modelUid);
        if (bi < 0) result({ ok: false, msg: 'No empty bay — unlock or clear one first' });
        else { const r = O.assign(S, bi, +x); result(r, 'buy'); if (r.ok) ui.selectedBay = bi; }
        break;
      }
      case 'gotrain': ui.trainFocus = +x; ui.setTab('train'); break;
      case 'train': result(O.train(S, +x, y), 'buy'); ui.trainFocus = null; break;
      case 'canceltrain': result(O.cancelTrain(S, +x), 'click'); break;
      case 'buy': result(O.buy(S, x), 'buy'); break;
      case 'save': {
        const saved = NG.save(S);
        result({ ok: saved, msg: saved ? 'Game saved' : 'Save failed — storage unavailable' }, 'click');
        break;
      }
      case 'replay': ui.playScene(x, true); break;
      case 'help': ui.help(); break;
      case 'savemenu': ui.saveMenu(); break;
      case 'tutorial': NG.tutorial.restart(); ui.setTab('bays'); ui.selectedBay = 0; break;
      case 'reset':
        if (!ui.confirmReset) { ui.confirmReset = true; break; }
        ui.confirmReset = false;
        NG.resetGame();
        break;
    }
    ui.render(true);
  }

  /* ---------- toasts, modal, tooltip ---------- */
  ui.toast = function (msg, kind) {
    const t = document.createElement('div');
    t.className = 'toast ' + (kind || '');
    t.textContent = msg;
    el.toasts.appendChild(t);
    while (el.toasts.children.length > 5) el.toasts.firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 3600);
  };
  ui.modal = function (title, html, label) {
    el.modal.onclick = null;
    el.modal.innerHTML = '<div class="mbox"><h2>' + title + '</h2><div class="mbody">' + html + '</div><button class="btn gold wide" id="mclose">' +
      (label || 'CONTINUE') + '</button></div>';
    el.modal.hidden = false;
    el.modal.querySelector('#mclose').onclick = () => { el.modal.hidden = true; NG.audio.init(); NG.audio.click(); };
  };
  ui.tip = function (h, cx, cy) {
    if (!h) { el.tip.hidden = true; return; }
    let txt = '';
    if (h.type === 'bay') {
      const b = S.bays[h.i];
      if (!b.unlocked) txt = '<b>BAY ' + (h.i + 1) + '</b><br>Locked' + (NG.nextLockedBay(S) === h.i ? ' — ' + money(NG.BAY_COSTS[h.i]) + ' to unlock' : '');
      else {
        const m = b.modelUid ? NG.getModel(S, b.modelUid) : null;
        const job = b.jobId ? NG.JOB_MAP[b.jobId] : null;
        if (m && job) {
          const c = NG.calcJob(S, m, job);
          txt = '<b>BAY ' + (h.i + 1) + ' · ' + esc(m.name) + ' LV' + m.level + '</b><br>' + job.name + ' · ' + money(c.perSec) + '/s · Q' + Math.round(c.q) +
            '<br><span class="dim">click to boost</span>';
        } else txt = '<b>BAY ' + (h.i + 1) + '</b><br>' + (m ? 'No contract set' : 'Empty — click to assign a model');
      }
    } else if (h.type === 'pod') {
      const p = S.pods[h.i];
      if (h.i >= NG.podCount(S)) txt = '<b>TRAINING POD ' + (h.i + 1) + '</b><br>Not installed';
      else if (p.modelUid) { const m = NG.getModel(S, p.modelUid); txt = '<b>POD ' + (h.i + 1) + '</b><br>' + esc(m ? m.name : '') + ' · ' + NG.fmtTime(p.dur - p.t) + ' left'; }
      else txt = '<b>TRAINING POD ' + (h.i + 1) + '</b><br>Idle — click to train a model';
    } else if (h.type === 'rack') txt = '<b>SERVER RACKS</b><br>Compute ' + NG.computeUsed(S) + '/' + NG.computeCap(S) + '<br><span class="dim">click for upgrades</span>';
    else if (h.type === 'screen') txt = '<b>WREN-OS</b><br>Net earnings, last 2 minutes';
    else if (h.type === 'core') {
      const rev = S.storySeen.indexOf('crate') >= 0;
      txt = '<b>' + (rev ? 'LANTERN CORE' : '???') + '</b><br>' + (rev ? "Wren's unfinished project. It glows brighter as the story unfolds." :
        'A strange machine Wren left behind. It hums.') + '<br><span class="dim">click for the story</span>';
    } else if (h.type === 'walker') {
      const info = NG.world.walkerInfo(h.id);
      if (!info) { el.tip.hidden = true; return; }
      txt = '<b>' + esc(info.name) + (h.id === 'pip' ? ' · Repair Unit 7' : '') + '</b><br>' + info.doing +
        (h.id === 'pip' ? '<br><span class="dim">click to chat</span>' : '');
    }
    el.tip.innerHTML = txt;
    el.tip.hidden = false;
    const r = el.stage.getBoundingClientRect();
    let x = cx - r.left + 14, y = cy - r.top + 14;
    if (x + 230 > r.width) x = cx - r.left - 230;
    el.tip.style.left = x + 'px';
    el.tip.style.top = y + 'px';
  };

  /* ---------- lifecycle ---------- */
  ui.setState = function (s) { S = s; lastHtml = ''; ui.render(true); };
  ui.setTab = function (t) {
    const changed = ui.tab !== t;
    ui.tab = t;
    ui.confirmReset = false;
    document.querySelectorAll('.tab').forEach(e => e.classList.toggle('on', e.dataset.tab === t));
    ui.render(true);
    if (changed) body.scrollTop = 0;
  };
  ui.render = function (force) {
    if (!S || (holding && !force)) return;
    const html = views[ui.tab]();
    if (html !== lastHtml) { body.innerHTML = html; lastHtml = html; }
  };
  ui.frame = function (dt) {
    el.cash.textContent = money(S.cash);
    el.cash.classList.toggle('red', S.cash < 0);
    el.rate.textContent = (S.earnRate >= 0 ? '+' : '') + money(S.earnRate) + '/s';
    el.compute.textContent = NG.computeUsed(S) + '/' + NG.computeCap(S);
    el.rep.textContent = Math.floor(S.rep);
    el.title.textContent = NG.titleFor(S.peakRep);
    el.gpu.textContent = 'X' + NG.gpuMult(S).toFixed(2) + (NG.surging(S) ? ' ⚡' : '');
    renderT += dt;
    if (renderT > 0.4) { renderT = 0; ui.render(); ui.checkStory(); }
    NG.tutorial.frame(S);
  };

  ui.init = function (s) {
    S = s;
    body = document.getElementById('panel-body');
    ['cash', 'rate', 'compute', 'rep', 'title', 'gpu'].forEach(k => { el[k] = document.getElementById('hud-' + k); });
    el.toasts = document.getElementById('toasts');
    el.modal = document.getElementById('modal');
    el.tip = document.getElementById('tip');
    el.stage = document.getElementById('stage');
    el.mute = document.getElementById('btn-mute');

    document.getElementById('tabs').addEventListener('click', e => {
      const t = e.target.closest('[data-tab]');
      if (t) { NG.audio.click(); ui.setTab(t.dataset.tab); }
    });
    body.addEventListener('click', e => {
      const b = e.target.closest('[data-act]');
      if (!b || b.disabled) return;
      act(b.dataset.act);
    });
    body.addEventListener('pointerdown', () => { holding = true; });
    window.addEventListener('pointerup', () => { holding = false; });
    window.addEventListener('pointercancel', () => { holding = false; });

    const syncMute = () => { el.mute.textContent = S.muted ? 'SOUND: OFF' : 'SOUND: ON'; NG.audio.muted = S.muted; };
    el.mute.addEventListener('click', () => { S.muted = !S.muted; syncMute(); NG.audio.init(); NG.audio.click(); });
    ui.syncMute = syncMute;
    syncMute();
    document.getElementById('btn-save').addEventListener('click', () => { NG.audio.init(); NG.audio.click(); ui.saveMenu(); });
    document.getElementById('btn-help').addEventListener('click', () => { NG.audio.init(); NG.audio.click(); ui.help(); });

    const B = NG.bus;
    B.on('goal', g => { ui.toast('GOAL: ' + g.text + (g.reward ? '  +' + money(g.reward) : ''), 'gold'); NG.audio.level(); });
    B.on('unlockJob', j => ui.toast('NEW CONTRACT: ' + j.name, 'cyan'));
    B.on('unlockModel', T => { ui.toast('NEW MODEL IN MARKET: ' + T.name, 'cyan'); NG.audio.alert(); });
    B.on('title', t => { ui.toast('PROMOTED: ' + t, 'gold'); NG.audio.level(); });
    B.on('trained', e => {
      ui.toast(e.m.name + ' reached LV ' + e.m.level + (e.back != null ? ' — back in BAY ' + (e.back + 1) : ''), 'ok');
      NG.audio.level();
    });
    B.on('market', e => {
      if (e.kind === 'surge') ui.toast('GPU SURGE: all models 1.5x speed for 25s', 'cyan');
      else if (e.kind === 'boom') ui.toast('MARKET: ' + e.job.name + ' demand x2 for 45s', 'gold');
      else ui.toast('MARKET: ' + e.job.name + ' slumps to x0.6 for 45s', 'bad');
      NG.audio.alert();
    });
    B.on('job', e => { if (e.rejected) NG.audio.reject(); else NG.audio.coin(); });
    B.on('win', () => NG.audio.level());
  };
})(window.NG);
