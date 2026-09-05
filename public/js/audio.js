// Web Audio API Synthesizer Helper с поддержкой разблокировки на iOS
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.unlocked = false;

    // Автоматическая разблокировка аудиоконтекста при первом тапе по экрану (требование iOS Safari)
    const unlock = () => {
      this.init();
      if (this.ctx) {
        if (this.ctx.state === 'suspended') {
          this.ctx.resume().then(() => {
            this.unlocked = true;
            this.removeUnlockListeners();
          });
        } else {
          this.unlocked = true;
          this.removeUnlockListeners();
        }
      }
    };

    this.unlockHandler = unlock;
    this.addUnlockListeners();
  }

  addUnlockListeners() {
    ['click', 'touchstart', 'touchend', 'mousedown'].forEach(evt => {
      document.addEventListener(evt, this.unlockHandler, { passive: true });
    });
  }

  removeUnlockListeners() {
    ['click', 'touchstart', 'touchend', 'mousedown'].forEach(evt => {
      document.removeEventListener(evt, this.unlockHandler);
    });
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
  }

  // Звук успешного пополнения счета (восходящее мажорное трезвучие)
  playTopup() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    // Если контекст все еще приостановлен (например, на iOS), пробуем запустить его принудительно
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

    notes.forEach((freq, index) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + index * 0.08);

      gain.gain.setValueAtTime(0.2, now + index * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.08 + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + index * 0.08);
      osc.stop(now + index * 0.08 + 0.35);
    });
  }

  // Звук успешной оплаты (двойной сигнал кассы + колокольчик)
  playPaymentSuccess() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const now = this.ctx.currentTime;
    
    // Сигнал 1
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(880, now); // A5
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);

    // Сигнал 2 (звонкий шиммер)
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1760, now + 0.12); // A6
    gain2.gain.setValueAtTime(0.3, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.65);
  }

  // Звук ошибки / недостатка средств
  playError() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.setValueAtTime(110, now + 0.1);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  }
}

window.soundEngine = new SoundEngine();
