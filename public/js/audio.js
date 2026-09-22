class TerminalAudio {
  constructor() {
    this.ctx = null;
    this.isUnlocked = false;
    this.initAudio();
  }

  initAudio() {
    // Принудительно переводим аудиосессию на медиа-канал (обход ограничений iOS)
    if ('audioSession' in navigator) {
      try {
        navigator.audioSession.type = 'playback';
      } catch (e) {}
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      this.ctx = new AudioContext();
    }

    const unlockAudio = () => {
      if (!this.ctx) return;

      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      try {
        const buffer = this.ctx.createBuffer(1, 1, 22050);
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.ctx.destination);
        source.start(0);
      } catch (e) {}

      this.isUnlocked = true;
    };

    // Вешаем слушатели без once: true, чтобы контекст мог пробуждаться при каждом клике
    document.addEventListener('touchstart', unlockAudio);
    document.addEventListener('click', unlockAudio);
    document.addEventListener('keydown', unlockAudio);

    // Восстановление контекста при возврате на вкладку или снятии с блокировки (iOS)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.ensureContextActive();
      }
    });

    window.addEventListener('pageshow', () => {
      this.ensureContextActive();
    });
  }

  ensureContextActive() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  playTone(frequency, type, duration, gainValue = 0.1) {
    this.ensureContextActive();
    if (!this.ctx) return;

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
    this.ensureContextActive();
    setTimeout(() => this.playTone(523.25, 'triangle', 0.1, 0.15), 0);
    setTimeout(() => this.playTone(659.25, 'triangle', 0.1, 0.15), 100);
    setTimeout(() => this.playTone(783.99, 'triangle', 0.2, 0.2), 200);
  }

  playError() {
    this.ensureContextActive();
    setTimeout(() => this.playTone(300, 'sawtooth', 0.15, 0.15), 0);
    setTimeout(() => this.playTone(200, 'sawtooth', 0.25, 0.2), 120);
  }
}

window.terminalAudio = new TerminalAudio();
