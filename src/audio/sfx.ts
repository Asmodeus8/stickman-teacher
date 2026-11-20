interface FilterSpec {
  type: BiquadFilterType;
  frequency: number;
  Q: number;
}

export class Sfx {
  private enabled = true;
  private ac: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private scratchGain: GainNode | null = null;
  private eraseGain: GainNode | null = null;

  unlock(): void {
    if (this.ac) {
      if (this.ac.state === 'suspended') void this.ac.resume();
      return;
    }
    if (typeof AudioContext === 'undefined') return;
    const ac = new AudioContext();
    this.ac = ac;
    this.master = ac.createGain();
    this.master.gain.value = this.enabled ? 0.9 : 0;
    this.master.connect(ac.destination);

    const len = ac.sampleRate * 2;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buf;

    this.scratchGain = this.loopNoise([
      { type: 'bandpass', frequency: 3400, Q: 0.8 },
      { type: 'highpass', frequency: 1400, Q: 0.5 },
    ]);
    this.eraseGain = this.loopNoise([{ type: 'lowpass', frequency: 650, Q: 0.7 }]);
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (this.ac && this.master) this.master.gain.setTargetAtTime(on ? 0.9 : 0, this.ac.currentTime, 0.05);
  }

  scratch(level: number): void {
    this.setGain(this.scratchGain, level * 0.2);
  }

  erase(level: number): void {
    this.setGain(this.eraseGain, level * 0.32);
  }

  silence(): void {
    this.scratch(0);
    this.erase(0);
  }

  tap(): void {
    const ac = this.ac;
    if (!ac || !this.master || !this.noise) return;
    const src = ac.createBufferSource();
    src.buffer = this.noise;
    const hp = ac.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 1800;
    const g = ac.createGain();
    const t = ac.currentTime;
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    src.connect(hp).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + 0.06);
  }

  step(): void {
    const ac = this.ac;
    if (!ac || !this.master) return;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    const t = ac.currentTime;
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.09);
    g.gain.setValueAtTime(0.09, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.11);
  }

  chime(): void {
    const ac = this.ac;
    if (!ac || !this.master) return;
    const t = ac.currentTime;
    [523.25, 659.25, 783.99].forEach((f, i) => {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = 'triangle';
      osc.frequency.value = f;
      g.gain.setValueAtTime(0, t + i * 0.09);
      g.gain.linearRampToValueAtTime(0.12, t + i * 0.09 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.09 + 0.45);
      osc.connect(g).connect(this.master!);
      osc.start(t + i * 0.09);
      osc.stop(t + i * 0.09 + 0.5);
    });
  }

  private loopNoise(filters: FilterSpec[]): GainNode | null {
    const ac = this.ac;
    if (!ac || !this.master || !this.noise) return null;
    const src = ac.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    let node: AudioNode = src;
    for (const f of filters) {
      const bq = ac.createBiquadFilter();
      bq.type = f.type;
      bq.frequency.value = f.frequency;
      bq.Q.value = f.Q;
      node.connect(bq);
      node = bq;
    }
    const g = ac.createGain();
    g.gain.value = 0;
    node.connect(g).connect(this.master);
    src.start();
    return g;
  }

  private setGain(g: GainNode | null, value: number): void {
    if (!this.ac || !g) return;
    g.gain.setTargetAtTime(value, this.ac.currentTime, 0.03);
  }
}
