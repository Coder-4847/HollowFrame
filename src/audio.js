export class AudioSystem {
  constructor() {
    this.volume = 0.55;
    this.context = null;
    this.musicVolume = 0.3;
    this.effectsVolume = 0.8;
    this.musicClock = 0;
    this.beat = 0;
    this.voices = 0;
    this.maxVoices = 56;
  }
  start() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.compressor = this.context.createDynamicsCompressor();
      this.compressor.threshold.value = -14;
      this.compressor.ratio.value = 5;
      this.master.connect(this.compressor);
      this.compressor.connect(this.context.destination);
      this.effectsBus = this.context.createGain();
      this.effectsBus.connect(this.master);
      this.musicBus = this.context.createGain();
      this.musicBus.connect(this.master);
      this.noise = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate);
      const a = this.noise.getChannelData(0);
      for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1;
      // A short synthetic room impulse gives gunfire and explosions a tail without samples.
      const length = Math.floor(this.context.sampleRate * 1.1),
        impulse = this.context.createBuffer(2, length, this.context.sampleRate);
      for (let c = 0; c < 2; c++) {
        const data = impulse.getChannelData(c);
        for (let i = 0; i < length; i++)
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3.2);
      }
      this.reverb = this.context.createConvolver();
      this.reverb.buffer = impulse;
      this.reverbSend = this.context.createGain();
      this.reverbSend.gain.value = 0.22;
      this.reverbSend.connect(this.reverb);
      this.reverb.connect(this.effectsBus);
      // Continuous movement layers: filtered noise whose level and colour follow the player.
      this.loops = {};
      for (const [name, type, freq] of [
        ['wind', 'bandpass', 700],
        ['slide', 'bandpass', 1800],
      ]) {
        const source = this.context.createBufferSource(),
          filter = this.context.createBiquadFilter(),
          gain = this.context.createGain();
        source.buffer = this.noise;
        source.loop = true;
        filter.type = type;
        filter.frequency.value = freq;
        filter.Q.value = name === 'slide' ? 1.4 : 0.6;
        gain.gain.value = 0;
        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.effectsBus);
        source.start();
        this.loops[name] = { filter, gain };
      }
    }
    this.context.resume().catch(() => {});
    this.master.gain.value = this.volume;
    this.effectsBus.gain.value = this.effectsVolume;
    this.musicBus.gain.value = this.musicVolume;
  }
  output(node, music, wet) {
    node.connect(music ? this.musicBus : this.effectsBus);
    if (wet && !music) node.connect(this.reverbSend);
  }
  tone(
    freq = 440,
    duration = 0.1,
    volume = 0.1,
    type = 'sine',
    end = 100,
    music = false,
    pan = 0,
    delay = 0,
    wet = false,
  ) {
    if (!this.context || this.voices >= this.maxVoices) return;
    this.voices++;
    const t = this.context.currentTime + delay,
      o = this.context.createOscillator(),
      g = this.context.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(end, 10), t + duration);
    // A 3 ms attack removes the click of starting an oscillator at full gain.
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(volume, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    o.connect(g);
    const stereo = this.context.createStereoPanner();
    stereo.pan.value = pan;
    g.connect(stereo);
    this.output(stereo, music, wet);
    o.start(t);
    o.stop(t + duration + 0.02);
    o.onended = () => {
      this.voices--;
      o.disconnect();
      g.disconnect();
      stereo.disconnect();
    };
  }
  burst(duration = 0.15, volume = 0.2, freq = 1400, options = {}) {
    if (!this.context || this.voices >= this.maxVoices) return;
    this.voices++;
    const t = this.context.currentTime + (options.delay || 0),
      s = this.context.createBufferSource(),
      f = this.context.createBiquadFilter(),
      g = this.context.createGain(),
      stereo = this.context.createStereoPanner();
    s.buffer = this.noise;
    // Random offsets stop repeated bursts from sounding like the same sample.
    const offset = Math.random() * 0.6;
    f.type = options.filter || 'lowpass';
    f.frequency.value = freq;
    if (options.q) f.Q.value = options.q;
    if (options.sweep) f.frequency.exponentialRampToValueAtTime(options.sweep, t + duration);
    stereo.pan.value = options.pan || 0;
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    s.connect(f);
    f.connect(g);
    g.connect(stereo);
    this.output(stereo, options.music, options.wet);
    s.start(t, offset);
    s.stop(t + duration + 0.02);
    s.onended = () => {
      this.voices--;
      s.disconnect();
      f.disconnect();
      g.disconnect();
      stereo.disconnect();
    };
  }
  enemy(type, pos, listener, yaw) {
    const dx = pos.x - listener.x,
      dz = pos.z - listener.z,
      distance = Math.hypot(dx, dz),
      pan = Math.sin(Math.atan2(dx, -dz) + yaw) * 0.8,
      level = 1 / (1 + distance * 0.06),
      pitch = type === 'bastion' ? 100 : type === 'lancer' ? 320 : 230;
    this.tone(pitch, 0.18, 0.09 * level, 'sawtooth', 50, false, pan, 0, true);
    // Distant shots lose their high end, which helps judge range by ear.
    this.burst(0.12, 0.08 * level, Math.max(500, 3200 - distance * 70), { pan, wet: true });
  }
  // Smoothly steer a loop's level and filter frequency (ignored before audio starts).
  loop(name, level, freq) {
    const loop = this.loops?.[name];
    if (!loop) return;
    const t = this.context.currentTime;
    loop.gain.gain.setTargetAtTime(level, t, 0.06);
    if (freq) loop.filter.frequency.setTargetAtTime(freq, t, 0.08);
  }
  jump(power = 1) {
    this.burst(0.22, 0.05 * power, 900, { filter: 'bandpass', q: 0.8, sweep: 2600 });
    this.tone(150, 0.08, 0.04 * power, 'sine', 90);
  }
  land(impact) {
    const weight = Math.min(1, impact / 16);
    this.tone(95, 0.12 + weight * 0.2, 0.08 + weight * 0.22, 'sine', 38);
    this.burst(0.08 + weight * 0.18, 0.06 + weight * 0.16, 500 + weight * 700, { sweep: 120 });
    if (weight > 0.55) {
      // Hard landings add armour rattle and a short room tail.
      this.burst(0.05, 0.08 * weight, 4200, { filter: 'highpass', delay: 0.02 });
      this.burst(0.5, 0.05 * weight, 400, { wet: true, sweep: 90 });
    }
  }
  wallKick() {
    this.tone(120, 0.14, 0.18, 'sine', 45);
    this.burst(0.07, 0.14, 2600, { filter: 'bandpass', q: 1.2 });
    this.burst(0.3, 0.06, 1100, { filter: 'bandpass', sweep: 3000, delay: 0.03 });
  }
  grab() {
    this.burst(0.06, 0.1, 3000, { filter: 'bandpass', q: 2 });
    this.tone(180, 0.1, 0.1, 'triangle', 90);
  }
  step(heavy = false, pan = 0) {
    this.tone(heavy ? 85 : 110, 0.07, heavy ? 0.07 : 0.045, 'sine', 50, false, pan);
    this.burst(0.05, heavy ? 0.045 : 0.03, heavy ? 900 : 1300, { pan });
  }
  update(dt, wave, state) {
    if (state !== 'playing') {
      this.loop('wind', 0);
      this.loop('slide', 0);
    }
    if (!this.context || state !== 'playing') return;
    this.musicClock -= dt;
    if (this.musicClock <= 0) {
      this.musicClock = wave >= 5 ? 0.34 : 0.5;
      const notes = [55, 82.4, 65.4, 73.4];
      const note = notes[Math.floor(this.beat / 4) % notes.length];
      if (this.beat % 2 === 0) this.tone(note, 0.4, 0.035, 'triangle', note, true);
      if (wave >= 0 && this.beat % 4 === 0) this.tone(110, 0.22, 0.05, 'sine', 38, true);
      if (wave >= 1 && this.beat % 2 === 1)
        this.burst(0.05, 0.012, 7000, { filter: 'highpass', music: true });
      if (wave >= 2 && this.beat % 4 === 1)
        this.tone(note * 4, 0.12, 0.018, 'sine', note * 2, true);
      if (wave >= 4 && this.beat % 8 === 6)
        this.tone(note * 6, 0.3, 0.012, 'triangle', note * 6, true);
      this.beat++;
    }
  }
  fire(w) {
    if (w.energy) {
      this.tone(w.pitch, 0.16, 0.12, 'sine', w.pitch * 0.4, false, 0, 0, true);
      this.tone(w.pitch * 1.5, 0.08, 0.055, 'triangle', w.pitch * 0.8);
      this.burst(0.05, 0.05, 5000, { filter: 'highpass' });
      return;
    }
    const heavy = w.explosive || w.pitch < 70,
      body = heavy ? 0.22 : 0.12;
    if (w.charge) this.tone(1100, 0.4, 0.13, 'sawtooth', 60);
    // Transient crack, powder body, low thump and a filtered room tail.
    this.burst(0.03, 0.22, w.id === 'needle' ? 5200 : 3800, { filter: 'highpass' });
    this.burst(body, 0.26, w.id === 'needle' ? 3300 : 1900, { sweep: 300 });
    this.tone(Math.max(90, w.pitch * 1.4), body, heavy ? 0.26 : 0.17, 'sine', 32);
    this.tone(w.pitch, 0.09, 0.07, 'sawtooth', 30);
    this.burst(heavy ? 0.6 : 0.32, heavy ? 0.1 : 0.05, 900, { sweep: 150, wet: true });
  }
  hit(weak = false) {
    this.tone(weak ? 1300 : 750, 0.07, 0.065, 'triangle', weak ? 1800 : 350);
  }
  kill() {
    this.tone(520, 0.09, 0.06, 'square', 780);
    this.tone(1040, 0.16, 0.05, 'triangle', 1560, false, 0, 0.05);
  }
  explosion(distance = 0) {
    const volume = Math.max(0.03, 0.4 / (1 + distance * 0.09));
    this.burst(0.05, volume * 0.7, 2500, { filter: 'highpass' });
    this.burst(0.9, volume, 700, { sweep: 90, wet: true });
    this.tone(70, 0.6, volume, 'sine', 15);
  }
  ui() {
    this.tone(650, 0.07, 0.08, 'sine', 900);
  }
  alert() {
    this.tone(260, 0.5, 0.15, 'triangle', 520);
  }
}
