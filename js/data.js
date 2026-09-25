/* data.js — static game catalogs: skills, AI models, contracts (jobs), upgrades, titles, goals.
   Everything here is plain data; balance tweaks should happen in this file. */
'use strict';
window.NG = window.NG || {};
(function (NG) {
  // tiny event bus shared by sim / world / ui. `muted` suppresses events during offline catch-up.
  NG.bus = {
    l: {}, muted: false,
    on(e, f) { (this.l[e] = this.l[e] || []).push(f); },
    emit(e, d) {
      if (this.muted) return;
      (this.l[e] || []).forEach(f => { try { f(d); } catch (err) { console.error(err); } });
    }
  };

  NG.SKILLS = ['code', 'design', 'write', 'data', 'media'];
  NG.SKILL_META = {
    code:   { label: 'CODE',   color: '#46f08c' },
    design: { label: 'DESIGN', color: '#ff5fa2' },
    write:  { label: 'WRITE',  color: '#f4f1e6' },
    data:   { label: 'DATA',   color: '#ffb640' },
    media:  { label: 'MEDIA',  color: '#9d8bff' }
  };

  function aff(base, o) {
    const a = {};
    for (const s of NG.SKILLS) a[s] = o && o[s] != null ? o[s] : base;
    return a;
  }

  /* AI models you can hire.
     speed   — work units / second at a perfect skill fit
     quality — base output quality (0-100); low quality means lower pay and rejected jobs
     aff     — skill affinity per skill (1.0 = competent)
     compute — server compute the model occupies while it sits in a bay
     cps     — running cost in $ per second while working */
  NG.MODELS = [
    { id: 'pico',     name: 'PICO-1B',      tier: 1, speed: 1.0,  quality: 25, aff: aff(0.6),                                  cost: 100,     compute: 1,  cps: 0.2,  rep: 0,    color: '#9aa6b8', blurb: 'A tiny generalist. Cheap, slow and sloppy. Everyone starts somewhere.' },
    { id: 'scribe',   name: 'SCRIBE-3B',    tier: 1, speed: 1.1,  quality: 35, aff: aff(0.45, { write: 1.3, data: 0.6 }),       cost: 250,     compute: 1,  cps: 0.35, rep: 0,    color: '#e8e2c8', blurb: 'Small language model tuned for copy. Words go brrr.' },
    { id: 'brush',    name: 'BRUSH-DIFF',   tier: 1, speed: 0.9,  quality: 38, aff: aff(0.35, { design: 1.35, media: 0.8 }),    cost: 450,     compute: 2,  cps: 0.5,  rep: 8,    color: '#ff5fa2', blurb: 'A diffusion model that dreams in vectors and pastel gradients.' },
    { id: 'kernel',   name: 'KERNEL-7B',    tier: 2, speed: 1.0,  quality: 45, aff: aff(0.45, { code: 1.4, data: 0.8 }),        cost: 1000,    compute: 2,  cps: 0.9,  rep: 25,   color: '#46f08c', blurb: 'Code model. Reads stack traces for fun.' },
    { id: 'abacus',   name: 'ABACUS-8B',    tier: 2, speed: 1.05, quality: 48, aff: aff(0.5, { data: 1.4, code: 0.75, write: 0.75 }), cost: 1600, compute: 2,  cps: 1.1,  rep: 60,   color: '#ffb640', blurb: 'Spreadsheet whisperer. Finds the signal, then charts it.' },
    { id: 'reel',     name: 'REEL-V2',      tier: 2, speed: 0.95, quality: 50, aff: aff(0.4, { media: 1.45, design: 1.0 }),     cost: 3200,    compute: 3,  cps: 1.8,  rep: 130,   color: '#9d8bff', blurb: 'Video model. Cuts, captions and hooks in the first 2 seconds.' },
    { id: 'polymath', name: 'POLYMATH-34B', tier: 3, speed: 1.3,  quality: 60, aff: aff(1.0, { write: 1.2, code: 1.1 }),        cost: 15000,    compute: 4,  cps: 3.2,  rep: 300,  color: '#3ee8ff', blurb: 'Mid-size generalist that is good at nearly everything.' },
    { id: 'atlas',    name: 'ATLAS-70B',    tier: 3, speed: 1.5,  quality: 70, aff: aff(1.15),                                 cost: 60000,   compute: 6,  cps: 7,    rep: 700,  color: '#ff7a3d', blurb: 'A heavyweight. Carries entire product launches on its back.' },
    { id: 'frontier', name: 'FRONTIER-X',   tier: 4, speed: 2.0,  quality: 82, aff: aff(1.3),                                  cost: 400000,  compute: 10, cps: 24,   rep: 2500,  color: '#7fe9ff', blurb: 'State-of-the-art holographic intelligence. Terrifyingly competent.' },
    { id: 'omega',    name: 'OMEGA',        tier: 5, speed: 3.0,  quality: 95, aff: aff(1.6),                                  cost: 8000000, compute: 20, cps: 110,  rep: 7000, color: '#ffd76a', blurb: 'Nobody is sure what it is. It asked for the job.' }
  ];

  /* Contracts a bay can run on repeat.
     skills — weighting of the skills the job needs (sums to 1)
     work   — work units per job, pay — base payout, rep — reputation needed to unlock,
     qReq — quality bar; output below it risks rejection. Reputation earned scales with work. */
  NG.JOBS = [
    { id: 'blog',     name: 'Blog Posts',          short: 'BLOG POSTS',    skills: { write: 1 },                          work: 10,   pay: 12,     rep: 0,    qReq: 20 },
    { id: 'labels',   name: 'Data Labeling',       short: 'DATA LABELS',   skills: { data: 0.7, write: 0.3 },             work: 12,   pay: 15,     rep: 0,    qReq: 22 },
    { id: 'logos',    name: 'Logo Design',         short: 'LOGOS',         skills: { design: 1 },                         work: 14,   pay: 26,     rep: 8,    qReq: 30 },
    { id: 'bugs',     name: 'Bug Fixes',           short: 'BUG FIXES',     skills: { code: 1 },                           work: 16,   pay: 38,     rep: 25,   qReq: 36 },
    { id: 'prints',   name: 'Print-on-Demand Art', short: 'POD PRINTS',    skills: { design: 0.8, write: 0.2 },           work: 18,   pay: 50,     rep: 50,   qReq: 40 },
    { id: 'thumbs',   name: 'Video Thumbnails',    short: 'THUMBNAILS',    skills: { design: 0.6, media: 0.4 },           work: 22,   pay: 70,     rep: 90,   qReq: 44 },
    { id: 'reports',  name: 'Market Reports',      short: 'REPORTS',       skills: { data: 0.6, write: 0.4 },             work: 30,   pay: 115,    rep: 150,  qReq: 50 },
    { id: 'sites',    name: 'Landing Pages',       short: 'LANDING PAGES', skills: { code: 0.6, design: 0.4 },            work: 40,   pay: 180,    rep: 250,  qReq: 55 },
    { id: 'shorts',   name: 'Short-form Video',    short: 'SHORTS',        skills: { media: 1 },                          work: 50,   pay: 260,    rep: 400,  qReq: 58 },
    { id: 'apps',     name: 'SaaS Apps',           short: 'SAAS APPS',     skills: { code: 0.7, design: 0.15, data: 0.15 }, work: 120, pay: 750,   rep: 1000,  qReq: 65 },
    { id: 'quant',    name: 'Quant Strategies',    short: 'QUANT',         skills: { data: 0.8, code: 0.2 },              work: 150,  pay: 1100,   rep: 2000,  qReq: 70 },
    { id: 'vfx',      name: 'VFX Sequences',       short: 'VFX',           skills: { media: 0.7, design: 0.3 },           work: 300,  pay: 2600,  rep: 4000, qReq: 78 },
    { id: 'moonshot', name: 'Project LANTERN',     short: 'LANTERN',       skills: { code: 0.2, design: 0.2, write: 0.2, data: 0.2, media: 0.2 }, work: 20000, pay: 500000, rep: 10000, qReq: 96 }
  ];

  NG.RACK_CAP = [4, 8, 12, 18, 26, 36, 50, 70, 100, 140, 190, 250];
  NG.BAY_COSTS = [0, 0, 400, 1800, 6000, 20000, 70000, 250000];

  const pct = v => Math.round(v * 100) + '%';
  // effect(l) returns [current, next] display strings
  NG.UPGRADES = [
    { id: 'rack',    name: 'Server Rack',     desc: 'More compute, so more (and bigger) models can run at once.', max: 11,
      cost: l => Math.round(250 * Math.pow(2.2, l)), effect: l => [NG.RACK_CAP[l] + ' COMPUTE', NG.RACK_CAP[l + 1] + ' COMPUTE'] },
    { id: 'gpu',     name: 'GPU Cluster',     desc: 'Every model in the garage works faster.', max: 10,
      cost: l => Math.round(600 * Math.pow(3, l)), effect: l => ['SPEED X' + Math.pow(1.2, l).toFixed(2), 'SPEED X' + Math.pow(1.2, l + 1).toFixed(2)] },
    { id: 'network', name: 'Client Network',  desc: 'Better clients pay more for every finished job.', max: 10,
      cost: l => Math.round(800 * Math.pow(3, l)), effect: l => ['PAY +' + (15 * l) + '%', 'PAY +' + (15 * (l + 1)) + '%'] },
    { id: 'cooling', name: 'Liquid Cooling',  desc: 'Cuts the compute cost of running models.', max: 5,
      cost: l => Math.round(1200 * Math.pow(2.8, l)), effect: l => ['RUN COST -' + pct(1 - Math.pow(0.88, l)), 'RUN COST -' + pct(1 - Math.pow(0.88, l + 1))] },
    { id: 'pod',     name: 'Training Pod',    desc: 'Install another pod to train more models at once.', max: 2,
      cost: l => [1500, 40000][l], effect: l => [(1 + l) + ' PODS', (2 + l) + ' PODS'] },
    { id: 'lab',     name: 'Training Lab',    desc: 'Better datasets make training faster.', max: 5,
      cost: l => Math.round(900 * Math.pow(3.2, l)), effect: l => ['TRAIN TIME -' + pct(1 - Math.pow(0.8, l)), 'TRAIN TIME -' + pct(1 - Math.pow(0.8, l + 1))] }
  ];

  NG.TITLES = [
    [0, 'Garage Tinkerer'], [50, 'Indie Hacker'], [220, 'Startup Founder'],
    [1000, 'Tech Mogul'], [4000, 'Industry Titan'], [10000, 'Singularity Architect']
  ];

  const unlockedBays = s => s.bays.filter(b => b.unlocked).length;
  NG.GOALS = [
    { id: 'first',  text: 'Complete your first job',        reward: 50,     check: s => s.jobsDone >= 1 },
    { id: 'hire',   text: 'Hire a second AI model',         reward: 100,    check: s => s.models.length >= 2 },
    { id: 'bay2',   text: 'Run 2 bays at once',             reward: 150,    check: s => s.bays.filter(b => b.modelUid).length >= 2 },
    { id: 'train',  text: 'Train a model to LV 2',          reward: 200,    check: s => s.models.some(m => m.level >= 2) },
    { id: 'k1',     text: 'Earn $1,000 total',              reward: 250,    check: s => s.totalEarned >= 1000 },
    { id: 'rack',   text: 'Install a Server Rack',          reward: 300,    check: s => s.upgrades.rack >= 1 },
    { id: 'code',   text: 'Ship a Bug Fix',                 reward: 400,    check: s => (s.jobCounts.bugs || 0) >= 1 },
    { id: 'bays4',  text: 'Unlock 4 workbays',              reward: 1000,   check: s => unlockedBays(s) >= 4 },
    { id: 'k25',    text: 'Earn $25,000 total',             reward: 3000,   check: s => s.totalEarned >= 25000 },
    { id: 'lv5',    text: 'Train a model to LV 5',          reward: 5000,   check: s => s.models.some(m => m.level >= 5) },
    { id: 'tier3',  text: 'Hire a Tier-3 model',            reward: 8000,   check: s => s.models.some(m => NG.MODEL_MAP[m.type].tier >= 3) },
    { id: 'bays8',  text: 'Unlock all 8 workbays',          reward: 50000,  check: s => unlockedBays(s) >= 8 },
    { id: 'm1',     text: 'Earn $1,000,000 total',          reward: 100000, check: s => s.totalEarned >= 1e6 },
    { id: 'front',  text: 'Hire FRONTIER-X',                reward: 150000, check: s => s.models.some(m => m.type === 'frontier') },
    { id: 'lv10',   text: 'Train a model to LV 10',         reward: 250000, check: s => s.models.some(m => m.level >= 10) },
    { id: 'agi',    text: 'Finish Project LANTERN',         reward: 0,      check: s => (s.jobCounts.moonshot || 0) >= 1 }
  ];
})(window.NG);
