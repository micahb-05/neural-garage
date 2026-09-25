/* main.js — boot, fixed-step sim loop, canvas scaling & input, autosave, offline catch-up. */
'use strict';
(function (NG) {
  const STEP = 0.1;
  let S = null;
  let canvas, stage, scale = 1;

  function fit() {
    const r = stage.getBoundingClientRect();
    let sc = Math.min(r.width / NG.world.W, r.height / NG.world.H);
    // prefer whole-number scaling for crisp pixels unless it wastes too much space
    if (sc >= 1 && Math.floor(sc) / sc > 0.82) sc = Math.floor(sc);
    scale = Math.max(0.5, sc);
    canvas.style.width = Math.floor(NG.world.W * scale) + 'px';
    canvas.style.height = Math.floor(NG.world.H * scale) + 'px';
  }

  function toWorld(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * NG.world.W, y: (e.clientY - r.top) / r.height * NG.world.H };
  }

  function offlineReport(res) {
    if (!res || res.secs < 60) return;
    NG.ui.modal('WHILE YOU WERE AWAY',
      '<p>The garage kept running for <b>' + NG.fmtTime(res.secs) + '</b>.</p><p>Net change: <b class="' + (res.gained >= 0 ? 'gold' : 'red') + '">' +
      (res.gained < 0 ? '-$' : '$') + NG.fmt(Math.abs(res.gained)) + '</b></p>' +
      (res.secs > 3600 ? '<p class="dim">Time past the first hour earns at half rate (8h max).</p>' : ''), 'NICE');
  }

  NG.resetGame = function () {
    NG.wipe();
    S = NG.newState();
    NG.world.reset();
    NG.ui.resetStory();
    NG.ui.selectedBay = 0;
    NG.ui.setState(S);
    NG.ui.syncMute();
    NG.ui.setTab('bays');
    NG.save(S);
  };
  NG.game = () => S;

  // swap in a loaded save (from a save file) as the running game
  NG.loadGame = function (loaded) {
    S = loaded;
    S.lastSave = Date.now();
    NG.world.reset();
    NG.ui.resetStory();
    NG.ui.setState(S);
    NG.ui.syncMute();
    NG.ui.setTab('bays');
    NG.save(S);
  };

  function boot() {
    canvas = document.getElementById('world');
    stage = document.getElementById('stage');
    const loaded = NG.load();
    S = loaded || NG.newState();

    NG.world.init(canvas);
    NG.ui.init(S);
    NG.ui.setState(S);

    if (loaded) offlineReport(NG.catchUp(S, (Date.now() - S.lastSave) / 1000));

    fit();
    window.addEventListener('resize', fit);
    if (window.ResizeObserver) new ResizeObserver(fit).observe(stage);

    window.addEventListener('pointerdown', () => NG.audio.init(), { passive: true });
    canvas.addEventListener('click', e => {
      const p = toWorld(e);
      const h = NG.world.hit(p.x, p.y);
      if (!h) return;
      if (h.type === 'walker') {
        NG.audio.click();
        if (h.id === 'pip') {
          const q = NG.PIP_QUIPS[(Math.random() * NG.PIP_QUIPS.length) | 0];
          NG.ui.toast('PIP: ' + (typeof q === 'function' ? q(S) : q), 'cyan');
          NG.world.poke('pip', '!');
        } else {
          const info = NG.world.walkerInfo(h.id);
          NG.world.poke(h.id, ['HI!', 'BEEP', 'BUSY!', ':)'][(Math.random() * 4) | 0]);
          if (info && info.home) { NG.ui.selectedBay = info.home.bay; NG.ui.setTab('bays'); }
        }
      } else if (h.type === 'bay') {
        NG.ui.selectedBay = h.i;
        NG.ui.showSwap = false;
        NG.ui.setTab('bays');
        if (NG.ops.boost(S, h.i).ok) {
          NG.world.boostFx(h.i); NG.audio.boost();
          if (S.tut && S.tut.active) S.tut.boosts = (S.tut.boosts || 0) + 1;
        }
      } else if (h.type === 'pod') NG.ui.setTab('train');
      else if (h.type === 'rack') NG.ui.setTab('upgrades');
      else if (h.type === 'core') NG.ui.setTab('story');
      else NG.ui.setTab('goals');
    });
    canvas.addEventListener('mousemove', e => {
      const p = toWorld(e);
      const h = NG.world.hit(p.x, p.y);
      NG.world.setHover(h);
      canvas.style.cursor = h ? 'pointer' : 'default';
      NG.ui.tip(h, e.clientX, e.clientY);
    });
    canvas.addEventListener('mouseleave', () => { NG.world.setHover(null); NG.ui.tip(null); });

    // keep simulating while the tab is hidden (rAF pauses), then save
    let hiddenAt = 0;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { hiddenAt = Date.now(); NG.save(S); }
      else if (hiddenAt) { offlineReport(NG.catchUp(S, (Date.now() - hiddenAt) / 1000)); hiddenAt = 0; last = performance.now(); }
    });
    window.addEventListener('beforeunload', () => NG.save(S));
    setInterval(() => NG.save(S), 5000);

    let last = performance.now(), acc = 0;
    function frame(now) {
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      acc += dt;
      while (acc >= STEP) { NG.tick(S, STEP); acc -= STEP; }
      NG.world.draw(S, now / 1000, dt);
      NG.ui.frame(dt);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    NG.debug = { get state() { return S; } };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.NG);
