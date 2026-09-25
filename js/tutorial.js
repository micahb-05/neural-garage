/* tutorial.js — Pip's guided walkthrough. Each step highlights a UI element and/or points an
   arrow into the garage, and advances when its condition is met (or on NEXT). */
'use strict';
(function (NG) {
  const pico = s => s.models.find(m => m.type === 'pico') || s.models[0];

  const STEPS = [
    {
      text: 'This is BAY 1. The little drone at the desk is PICO, Wren\'s old model, and it\'s writing blog posts for a few bucks each. Click the bay 3 times to push the job along.',
      world: () => ({ x: 42, y: 66 }),
      done: s => s.tut.boosts >= 3
    },
    {
      text: 'Nice! Every finished job pays out and drops a crate on the conveyor. Now let\'s get PICO some help. Open the MODELS tab.',
      el: () => '[data-tab="models"]',
      done: () => NG.ui.tab === 'models'
    },
    {
      text: 'Hire SCRIBE-3B. It\'s a writer, and blog posts are WRITE jobs. New hires move straight into a free bay.',
      el: () => NG.ui.tab === 'models' ? '[data-act="hire:scribe"]' : '[data-tab="models"]',
      done: s => s.models.some(m => m.type === 'scribe')
    },
    {
      text: 'See it walk in the door? Every model you hire gets a robot body. It works at its desk and wanders off to fiddle with things around the garage. Now open BAYS and select BAY 2.',
      el: () => NG.ui.tab === 'bays' ? '[data-act="selbay:1"]' : '[data-tab="bays"]',
      world: () => ({ x: 110, y: 66 }),
      done: () => NG.ui.tab === 'bays' && NG.ui.selectedBay === 1
    },
    {
      text: 'This is the contract list. $/s is profit after the model\'s running cost. Q is the model\'s quality against the client\'s bar; under the bar, clients reject work. The green BEST tag marks your most profitable pick.',
      el: () => NG.ui.tab === 'bays' ? '.jobs' : '[data-tab="bays"]',
      next: true
    },
    {
      text: 'Training makes a model faster and sharper. Open TRAIN and give PICO a +WRITE session. It leaves its desk for a pod and comes back when it\'s done.',
      el: s => NG.ui.tab === 'train' && pico(s) ? '[data-act="train:' + pico(s).uid + ':write"]' : '[data-tab="train"]',
      world: () => ({ x: 210, y: 146 }),
      done: s => s.pods.some(p => p.modelUid) || s.models.some(m => m.level >= 2)
    },
    {
      text: 'While that runs: UPGRADES is where your money goes. Server Racks add compute, and every model needs some. GPUs make everyone faster, and new workbays hold more models.',
      el: () => '[data-tab="upgrades"]',
      next: true
    },
    {
      text: 'Last thing. GOALS pay bonus cash, and STORY keeps Wren\'s notebook pages as you find them. The garage keeps working while you\'re away. The ? button up top has the full manual. Go make Wren proud, boss!',
      el: () => '[data-tab="story"]',
      next: true
    }
  ];

  let el = null, lastStep = -1, lastHl = null, lastSel = '', scrolledFor = '';

  function build() {
    el = document.getElementById('coach');
    el.innerHTML =
      '<img class="coach-pip" alt="" src="' + NG.px.spriteURL('pip', '#d9782b', 4) + '">' +
      '<div class="coach-body"><div class="coach-head"><b>PIP</b><span id="coach-count"></span></div>' +
      '<div id="coach-text"></div><div class="coach-btns">' +
      '<button class="btn ghost" data-c="skip">SKIP TUTORIAL</button>' +
      '<button class="btn gold" data-c="next" id="coach-next">NEXT ▸</button></div></div>';
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-c]');
      if (!b) return;
      NG.audio.click();
      if (b.dataset.c === 'skip') T.finish(true);
      else T.advance();
    });
  }

  const T = NG.tutorial = {
    steps: STEPS,
    active(s) { return !!(s.tut && s.tut.active); },
    current(s) { return T.active(s) ? STEPS[s.tut.step] : null; },
    worldTarget(s) {
      const st = T.current(s);
      if (!st || !st.world || T.blocked()) return null;
      return st.world(s);
    },
    // the tutorial waits while a story scene or modal is on screen
    blocked() { return !document.getElementById('modal').hidden; },
    advance() {
      const s = NG.game();
      s.tut.step++;
      if (s.tut.step >= STEPS.length) T.finish(false);
      else NG.audio.alert();
    },
    finish(skipped) {
      const s = NG.game();
      s.tut.active = false;
      clearHl();
      el.hidden = true;
      NG.ui.toast(skipped ? 'Tutorial skipped. The ? button has the full manual.' : 'Tutorial complete! Pip is proud of you.', 'gold');
    },
    restart() {
      const s = NG.game();
      s.tut = { active: true, step: 0, boosts: 0 };
      lastStep = -1;
    },
    frame(s) {
      if (!el) build();
      const st = T.current(s);
      if (!st || T.blocked()) { el.hidden = true; clearHl(); return; }
      if (st.done && st.done(s)) { T.advance(); return; }
      el.hidden = false;
      if (lastStep !== s.tut.step) {
        lastStep = s.tut.step;
        document.getElementById('coach-text').textContent = st.text;
        document.getElementById('coach-count').textContent = 'TUTORIAL ' + (s.tut.step + 1) + '/' + STEPS.length;
        document.getElementById('coach-next').hidden = !st.next;
      }
      const sel = st.el ? st.el(s) : '';
      const target = sel ? document.querySelector(sel) : null;
      if (target !== lastHl) { clearHl(); if (target) { target.classList.add('tut-hl'); lastHl = target; } }
      const key = s.tut.step + sel;
      if (target && scrolledFor !== key && target.closest('#panel-body')) { scrolledFor = key; target.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
      lastSel = sel;
    }
  };
  function clearHl() { if (lastHl) lastHl.classList.remove('tut-hl'); lastHl = null; }
})(window.NG);
