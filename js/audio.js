/* audio.js — tiny WebAudio blips. The context starts on the first user gesture. */
'use strict';
(function (NG) {
  const A = NG.audio = { muted: false, ctx: null };

  A.init = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    try { A.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { A.ctx = null; }
  };

  function tone(f, d, type, v, f2, delay) {
    if (A.muted || !A.ctx) return;
    const c = A.ctx, t = c.currentTime + (delay || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(v || 0.03, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + d + 0.02);
  }

  let lastCoin = 0;
  A.coin = () => {
    const n = performance.now();
    if (n - lastCoin < 110) return;
    lastCoin = n;
    tone(1046, 0.05, 'square', 0.018);
    tone(1568, 0.08, 'square', 0.018, null, 0.05);
  };
  A.click  = () => tone(620, 0.03, 'square', 0.02);
  A.boost  = () => tone(260 + Math.random() * 80, 0.05, 'sawtooth', 0.02, 140);
  A.error  = () => tone(180, 0.15, 'square', 0.03, 90);
  A.buy    = () => { tone(523, 0.06, 'square', 0.03); tone(784, 0.09, 'square', 0.03, null, 0.06); };
  A.level  = () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.1, 'square', 0.03, null, i * 0.08));
  A.reject = () => tone(220, 0.14, 'triangle', 0.04, 110);
  A.alert  = () => { tone(880, 0.07, 'triangle', 0.03); tone(660, 0.1, 'triangle', 0.03, null, 0.08); };
})(window.NG);
