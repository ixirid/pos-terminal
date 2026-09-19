class TerminalAudio {
  constructor() {
    this.ctx = null;
    this.isUnlocked = false;
    this.initAudio();
  }

  initAudio() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      this.ctx = new AudioContext();
    }

    // Функция разблокировки звука для iOS Safari
    const unlockAudio = () => {
      if (!this.ctx) return;

      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      // Проигрываем короткий пустой звук для полного снятия блокировки iOS
      try {
        const buffer = this.ctx.createBuffer(1, 1, 22050);
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.ctx.destination);
        source.start(0);
      } catch (e) {}

      this.isUnlocked = true;

      // Удаляем слушатели после первой разблокировки
      document.removeEventListener('touchstart', unlockAudio);
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
    };

    document.addEventListener('touchstart', unlockAudio, { once: true });
    document.addEventListener('click', unlockAudio, { once: true });
    document.addEventListener('keydown', unlockAudio, { once: true });
  }

  playTone(frequency, type, duration, gainValue = 0.1) {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);

      gain.gain.setValueAtTime(gainValue, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.error('Audio play error:', e);
    }
  }

  playTap() {
    this.playTone(600, 'sine', 0.05, 0.05);
  }

  playSuccess() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    setTimeout(() => this.playTone(523.25, 'triangle', 0.1, 0.15), 0);    // До
    setTimeout(() => this.playTone(659.25, 'triangle', 0.1, 0.15), 100);  // Ми
    setTimeout(() => this.playTone(783.99, 'triangle', 0.2, 0.2), 200);   // Соль
  }

  playError() {
    if (!this.ctx) return;
    setTimeout(() => this.playTone(300, 'sawtooth', 0.15, 0.15), 0);
    setTimeout(() => this.playTone(200, 'sawtooth', 0.25, 0.2), 120);
  }
}

window.terminalAudio = new TerminalAudio();
