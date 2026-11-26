// audioEngine.js — 100% procedural WebAudio: twin-prop drone tied to RPM,
// wind rush, flap servo, stall horn, ILS marker beeps, tyre squeal, water
// splash, storm rain loop, thunder, crash thud, and a soft coastal ambient
// pad (M toggles music). No samples, no network: every sound is synthesized.
export function createAudio() {
  let ctx = null, master = null, propOsc = [], propGain = null, windSrc = null,
    windGain = null, rainGain = null, musicGain = null, musicOn = false,
    started = false, brownBuf = null;
  function ensure() {
    if (ctx) { if (ctx.resume) ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    if (ctx.resume) ctx.resume();
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
    // shared white-noise buffer (wind + rain + thunder source material)
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // wind: looped noise through a bandpass
    windSrc = ctx.createBufferSource(); windSrc.buffer = buf; windSrc.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.6;
    windGain = ctx.createGain(); windGain.gain.value = 0;
    windSrc.connect(bp); bp.connect(windGain); windGain.connect(master);
    windSrc.start();
    // rain: same noise, high hiss band, its own gain (driven by weather)
    const rainSrc = ctx.createBufferSource(); rainSrc.buffer = buf; rainSrc.loop = true;
    rainSrc.playbackRate.value = 1.7;
    const hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 2600; hp.Q.value = 0.4;
    rainGain = ctx.createGain(); rainGain.gain.value = 0;
    rainSrc.connect(hp); hp.connect(rainGain); rainGain.connect(master);
    rainSrc.start();
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
  // one-shot filtered noise burst: the raw material for thunder and impacts
  function noiseBurst(dur, filterType, freq, vol, when = 0) {
    if (!ctx) return;
    const len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq;
    const g = ctx.createGain();
    const t0 = ctx.currentTime + when;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(vol, 0.001), t0 + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }
  function brownNoise() {
    if (brownBuf) return brownBuf;
    const len = ctx.sampleRate * 4;
    brownBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = brownBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
    return brownBuf;
  }
  return {
    ensure, isStarted: () => started,
    state: () => (ctx ? ctx.state : 'none'),
    update(S, F, weather) {
      if (!ctx) return;
      const rpm = (F.rpm[0] || 0) / 2500;
      propGain.gain.value = 0.05 + rpm * 0.22;
      propOsc.forEach((o, i) => { o.frequency.value = 42 + rpm * 78 + i * 1.7; });
      windGain.gain.value = Math.min(0.3, (S.airspeedKt / 200) * 0.3 + (S.stormActive ? 0.12 : 0));
      // rain hiss follows the live storm, not a toggle
      const rainTarget = weather && weather.storm && weather.rain
        ? 0.05 + 0.13 * (weather.stormIntensity || 0.85) : 0;
      rainGain.gain.setTargetAtTime(rainTarget, ctx.currentTime, 0.25);
    },
    stallHorn(on) { if (!ctx || !on) return; beep(620, 0.4, 0.12); },
    flapServo() { beep(320, 0.25, 0.1); beep(420, 0.2, 0.08, 0.15); },
    gearThunk() { beep(140, 0.3, 0.18); },
    markerBeep(kind) { if (kind === 'outer') { beep(400, 0.3, 0.15); beep(400, 0.3, 0.15, 0.4); } },
    tyreSqueal() { beep(900, 0.5, 0.14); },
    splash() { beep(220, 0.6, 0.2); beep(160, 0.5, 0.15, 0.1); },
    rainLoop(on) {
      // kept for callers that toggle rain by hand; the live loop is driven
      // by update(S, F, weather) instead
      if (!ctx) return;
      rainGain.gain.setTargetAtTime(on ? 0.16 : 0, ctx.currentTime, 0.2);
    },
    thunder() {
      if (!ctx) return;
      // deep rolling thunder: brown noise through a lowpass, main clap plus
      // two fading after-rumbles
      const src = ctx.createBufferSource(); src.buffer = brownNoise(); src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 140;
      const g = ctx.createGain();
      const t0 = ctx.currentTime;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.08);
      g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.9);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 3.0);
      src.connect(f); f.connect(g); g.connect(master);
      src.start(t0); src.stop(t0 + 3.1);
      noiseBurst(1.8, 'lowpass', 220, 0.22, 0.35);
      noiseBurst(1.4, 'lowpass', 160, 0.12, 0.9);
    },
    crashThud() {
      if (!ctx) return;
      // impact: low noise slam + a falling sub sine + a short rumble tail
      noiseBurst(0.5, 'lowpass', 420, 0.6);
      const o = ctx.createOscillator(); o.type = 'sine';
      const t0 = ctx.currentTime;
      o.frequency.setValueAtTime(130, t0);
      o.frequency.exponentialRampToValueAtTime(32, t0 + 0.7);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.55, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.8);
      o.connect(g); g.connect(master);
      o.start(t0); o.stop(t0 + 0.85);
      noiseBurst(1.1, 'lowpass', 180, 0.2, 0.25);
    },
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
