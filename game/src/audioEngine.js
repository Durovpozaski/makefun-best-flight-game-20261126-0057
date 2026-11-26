// audioEngine.js — 100% procedural WebAudio: twin-prop drone tied to RPM,
// wind rush, flap servo, stall horn, ILS marker beeps, tyre squeal, water
// splash, storm rain, and a soft coastal ambient pad (M toggles music).
export function createAudio() {
  let ctx = null, master = null, propOsc = [], propGain = null, windSrc = null,
    windGain = null, musicGain = null, musicOn = false, started = false;
  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    // twin prop: two detuned saws through a lowpass
    propGain = ctx.createGain(); propGain.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
    propGain.connect(lp); lp.connect(master);
    for (let i = 0; i < 2; i++) {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.value = 55 + i * 1.5; o.connect(propGain); o.start();
      propOsc.push(o);
    }
    // wind: looped noise buffer
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    windSrc = ctx.createBufferSource(); windSrc.buffer = buf; windSrc.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.6;
    windGain = ctx.createGain(); windGain.gain.value = 0;
    windSrc.connect(bp); bp.connect(windGain); windGain.connect(master);
    windSrc.start();
    started = true;
  }
  function beep(freq, dur, vol, when = 0) {
    if (!ctx) return;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, ctx.currentTime + when);
    g.gain.linearRampToValueAtTime(vol, ctx.currentTime + when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + when + dur);
    o.connect(g); g.connect(master);
    o.start(ctx.currentTime + when); o.stop(ctx.currentTime + when + dur + 0.05);
  }
  return {
    ensure, isStarted: () => started,
    update(S, F) {
      if (!ctx) return;
      const rpm = (F.rpm[0] || 0) / 2500;
      propGain.gain.value = 0.05 + rpm * 0.22;
      propOsc.forEach((o, i) => { o.frequency.value = 42 + rpm * 78 + i * 1.7; });
      windGain.gain.value = Math.min(0.3, (S.airspeedKt / 200) * 0.3 + (S.stormActive ? 0.12 : 0));
    },
    stallHorn(on) { if (!ctx || !on) return; beep(620, 0.4, 0.12); },
    flapServo() { beep(320, 0.25, 0.1); beep(420, 0.2, 0.08, 0.15); },
    gearThunk() { beep(140, 0.3, 0.18); },
    markerBeep(kind) { if (kind === 'outer') { beep(400, 0.3, 0.15); beep(400, 0.3, 0.15, 0.4); } },
    tyreSqueal() { beep(900, 0.5, 0.14); },
    splash() { beep(220, 0.6, 0.2); beep(160, 0.5, 0.15, 0.1); },
    rainLoop(on) { if (!ctx) return; windGain.gain.value = on ? 0.22 : windGain.gain.value; },
    toggleMusic() {
      ensure();
      if (!ctx) return false;
      musicOn = !musicOn;
      if (musicOn && !musicGain) {
        musicGain = ctx.createGain(); musicGain.gain.value = 0.06; musicGain.connect(master);
        const notes = [220, 277.2, 329.6, 440];
        notes.forEach((f, i) => {
          const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
          const g = ctx.createGain();
          g.gain.value = 0.25;
          const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07 + i * 0.03;
          const lg = ctx.createGain(); lg.gain.value = 0.18;
          lfo.connect(lg); lg.connect(g.gain); lfo.start();
          o.connect(g); g.connect(musicGain); o.start();
        });
      } else if (musicGain) {
        musicGain.gain.value = musicOn ? 0.06 : 0;
      }
      return musicOn;
    },
  };
}
