const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

export class Voice {
  enabled = true;
  rate = 1;
  private voice: SpeechSynthesisVoice | null = null;

  constructor() {
    if (!supported) return;
    const pick = () => {
      const voices = speechSynthesis.getVoices();
      const english = voices.filter(v => v.lang.toLowerCase().startsWith('en'));
      this.voice =
        english.find(v => /google uk english male|daniel|george|ryan|guy/i.test(v.name)) ??
        english.find(v => /en-gb/i.test(v.lang)) ??
        english[0] ??
        null;
    };
    pick();
    speechSynthesis.addEventListener('voiceschanged', pick);
  }

  speak(text: string): void {
    if (!supported || !this.enabled || !text) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (this.voice) u.voice = this.voice;
    u.rate = Math.min(1.7, Math.max(0.8, 1.05 * this.rate));
    u.pitch = 1.15;
    speechSynthesis.speak(u);
  }

  get speaking(): boolean {
    return supported && speechSynthesis.speaking;
  }

  stop(): void {
    if (supported) speechSynthesis.cancel();
  }
}
