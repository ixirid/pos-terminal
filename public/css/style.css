:root {
  --primary: #9E7FFF;
  --primary-hover: #8b66ff;
  --primary-glow: rgba(158, 127, 255, 0.35);
  --secondary: #38bdf8;
  --accent: #f472b6;
  --background: #121214;
  --surface: #1e1e24;
  --surface-border: #2e2e38;
  --text: #ffffff;
  --text-muted: #94a3b8;
  --success: #10b981;
  --success-glow: rgba(16, 185, 129, 0.35);
  --warning: #f59e0b;
  --error: #ef4444;
  --radius: 24px;
  --font-main: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  font-family: var(--font-main);
  user-select: none;
  -webkit-user-select: none;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

html, body {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  overscroll-behavior: none;
}

body {
  background-color: var(--background);
  color: var(--text);
  display: flex;
  flex-direction: column;
  background-image: 
    radial-gradient(circle at 10% 10%, rgba(158, 127, 255, 0.08) 0%, transparent 40%),
    radial-gradient(circle at 90% 90%, rgba(56, 189, 248, 0.08) 0%, transparent 40%);
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}

button, input, .num-btn, .preset-btn, .tab-btn {
  touch-action: manipulation;
}

/* Header Banner */
.pos-header {
  background: rgba(30, 30, 36, 0.75);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--surface-border);
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 100;
  height: 72px;
  flex-shrink: 0;
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.brand-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-icon {
  width: 38px;
  height: 38px;
  background: linear-gradient(135deg, var(--primary), var(--secondary));
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 18px;
  box-shadow: 0 4px 20px var(--primary-glow);
}

.brand-text h1 {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.5px;
}

.brand-text p {
  font-size: 11px;
  color: var(--text-muted);
}

.status-badge-online {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.25);
  color: #6ee7b7;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.pulse-dot-green {
  width: 8px;
  height: 8px;
  background: var(--success);
  border-radius: 50%;
  box-shadow: 0 0 10px var(--success);
}

/* POS Container */
.pos-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 16px 24px;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 1;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Main Interactive Area */
.pos-main-panel {
  width: 100%;
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius);
  padding: 28px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 50px rgba(0,0,0,0.4), 0 0 80px rgba(158, 127, 255, 0.05);
  max-height: 100%;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Tabs */
.tabs-header {
  display: flex;
  gap: 12px;
  background: rgba(0,0,0,0.3);
  padding: 6px;
  border-radius: 14px;
  margin-bottom: 20px;
  flex-shrink: 0;
  transition: opacity 0.2s ease;
}

.tab-btn {
  flex: 1;
  padding: 12px 16px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 14px;
  font-weight: 600;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  white-space: nowrap;
}

.tab-btn.active {
  background: var(--primary);
  color: #ffffff;
  box-shadow: 0 4px 15px var(--primary-glow);
}

.tab-btn:hover:not(.active) {
  color: #ffffff;
  background: rgba(255,255,255,0.05);
}

.tab-content {
  display: none;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.tab-content.active {
  display: flex;
}

/* Input Display */
.amount-display-wrapper {
  background: rgba(0, 0, 0, 0.4);
  border: 2px solid var(--surface-border);
  border-radius: 16px;
  padding: 16px 20px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: border-color 0.2s;
  flex-shrink: 0;
}

.amount-display-wrapper:focus-within {
  border-color: var(--primary);
  box-shadow: 0 0 15px var(--primary-glow);
}

.amount-label {
  font-size: 13px;
  color: var(--text-muted);
  font-weight: 500;
  white-space: nowrap;
}

.amount-input-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.amount-input {
  background: transparent;
  border: none;
  outline: none;
  color: #ffffff;
  font-size: 32px;
  font-weight: 800;
  text-align: right;
  width: 180px;
}

.amount-currency {
  font-size: 24px;
  font-weight: 700;
  color: var(--primary);
}

/* Numpad Layout */
.numpad-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 16px;
  flex: 1;
}

.num-btn {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  font-size: 20px;
  font-weight: 700;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.num-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.num-btn:active {
  background: var(--primary-glow);
}

.num-btn.clear {
  color: var(--error);
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.2);
}

.num-btn.clear:hover {
  background: rgba(239, 68, 68, 0.2);
}

.num-btn.action {
  color: var(--secondary);
}

/* Quick Add Preset Buttons */
.quick-presets {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-shrink: 0;
}

.preset-btn {
  flex: 1;
  background: rgba(56, 189, 248, 0.08);
  border: 1px solid rgba(56, 189, 248, 0.2);
  color: var(--secondary);
  padding: 10px 4px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  text-align: center;
}

.preset-btn:hover {
  background: rgba(56, 189, 248, 0.2);
}

/* Main Action Buttons */
.btn-primary {
  width: 100%;
  padding: 16px;
  background: linear-gradient(135deg, var(--primary), var(--primary-hover));
  border: none;
  border-radius: 16px;
  color: #ffffff;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 8px 25px var(--primary-glow);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  flex-shrink: 0;
}

.btn-primary:hover {
  box-shadow: 0 12px 30px var(--primary-glow);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid var(--surface-border);
  color: #ffffff;
  padding: 14px;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  width: 100%;
  margin-top: 12px;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.15);
}

/* QR Code Modal / Payment State View */
.qr-display-panel {
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 10px;
  animation: fadeIn 0.3s ease;
  flex: 1;
}

.qr-box {
  background: #ffffff;
  padding: 12px;
  border-radius: 20px;
  box-shadow: 0 0 40px rgba(158, 127, 255, 0.3);
  margin: 14px 0;
  position: relative;
}

.qr-box img {
  display: block;
  width: 200px;
  height: 200px;
  border-radius: 8px;
}

.qr-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(56, 189, 248, 0.15);
  border: 1px solid rgba(56, 189, 248, 0.3);
  color: var(--secondary);
  padding: 6px 14px;
  border-radius: 30px;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
}

.pulse-dot {
  width: 10px;
  height: 10px;
  background: var(--secondary);
  border-radius: 50%;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(56, 189, 248, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(56, 189, 248, 0); }
}

/* Success View State */
.success-card {
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 20px;
  animation: scaleUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  flex: 1;
}

.check-icon-circle {
  width: 70px;
  height: 70px;
  background: var(--success);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 36px;
  margin-bottom: 16px;
  box-shadow: 0 0 30px var(--success-glow);
}

/* ========================================== */
/* ПОЛНОЭКРАННЫЙ РЕЖИМ ОПЛАТЫ (QR)            */
/* ========================================== */
body.fullscreen-active .pos-header {
  opacity: 0;
  transform: translateY(-100%);
  pointer-events: none;
  height: 0;
  padding: 0;
  border: none;
}

body.fullscreen-active .tabs-header {
  opacity: 0;
  pointer-events: none;
  height: 0;
  margin: 0;
  padding: 0;
}

body.fullscreen-active .pos-container {
  max-width: 100% !important;
  height: 100% !important;
  padding: 0 !important;
}

body.fullscreen-active .pos-main-panel {
  height: 100% !important;
  border-radius: 0 !important;
  border: none !important;
  box-shadow: none !important;
  background: var(--background) !important;
  justify-content: center !important;
  padding: 24px !important;
}

/* ========================================== */
/* ПОЛНОЭКРАННЫЙ ОВЕРЛЕЙ ОШИБКИ               */
/* ========================================== */
.error-overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(18, 18, 20, 0.98);
  z-index: 9999;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  text-align: center;
  animation: fadeIn 0.3s ease;
}

.error-circle {
  width: 90px;
  height: 90px;
  background: var(--error);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 44px;
  margin-bottom: 24px;
  box-shadow: 0 0 40px rgba(239, 68, 68, 0.5);
  animation: pulseError 1.5s infinite;
}

@keyframes pulseError {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 15px rgba(239, 68, 68, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
}

.error-subtitle {
  font-size: 18px;
  color: var(--text-muted);
  margin-top: 8px;
  margin-bottom: 24px;
}

.error-details {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--surface-border);
  border-radius: 16px;
  padding: 16px 32px;
  margin-bottom: 24px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 16px;
  width: 100%;
  max-width: 320px;
}

.error-details div {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* Toast Notifications */
.toast-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.toast {
  background: #262626;
  border: 1px solid var(--surface-border);
  color: #ffffff;
  padding: 16px 24px;
  border-radius: 14px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  font-weight: 600;
  animation: slideIn 0.3s ease;
}

.toast.error {
  border-color: rgba(239, 68, 68, 0.5);
  background: #2a181a;
  color: #fca5a5;
}

.toast.success {
  border-color: rgba(16, 185, 129, 0.5);
  background: #142820;
  color: #6ee7b7;
}

/* Mobile Client Pay View */
.mobile-pay-container {
  max-width: 440px;
  margin: 0 auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  height: 100%;
  justify-content: center;
}

.client-card {
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: 24px;
  padding: 24px 20px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.5);
  text-align: center;
}

.client-balance-badge {
  margin-top: 16px;
  background: rgba(158, 127, 255, 0.12);
  border: 1px solid rgba(158, 127, 255, 0.25);
  padding: 10px 16px;
  border-radius: 14px;
  font-size: 14px;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.client-balance-badge span {
  white-space: nowrap;
}

.client-balance-badge strong {
  color: var(--secondary);
  font-size: 16px;
  white-space: nowrap;
}

.client-amount-box {
  background: rgba(0,0,0,0.3);
  border-radius: 18px;
  padding: 20px;
  margin: 18px 0;
  border: 1px solid rgba(255,255,255,0.05);
}

.client-amount-val {
  font-size: 36px;
  font-weight: 900;
  color: var(--primary);
  margin-top: 4px;
  white-space: nowrap;
}

.warning-banner {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.4);
  color: #fca5a5;
  padding: 12px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 20px;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes scaleUp {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes slideIn {
  from { opacity: 0; transform: translateX(50px); }
  to { opacity: 1; transform: translateX(0); }
}

/* ========================================== */
/* АДАПТИВНЫЕ СТИЛИ ДЛЯ МОБИЛЬНЫХ УСТРОЙСТВ   */
/* ========================================== */

@media (max-width: 900px) {
  .pos-container {
    padding: 12px;
  }
}

@media (max-width: 500px) {
  /* Делаем контейнер на весь экран */
  .pos-container {
    padding: 0 !important;
    width: 100% !important;
    height: calc(100% - 56px) !important;
    align-items: stretch !important;
  }

  .pos-header {
    padding: 10px 16px;
    height: 56px;
  }
  
  .brand-icon {
    width: 32px;
    height: 32px;
    font-size: 15px;
    border-radius: 8px;
  }

  .brand-text h1 {
    font-size: 15px;
  }

  .brand-text p {
    font-size: 9px;
  }

  .status-badge-online {
    padding: 4px 10px;
    font-size: 10px;
  }

  /* Панель ввода на весь экран без скруглений и рамок */
  .pos-main-panel {
    padding: 16px !important;
    border-radius: 0 !important;
    border: none !important;
    box-shadow: none !important;
    height: 100% !important;
    display: flex !important;
    flex-direction: column !important;
    justify-content: space-between !important;
    background: var(--background) !important;
  }

  .tabs-header {
    gap: 6px;
    padding: 4px;
    margin-bottom: 12px;
  }

  .tab-btn {
    padding: 10px 4px;
    font-size: 12px;
    gap: 4px;
    border-radius: 8px;
  }

  /* Поле ввода суммы */
  .amount-display-wrapper {
    padding: 12px 16px;
    margin-bottom: 12px;
    border-radius: 14px;
  }

  .amount-label {
    font-size: 12px;
  }

  .amount-input {
    font-size: 28px;
    width: 140px;
  }

  .amount-currency {
    font-size: 20px;
  }

  /* Быстрые пресеты */
  .quick-presets {
    gap: 6px;
    margin-bottom: 12px;
  }

  .preset-btn {
    padding: 10px 2px;
    font-size: 11px;
    border-radius: 10px;
  }

  /* Нумпад растягивается на всю оставшуюся высоту */
  .numpad-grid {
    gap: 8px;
    margin-bottom: 16px;
    flex: 1 !important;
    display: grid !important;
    grid-template-rows: repeat(4, 1fr) !important;
  }

  .num-btn {
    padding: 0;
    font-size: 22px;
    border-radius: 14px;
    height: 100% !important;
  }

  /* Кнопка действия */
  .btn-primary {
    padding: 16px;
    font-size: 15px;
    border-radius: 14px;
    margin-bottom: env(safe-area-inset-bottom);
  }

  .mobile-pay-container {
    padding: 12px;
  }

  .client-card {
    padding: 20px 16px;
    border-radius: 18px;
  }

  .client-balance-badge {
    flex-direction: row;
    justify-content: space-between;
    padding: 8px 12px;
    font-size: 11px;
    border-radius: 10px;
  }

  .client-balance-badge strong {
    font-size: 13px;
  }

  .client-amount-box {
    padding: 12px;
    margin: 12px 0;
  }

  .client-amount-val {
    font-size: 28px;
  }
}
</style>
