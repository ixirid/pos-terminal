/**
 * Управление звуковыми эффектами POS-терминала и Дисплея
 * Поддерживает успешную оплату и звуки ошибки на всех экранах.
 */
class TerminalAudioController {
  constructor() {
    this.audioCtx = null;
    this.isUnlocked = false;
    this.setupiOSUnlocker();
  }

  setupiOSUnlocker() {
    const unlockEvents = ['touchstart', 'touchend', 'click', 'keydown'];
    
    const unlock = () => {
      this.initContext();
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().then(() => {
          this.isUnlocked = true;
        });
      } else {
        this.isUnlocked = true;
      }
      unlockEvents.forEach(evt => document.removeEventListener(evt, unlock));
    };

    unlockEvents.forEach(evt => {
      document.addEventListener(evt, unlock, { passive: true });
    });
  }

  initContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
  }

  ensureActiveContext() {
    this.initContext();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  playTap() {}

  playSuccess() {
    try {
      this.ensureActiveContext();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;

      const osc1 = this.audioCtx.createOscillator();
      const gain1 = this.audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(1318.51, now);
      gain1.gain.setValueAtTime(0.25, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc1.connect(gain1);
      gain1.connect(this.audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.22);

      const osc2 = this.audioCtx.createOscillator();
      const gain2 = this.audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1975.53, now + 0.1);
      gain2.gain.setValueAtTime(0.3, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc2.connect(gain2);
      gain2.connect(this.audioCtx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.45);
    } catch (e) {
      console.warn('Ошибка звука успеха:', e);
    }
  }

  playError() {
    try {
      this.ensureActiveContext();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;

      const osc1 = this.audioCtx.createOscillator();
      const gain1 = this.audioCtx.createGain();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(220, now);
      gain1.gain.setValueAtTime(0.2, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

      osc1.connect(gain1);
      gain1.connect(this.audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.18);

      const osc2 = this.audioCtx.createOscillator();
      const gain2 = this.audioCtx.createGain();
      osc2.type, osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(180, now + 0.22);
      gain2.gain.setValueAtTime(0.25, now + 0.22);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

      osc2.connect(gain2);
      gain2.connect(this.audioCtx.destination);
      osc2.start(now + 0.22);
      osc2.stop(now + 0.45);
    } catch (e) {
      console.warn('Ошибка звука ошибки:', e);
    }
  }
}

window.terminalAudio = new TerminalAudioController();
