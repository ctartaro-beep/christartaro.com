// ==========================================================================
// photoframe (christartaro.com/photoframe) — generative ambient music
// This page only; the family frame doesn't load it. The shared app.js
// announces each photo with a "photoframe:photo" event, which this listens for.
//
// Two layers, both synthesized live in the browser (no audio files):
//
//   1. An Eno-style engine. A drone holds the key's root. A soft pad holds
//      one of your chords (config.js, MUSIC_CHORDS). Six "bell" loops repeat at different, unrelated lengths
//      (13.1s, 16.7s, 19.9s...), so they drift in and out of phase and the
//      piece never lines up the same way twice.
//
//   2. The photos steer it. Each time a photo appears, a tiny 24x24 copy is
//      read and turned into a "mood":
//        dominant hue              -> which of your chords (MUSIC_CHORDS)
//        warmth (red vs blue)      -> the sound: cool = glassy saws and glass
//                                     bells; warm = round sines and soft
//                                     mallets
//        brightness                -> how open the pad's filter is
//        saturation                -> how often the bells ring, and how loud
//        haze (low contrast)       -> more reverb
//        age (EXIF year)           -> tape wobble, and a little hiss
//      The pad crossfades over a few seconds, so changes feel like weather,
//      not cuts.
//
// Browsers won't start sound until someone touches the page. The splash's
// "Tap anywhere to begin" tap starts it. If the splash is skipped
// (?nosplash) and audio is blocked, a small "Tap for sound" pill appears;
// that first tap only turns the sound on (it doesn't skip the photo).
//
// Controls: double-tap the top of the screen, or press "m", to turn music
// on/off. ?music=off / ?music=on in the address overrides the saved choice.
// ==========================================================================

(function () {
  "use strict";

  // ------------------------------------------------------------ the music

  // Your chords, in order. The first is "home": photos with little color
  // land there. Change them in config.js (MUSIC_CHORDS).
  const DEFAULT_CHORDS = ["Dm7(9)", "Dm7", "Dm7(b5)", "Fm6", "Cmaj7"];

  const KEYS = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6,
                 Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };

  // Loop lengths for the bells, in seconds. Unrelated numbers on purpose.
  const LOOP_SECONDS = [13.1, 16.7, 19.9, 23.3, 29.7, 31.9];
  const CROSSFADE_SECONDS = 6;

  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
  function mix(a, b, t) { return a + (b - a) * t; }

  // ---- chord names -> notes
  //
  // Understands names like Dm7, Dm7(9), Dm7(b5), Fm6, Cmaj7, "C maj 7",
  // Bbmaj9, G7sus4, Esus2, Aadd9, F#m11, Bø7, Cdim7, and extensions in
  // parentheses: (9), (b5), (#11), (13). Or give exact notes instead:
  // ["D3", "A3", "C4", "E4", "F4"].

  const LETTER = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const QUALITIES = [
    [/^(maj7|ma7|M7|Δ7?)$/, [0, 4, 7, 11]],
    [/^(maj9|ma9|M9)$/, [0, 4, 7, 11, 14]],
    [/^(m7b5|min7b5|ø7?)$/, [0, 3, 6, 10]],
    [/^(m7|min7|-7)$/, [0, 3, 7, 10]],
    [/^(m9|min9|-9)$/, [0, 3, 7, 10, 14]],
    [/^(m11|min11)$/, [0, 3, 7, 10, 14, 17]],
    [/^(m6|min6|-6)$/, [0, 3, 7, 9]],
    [/^(m|min|-)$/, [0, 3, 7]],
    [/^(dim7|°7)$/, [0, 3, 6, 9]],
    [/^(dim|°)$/, [0, 3, 6]],
    [/^(7sus4|7sus)$/, [0, 5, 7, 10]],
    [/^(sus4|sus)$/, [0, 5, 7]],
    [/^sus2$/, [0, 2, 7]],
    [/^7$/, [0, 4, 7, 10]],
    [/^9$/, [0, 4, 7, 10, 14]],
    [/^6$/, [0, 4, 7, 9]],
    [/^(maj|M)?$/, [0, 4, 7]],
  ];
  const DEGREE_SEMITONES = { 2: 2, 4: 5, 5: 7, 6: 9, 7: 10, 9: 14, 11: 17, 13: 21 };

  function noteToMidi(s) {
    const m = String(s).trim().match(/^([A-G])([#b]?)(-?\d)$/);
    if (!m) throw new Error(`Can't read note "${s}" (use names like D3, F#4, Bb2)`);
    return (+m[3] + 1) * 12 + LETTER[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
  }

  function parseChord(name) {
    if (Array.isArray(name)) return name.map(noteToMidi).sort((a, b) => a - b);

    const s = String(name).replace(/\s+/g, "");
    const m = s.match(/^([A-G])([#b]?)(.*)$/);
    if (!m) throw new Error(`Can't read chord "${name}"`);
    const root = LETTER[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);

    // Pull out (9), (b5), add9 ... then match what's left as the quality.
    const ext = [];
    let q = m[3].replace(/\(([^)]*)\)/g, (_, x) => { ext.push(...x.split(/[,/]/)); return ""; });
    q = q.replace(/add([b#]?\d+)/g, (_, x) => { ext.push(x); return ""; });
    const found = QUALITIES.find(([re]) => re.test(q));
    if (!found) throw new Error(`Can't read chord "${name}" (unknown "${q}")`);
    let iv = found[1].slice();

    for (const e of ext) {
      const em = e.trim().match(/^([b#]?)(\d+)$/);
      if (!em || DEGREE_SEMITONES[+em[2]] === undefined) throw new Error(`Can't read "${e}" in "${name}"`);
      const off = DEGREE_SEMITONES[+em[2]] + (em[1] === "#" ? 1 : em[1] === "b" ? -1 : 0);
      if (+em[2] === 5) iv = iv.filter((x) => x !== 7); // (b5) / (#5) replaces the fifth
      iv.push(off);
    }
    return voice(root, iv);
  }

  // Open voicing: the root in octave 3, every other tone at least a fifth
  // above it, so the chord breathes instead of clustering.
  function voice(rootPc, intervals) {
    const root = 48 + ((rootPc % 12) + 12) % 12;
    const pcs = [...new Set(intervals.map((i) => ((rootPc + i) % 12 + 12) % 12))]
      .filter((pc) => pc !== ((rootPc % 12) + 12) % 12);
    const notes = pcs.map((pc) => {
      let n = root + 7;
      while ((n % 12) !== pc) n++;
      return n;
    });
    return [root, ...notes.sort((a, b) => a - b)];
  }

  function reverbImpulse(ctx, seconds) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
      }
    }
    return buf;
  }

  function noiseBuffer(ctx, seconds) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // Works with a live AudioContext or an OfflineAudioContext (for renders).
  function Engine(ctx, out, opts) {
    const keyRoot = KEYS[opts.key] !== undefined ? KEYS[opts.key] : 2;
    const volume = opts.volume !== undefined ? opts.volume : 0.5;
    const chordNames = opts.chords && opts.chords.length ? opts.chords : DEFAULT_CHORDS;
    const chords = chordNames.map(parseChord);

    // Signal chain:  pad -> filter -+
    //                bells ---------+-> mix -> dry ------+-> compressor -> master -> out
    //                drone ---------+       -> reverb -> wet -+
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20; comp.ratio.value = 3;
    comp.attack.value = 0.05; comp.release.value = 0.6;
    const makeup = ctx.createGain(); makeup.gain.value = 3;
    const master = ctx.createGain();
    master.gain.value = 0;
    comp.connect(makeup); makeup.connect(master); master.connect(out);

    const dry = ctx.createGain(); dry.gain.value = 0.75; dry.connect(comp);
    const verb = ctx.createConvolver(); verb.buffer = reverbImpulse(ctx, 3.8);
    const wet = ctx.createGain(); wet.gain.value = 0.55;
    verb.connect(wet); wet.connect(comp);
    const mixBus = ctx.createGain(); mixBus.connect(dry); mixBus.connect(verb);

    const padFilter = ctx.createBiquadFilter();
    padFilter.type = "lowpass"; padFilter.frequency.value = 900; padFilter.Q.value = 0.6;
    const padBus = ctx.createGain(); padBus.connect(padFilter); padFilter.connect(mixBus);
    const bellBus = ctx.createGain(); bellBus.gain.value = 0.7; bellBus.connect(mixBus);

    // Tape wobble: one slow LFO bends the pitch of everything, in cents.
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.31;
    const wobble = ctx.createGain(); wobble.gain.value = 3;
    lfo.connect(wobble);

    // Hiss for old photos.
    const hissSrc = ctx.createBufferSource();
    hissSrc.buffer = noiseBuffer(ctx, 2); hissSrc.loop = true;
    const hissFilter = ctx.createBiquadFilter();
    hissFilter.type = "bandpass"; hissFilter.frequency.value = 5000; hissFilter.Q.value = 0.4;
    const hiss = ctx.createGain(); hiss.gain.value = 0;
    hissSrc.connect(hissFilter); hissFilter.connect(hiss); hiss.connect(comp);

    // Drone on the key's root, two octaves down, the same for every photo.
    const droneGain = ctx.createGain(); droneGain.gain.value = 0;
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = "lowpass"; droneFilter.frequency.value = 500;
    droneGain.connect(droneFilter); droneFilter.connect(mixBus);
    const droneOscs = [[36 + keyRoot, "sine", 0.55], [48 + keyRoot, "triangle", 0.16]].map(([m, type, lvl]) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = mtof(m);
      wobble.connect(o.detune);
      const g = ctx.createGain(); g.gain.value = lvl;
      o.connect(g); g.connect(droneGain);
      return o;
    });

    let pad = null;
    let chord = null;
    let padKey = "";
    let density = 0.6;
    let bellLevel = 0.7;
    let bellTone = null;
    let loops = [];
    let running = false;

    // The pad's sound follows the photo's warmth (w: 0 cool ... 1 warm).
    // Warm: round sine and triangle, like a soft organ or felt piano pad.
    // Cool: detuned saws and an octave of glass on top, brighter and edgier.
    function startPad(notes, t, attack, w) {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.setTargetAtTime(1, t, attack / 3);
      g.connect(padBus);
      const layers = [
        ["triangle", 0, 4, 0.04],
        ["sine", 0, 0, 0.04 * w],
        ["sawtooth", 0, -9, 0.02 * (1 - w)],
        ["sawtooth", 0, 9, 0.02 * (1 - w)],
        ["sine", 12, 3, 0.013 * (1 - w)],
      ].filter((l) => l[3] > 0.003);
      const oscs = [];
      notes.forEach((n, i) => {
        const pan = ctx.createStereoPanner();
        pan.pan.value = [-0.45, 0.35, -0.2, 0.5, -0.05, 0.25][i % 6];
        pan.connect(g);
        layers.forEach(([type, oct, det, lvl]) => {
          const o = ctx.createOscillator();
          o.type = type; o.frequency.value = mtof(n + oct);
          o.detune.value = det + (Math.random() * 4 - 2);
          wobble.connect(o.detune);
          const og = ctx.createGain(); og.gain.value = lvl * (n > 70 ? 0.7 : 1);
          o.connect(og); og.connect(pan);
          o.start(t);
          oscs.push(o);
        });
      });
      return {
        stop(t2, release) {
          g.gain.cancelScheduledValues(t2);
          g.gain.setTargetAtTime(0, t2, release / 3);
          oscs.forEach((o) => o.stop(t2 + release * 1.6));
        },
      };
    }

    // Bells change instrument with warmth too: glass for cool photos,
    // chimes in between, soft mallets (an octave lower) for warm ones.
    function toneFor(w) {
      if (w < 0.34) return { ratio: 3.5, index: 1.4, decay: 2.4, shift: 0 };
      if (w < 0.67) return { ratio: 2, index: 1.0, decay: 1.7, shift: 0 };
      return { ratio: 1, index: 0.55, decay: 1.0, shift: -12 };
    }

    function bell(n, t, vel) {
      const tone = bellTone || toneFor(0.5);
      const f = mtof(n + tone.shift);
      const car = ctx.createOscillator(); car.frequency.value = f;
      const mod = ctx.createOscillator(); mod.frequency.value = f * tone.ratio;
      const modDepth = ctx.createGain();
      modDepth.gain.setValueAtTime(f * tone.index * vel, t);
      modDepth.gain.setTargetAtTime(f * 0.03, t, tone.decay * 0.3);
      mod.connect(modDepth); modDepth.connect(car.frequency);
      wobble.connect(car.detune);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.085 * vel * (tone.shift ? 1.3 : 1), t + 0.04);
      env.gain.setTargetAtTime(0, t + 0.04, tone.decay);
      const pan = ctx.createStereoPanner(); pan.pan.value = Math.random() * 1.4 - 0.7;
      car.connect(env); env.connect(pan); pan.connect(bellBus);
      car.start(t); mod.start(t);
      car.stop(t + tone.decay * 6); mod.stop(t + tone.decay * 6);
    }

    // Main color -> one of your chords. Photos are ranked by hue (magenta,
    // red, orange, yellow, green, cyan, blue) against the whole collection and
    // split evenly across the list; photos with little color go to the first.
    function chordIndex(mood) {
      if (mood.hue < 0) return 0;
      return Math.min(chords.length - 1, Math.floor(mood.hue * chords.length));
    }

    // The bells play "their" chord tone, an octave or two above the pad,
    // so each loop is a fixed melody that recolors as the chord changes.
    function bellNote(slot) {
      let n = chord[slot % chord.length] + (slot < 3 ? 12 : 24);
      while (n < 64) n += 12;
      while (n > 91) n -= 12;
      return n;
    }

    return {
      chordNames,
      chordIndex,

      start(t) {
        running = true;
        lfo.start(t);
        hissSrc.start(t);
        droneOscs.forEach((o) => o.start(t));
        droneGain.gain.setTargetAtTime(0.11, t, 2);
        master.gain.setTargetAtTime(volume, t, 1.5);
        loops = LOOP_SECONDS.map((p, i) => ({ p, slot: i, next: t + 3 + i * 2.3 + Math.random() * 3 }));
        if (!chord) this.setMood(DEFAULT_MOOD, t);
      },

      // Schedule bell notes up to tEnd. Call often (every ~250ms) with a
      // small lookahead; Web Audio's clock does the precise timing.
      scheduleUntil(tEnd) {
        if (!running || !chord) return;
        const now = ctx.currentTime;
        for (const v of loops) {
          // After a pause, skip missed notes instead of playing them all at once.
          while (v.next < now) v.next += v.p;
          while (v.next < tEnd) {
            if (Math.random() < density) {
              bell(bellNote(v.slot), v.next, (0.55 + Math.random() * 0.45) * bellLevel);
            }
            v.next += v.p;
          }
        }
      },

      setMood(mood, t) {
        const w = clamp(mood.warmth, 0, 1);
        const notes = chords[chordIndex(mood)];
        // A new photo crossfades the pad even on the same chord, since its
        // sound (warmth) can change.
        const key = notes.join(",") + "|" + w.toFixed(1);
        if (key !== padKey) {
          const next = startPad(notes, t, chord ? CROSSFADE_SECONDS : 4, w);
          if (pad) pad.stop(t, CROSSFADE_SECONDS);
          pad = next;
          chord = notes;
          padKey = key;
        }
        bellTone = toneFor(w);
        const ageDim = clamp(1 - mood.age / 120, 0.6, 1);
        padFilter.frequency.setTargetAtTime((350 + Math.pow(mood.brightness, 1.5) * 2600) * ageDim, t, 2);
        padFilter.Q.setTargetAtTime(mix(2.8, 0.5, w), t, 2);
        wet.gain.setTargetAtTime(0.35 + mood.haze * 0.45, t, 2);
        dry.gain.setTargetAtTime(0.85 - mood.haze * 0.25, t, 2);
        wobble.gain.setTargetAtTime(2 + Math.min(mood.age, 60) * 0.35, t, 3);
        hiss.gain.setTargetAtTime(mood.age > 10 ? Math.min(0.012, (mood.age - 10) * 0.0004) : 0, t, 3);
        bellLevel = 0.45 + mood.saturation * 0.55;
        density = 0.35 + mood.saturation * 0.6;
      },

      setVolume(v, t) { master.gain.setTargetAtTime(v, t, 0.8); },
    };
  }

  const DEFAULT_MOOD = { hue: -1, warmth: 0.5, brightness: 0.5, saturation: 0.5, haze: 0.5, age: 5 };

  // ------------------------------------------------ reading each photo

  function hue6(r, g, b, max, min) {
    const c = max - min;
    let h;
    if (max === r) h = ((g - b) / c) % 6;
    else if (max === g) h = (b - r) / c + 2;
    else h = (r - g) / c + 4;
    return (h + 6) % 6; // 0 red, 1 yellow, 2 green, 3 cyan, 4 blue, 5 magenta
  }

  function yearsOld(f) {
    const t = (f.imageMediaMetadata || {}).time;
    const m = t && t.match(/^(\d{4})/);
    if (!m) return 5;
    return Math.max(0, new Date().getFullYear() - +m[1]);
  }

  // The raw numbers from a 24x24 copy of the photo.
  function measurePixels(img) {
    const W = 24, H = 24;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0, W, H);
    const px = g.getImageData(0, 0, W, H).data; // throws if the image is cross-origin tainted

    const n = W * H;
    let L = 0, L2 = 0, S = 0, RB = 0, hx = 0, hy = 0, hw = 0;
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i] / 255, gr = px[i + 1] / 255, b = px[i + 2] / 255;
      const max = Math.max(r, gr, b), min = Math.min(r, gr, b);
      const l = 0.2126 * r + 0.7152 * gr + 0.0722 * b;
      const s = max > 0 ? (max - min) / max : 0;
      L += l; L2 += l * l; S += s; RB += r - b;
      if (s > 0.25 && max > 0.15) {
        const a = hue6(r, gr, b, max, min) * Math.PI / 3;
        hx += Math.cos(a) * s; hy += Math.sin(a) * s; hw += s;
      }
    }
    const brightness = L / n;
    let hue = null; // average hue in degrees; null if there's hardly any color
    if (hw >= n * 0.03) {
      hue = Math.atan2(hy, hx) * 180 / Math.PI;
      if (hue < -90) hue += 360; // keep reds and magentas next to each other
    }
    return {
      hue,
      warmth: RB / n,
      brightness,
      saturation: S / n,
      contrast: Math.sqrt(Math.max(0, L2 / n - brightness * brightness)),
    };
  }

  // Calibration from 160 random photos in the photoframe Drive folder
  // (Nov 2026). Each list is the 0th, 10th, 20th ... 100th percentile of that
  // measure. Most of these photos are orange-ish and warm, so raw numbers
  // would put nearly every photo on the same chord and the same sound.
  // Ranking each photo against the collection spreads them evenly instead.
  // (26 of the 160 had too little color for a hue; they go to the home chord.)
  const CALIBRATION = {
    hue:        [-82.0, 20.7, 24.7, 28.5, 32.4, 38.1, 49.7, 56.3, 69.6, 205.0, 268.2], // degrees
    warmth:     [-0.301, -0.036, 0, 0.018, 0.049, 0.065, 0.075, 0.099, 0.119, 0.194, 0.515],
    saturation: [0, 0.131, 0.205, 0.228, 0.279, 0.326, 0.343, 0.387, 0.439, 0.597, 0.873],
    contrast:   [0.058, 0.113, 0.136, 0.156, 0.171, 0.182, 0.191, 0.217, 0.233, 0.258, 0.349],
  };

  // Where x falls in the collection, 0 (lowest) to 1 (highest).
  function rank(x, q) {
    if (x <= q[0]) return 0;
    for (let i = 1; i < q.length; i++) {
      if (x <= q[i]) return (i - 1 + (x - q[i - 1]) / Math.max(1e-9, q[i] - q[i - 1])) / (q.length - 1);
    }
    return 1;
  }

  function moodFromPixels(img, f) {
    const m = measurePixels(img);
    return {
      // 0..1 position on the collection's hue range, or -1 for "no color"
      hue: m.hue === null ? -1 : Math.min(0.999, rank(m.hue, CALIBRATION.hue)),
      warmth: rank(m.warmth, CALIBRATION.warmth),
      brightness: clamp(m.brightness, 0, 1), // kept absolute: night should sound like night
      saturation: rank(m.saturation, CALIBRATION.saturation),
      haze: 1 - rank(m.contrast, CALIBRATION.contrast),
      age: yearsOld(f),
    };
  }

  // If the pixels can't be read, still give each photo its own consistent
  // mood, using its ID and what time of day it was taken.
  function moodFromMetadata(f) {
    let h = 0;
    for (let i = 0; i < f.id.length; i++) h = (h * 31 + f.id.charCodeAt(i)) >>> 0;
    const t = (f.imageMediaMetadata || {}).time;
    const hour = t ? +(t.match(/ (\d{2}):/) || [0, 12])[1] : 12;
    return {
      hue: h % 6 === 0 ? -1 : (h % 97) / 97,
      warmth: ((h >>> 3) % 11) / 10,
      brightness: hour >= 7 && hour <= 18 ? 0.6 : 0.25,
      saturation: 0.5,
      haze: 0.5,
      age: yearsOld(f),
    };
  }

  const moodCache = new Map();

  function moodFor(f) {
    if (moodCache.has(f.id)) return Promise.resolve(moodCache.get(f.id));
    return new Promise((resolve) => {
      let done = false;
      const finish = (m) => {
        if (done) return;
        done = true;
        moodCache.set(f.id, m);
        resolve(m);
      };
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try { finish(moodFromPixels(img, f)); } catch (e) { finish(moodFromMetadata(f)); }
      };
      img.onerror = () => finish(moodFromMetadata(f));
      setTimeout(() => finish(moodFromMetadata(f)), 6000);
      // Straight to Google's image host: it allows cross-origin reads, while
      // the drive.google.com/thumbnail redirect in front of it doesn't.
      img.src = `https://lh3.googleusercontent.com/d/${f.id}=w64`;
    });
  }

  // ---------------------------------------------------- on the frame

  // Exposed so a preview can be rendered offline with the same engine.
  window.PhotoMusicEngine = { Engine, moodFor, parseChord, measurePixels };

  const CFG = window.CONFIG || {};
  const PREFIX = CFG.STORAGE_PREFIX || "";
  const PREF_KEY = PREFIX + "music";

  let ctx = null;
  let engine = null;
  let enabled = initialEnabled();
  let currentFile = null;
  let moodToken = 0;
  let swallowPointerUp = false;
  let pill = null;
  let pillTimer = null;

  function initialEnabled() {
    const q = new URLSearchParams(window.location.search).get("music");
    if (q === "on" || q === "off") return q === "on";
    try {
      const v = localStorage.getItem(PREF_KEY);
      if (v) return v === "on";
    } catch (e) {}
    return CFG.MUSIC_ON_BY_DEFAULT !== false;
  }

  function audioRunning() { return !!ctx && ctx.state === "running"; }

  function ensureEngine() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC({ latencyHint: "playback" });
    engine = Engine(ctx, ctx.destination, {
      key: CFG.MUSIC_KEY || "D",
      chords: CFG.MUSIC_CHORDS,
      volume: CFG.MUSIC_VOLUME !== undefined ? CFG.MUSIC_VOLUME : 0.5,
    });
    engine.start(ctx.currentTime + 0.1);
    setInterval(() => { if (enabled && audioRunning()) engine.scheduleUntil(ctx.currentTime + 1.2); }, 250);
    ctx.onstatechange = updatePill;
    if (currentFile) onPhoto(currentFile);
  }

  function onPhoto(f) {
    currentFile = f;
    if (!engine || !enabled) return;
    const token = ++moodToken;
    moodFor(f).then((m) => {
      if (token !== moodToken) return; // a newer photo took over
      engine.setMood(m, ctx.currentTime + 0.05);
    });
  }

  function savePref() {
    try { localStorage.setItem(PREF_KEY, enabled ? "on" : "off"); } catch (e) {}
  }

  function toggle() {
    enabled = !enabled;
    savePref();
    if (enabled) {
      ensureEngine();
      if (!ctx) return;
      ctx.resume();
      engine.setVolume(CFG.MUSIC_VOLUME !== undefined ? CFG.MUSIC_VOLUME : 0.5, ctx.currentTime);
      if (currentFile) onPhoto(currentFile);
      flash("♪ Music on");
    } else if (ctx) {
      engine.setVolume(0, ctx.currentTime);
      setTimeout(() => { if (!enabled) ctx.suspend(); }, 3000); // fade, then let the CPU rest
      flash("Music off");
    }
  }

  // ---- the "Tap for sound" pill

  function updatePill() {
    if (!pill || pillTimer) return;
    const blocked = enabled && !audioRunning();
    pill.textContent = "♪ Tap for sound";
    pill.classList.toggle("visible", blocked);
  }

  function flash(text) {
    if (!pill) return;
    clearTimeout(pillTimer);
    pill.textContent = text;
    pill.classList.add("visible");
    pillTimer = setTimeout(() => {
      pillTimer = null;
      pill.classList.remove("visible");
      updatePill();
    }, 1800);
  }

  // The first touch while sound is blocked just turns the sound on. It's
  // caught before the slideshow's own gesture handling sees it, so it
  // doesn't also skip to the next photo.
  function onPointerDownCapture(e) {
    if (!enabled || audioRunning()) return;
    ensureEngine();
    if (!ctx) return;
    ctx.resume().then(updatePill);
    // The splash already keeps its dismissing tap away from the slideshow,
    // and needs that tap's pointerup to close itself.
    if (e.target && e.target.closest && e.target.closest("#splash")) return;
    swallowPointerUp = true;
    e.stopPropagation();
  }

  function onPointerUpCapture(e) {
    if (!swallowPointerUp) return;
    swallowPointerUp = false;
    e.stopPropagation();
  }

  // Registered as soon as this script runs (it's loaded in <head>), so these
  // see the splash-dismissing tap or key before the splash swallows it.
  window.addEventListener("pointerdown", onPointerDownCapture, true);
  window.addEventListener("pointerup", onPointerUpCapture, true);
  window.addEventListener("keydown", () => {
    if (!enabled || audioRunning()) return;
    ensureEngine();
    if (ctx) ctx.resume().then(updatePill);
  }, true);

  function init() {
    pill = document.createElement("div");
    pill.id = "music-pill";
    (document.getElementById("frame") || document.body).appendChild(pill);

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && enabled && ctx) ctx.resume().then(updatePill);
    });
    document.addEventListener("photoframe:photo", (e) => onPhoto(e.detail));

    // Try to start right away. Where autoplay is allowed (the Electron app,
    // some kiosk browsers) this just plays; elsewhere the pill appears.
    if (enabled) ensureEngine();
    // Don't flash the pill behind the splash; it may start the sound anyway.
    setTimeout(updatePill, document.getElementById("splash") ? 5600 : 600);
  }

  window.photoMusic = { toggle, onPhoto };
  document.addEventListener("DOMContentLoaded", init);
})();
