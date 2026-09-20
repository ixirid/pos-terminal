const socket = io();

let currentTab = 'charge'; // По умолчанию открывается вкладка оплаты ('charge')
let inputs = {
  topup: '0',
  charge: '0'
};

// Таймеры для автоматического сброса экрана успеха
let successTimeout = null;
let successInterval = null;

// Инициализация при подключении Socket.io
socket.on('init_state', (data) => {
  if (data.config) {
    document.getElementById('serverInfoText').innerText = `http://${data.config.serverIp}:${data.config.port}`;
  }

  // Если уже есть активная транзакция, восстанавливаем QR
  if (data.activeTransaction && data.activeTransaction.status === 'pending') {
    switchTab('charge');
    showQrCodeView(data.activeTransaction);
  }
});

// Слушаем события оплаты от клиентов
socket.on('payment_success', (data) => {
  // Воспроизводим звук успешной оплаты
  window.soundEngine.playPaymentSuccess();

  showSuccessView(data.transaction.amount, data.newBalance);
  showToast(`Оплата ${data.transaction.amount.toLocaleString('ru-RU')} ₽ прошла успешно!`, 'success');
});

// Слушаем события неудачной оплаты (недостаточно средств)
socket.on('payment_failed', (data) => {
  // Воспроизводим звук ошибки
  window.soundEngine.playError();

  // Сбрасываем экран оплаты (выходим из полноэкранного режима QR)
  resetChargeView();

  // Показываем полноэкранный оверлей ошибки
  showErrorOverlay(data.transaction.amount, data.balance);
});

// Переключение Вкладок
function switchTab(tabName) {
  currentTab = tabName;
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

  if (tabName === 'topup') {
    document.getElementById('tabBtnTopup').classList.add('active');
    document.getElementById('tabTopup').classList.add('active');
  } else {
    document.getElementById('tabBtnCharge').classList.add('active');
    document.getElementById('tabCharge').classList.add('active');
  }
}

// Управление Нумпадом
function appendDigit(type, digit) {
  let val = inputs[type];
  if (val === '0') {
    val = digit;
  } else {
    if (val.length < 8) { // Ограничение длины ввода
      val += digit;
    }
  }
  inputs[type] = val;
  updateDisplay(type);
}

function clearInput(type) {
  inputs[type] = '0';
  updateDisplay(type);
}

function backspace(type) {
  let val = inputs[type];
  if (val.length <= 1) {
    val = '0';
  } else {
    val = val.slice(0, -1);
  }
  inputs[type] = val;
  updateDisplay(type);
}

function addPreset(type, amount) {
  let currentVal = parseFloat(inputs[type]) || 0;
  inputs[type] = (currentVal + amount).toString();
  updateDisplay(type);
}

function updateDisplay(type) {
  const formatted = parseInt(inputs[type], 10).toLocaleString('ru-RU');
  document.getElementById(`${type}Amount`).value = formatted;
}

// Слушатель физической клавиатуры ПК
window.addEventListener('keydown', (e) => {
  // Игнорируем если фокус в стандартных текстареа/инпутах
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) && !document.activeElement.readOnly) {
    return;
  }

  // Цифры 0-9 (Верхний ряд и Нумпад)
  if ((e.key >= '0' && e.key <= '9')) {
    appendDigit(currentTab, e.key);
    e.preventDefault();
  } 
  else if (e.key === 'Backspace') {
    backspace(currentTab);
    e.preventDefault();
  } 
  else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C' || e.key === 'С' || e.key === 'с') {
    if (document.getElementById('errorOverlay').style.display === 'flex') {
      closeErrorOverlay();
    } else if (document.getElementById('qrDisplayPanel').style.display === 'flex') {
      cancelTransaction();
    } else {
      clearInput(currentTab);
    }
    e.preventDefault();
  } 
  else if (e.key === 'Enter') {
    e.preventDefault();

    // Если открыт оверлей ошибки, закрываем его по Enter
    if (document.getElementById('errorOverlay').style.display === 'flex') {
      closeErrorOverlay();
      return;
    }

    // Если показан результат оплаты, по Enter начинаем новую операцию
    if (document.getElementById('paymentSuccessCard').style.display === 'flex') {
      resetChargeView();
      return;
    }

    if (currentTab === 'topup') {
      submitTopup();
    } else {
      if (document.getElementById('qrDisplayPanel').style.display === 'flex') {
        // Уже показан QR
      } else {
        createQrTransaction();
      }
    }
  }
});

// Отправка пополнения
async function submitTopup() {
  const amount = parseFloat(inputs.topup);
  if (amount <= 0 || isNaN(amount)) {
    showToast('Укажите сумму больше 0 ₽', 'error');
    window.soundEngine.playError();
    return;
  }

  try {
    const res = await fetch('/api/topup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      window.soundEngine.playTopup();
      showToast(data.message, 'success');
      inputs.topup = '0';
      updateDisplay('topup');
    } else {
      showToast(data.error || 'Ошибка при пополнении', 'error');
      window.soundEngine.playError();
    }
  } catch (err) {
    showToast('Ошибка сети при пополнении', 'error');
    window.soundEngine.playError();
  }
}

// Создание QR-кода на оплату
async function createQrTransaction() {
  const amount = parseFloat(inputs.charge);

  if (amount <= 0 || isNaN(amount)) {
    showToast('Укажите корректную сумму оплаты', 'error');
    window.soundEngine.playError();
    return;
  }

  try {
    const res = await fetch('/api/create-transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      showQrCodeView(data.transaction);
    } else {
      showToast(data.error || 'Не удалось создать QR-код', 'error');
      window.soundEngine.playError();
    }
  } catch (err) {
    showToast('Сбой взаимодействия с сервером', 'error');
    window.soundEngine.playError();
  }
}

function showQrCodeView(transaction) {
  // Включаем полноэкранный режим (скрываем шапку и вкладки)
  document.body.classList.add('fullscreen-active');

  document.getElementById('chargeFormView').style.display = 'none';
  document.getElementById('paymentSuccessCard').style.display = 'none';

  const qrPanel = document.getElementById('qrDisplayPanel');
  qrPanel.style.display = 'flex';

  document.getElementById('qrAmountDisplay').innerText = `${transaction.amount.toLocaleString('ru-RU')} ₽`;
  document.getElementById('qrImage').src = transaction.qrCode;
  document.getElementById('qrLinkText').innerText = transaction.payUrl;
}

// Отмена оплаты
async function cancelTransaction() {
  await fetch('/api/cancel-transaction', { method: 'POST' });
  resetChargeView();
  showToast('Оплата отменена', 'error');
}

function showSuccessView(amount, newBalance) {
  // Очищаем предыдущие таймеры, если они были запущены
  if (successTimeout) clearTimeout(successTimeout);
  if (successInterval) clearInterval(successInterval);

  // Включаем полноэкранный режим для экрана успеха
  document.body.classList.add('fullscreen-active');

  document.getElementById('chargeFormView').style.display = 'none';
  document.getElementById('qrDisplayPanel').style.display = 'none';

  const successCard = document.getElementById('paymentSuccessCard');
  successCard.style.display = 'flex';

  document.getElementById('successAmountText').innerText = `${amount.toLocaleString('ru-RU')} ₽`;
  
  // Отображаем остаток баланса
  if (newBalance !== undefined && newBalance !== null) {
    document.getElementById('successBalanceText').innerText = `${newBalance.toLocaleString('ru-RU')} ₽`;
    document.getElementById('successBalanceWrapper').style.display = 'block';
  } else {
    document.getElementById('successBalanceWrapper').style.display = 'none';
  }

  // Запуск обратного отсчета на 7 секунд
  let timeLeft = 7;
  document.getElementById('successCountdown').innerText = timeLeft;

  successInterval = setInterval(() => {
    timeLeft--;
    if (timeLeft >= 0) {
      document.getElementById('successCountdown').innerText = timeLeft;
    }
  }, 1000);

  successTimeout = setTimeout(() => {
    resetChargeView();
  }, 7000);
}

function resetChargeView() {
  // Очищаем таймеры авто-сброса
  if (successTimeout) {
    clearTimeout(successTimeout);
    successTimeout = null;
  }
  if (successInterval) {
    clearInterval(successInterval);
    successInterval = null;
  }

  // Выключаем полноэкранный режим
  document.body.classList.remove('fullscreen-active');

  // ИСПОЛЬЗУЕМ 'flex' ВМЕСТО 'block' ДЛЯ ПРЕДОТВРАЩЕНИЯ СПЛЮЩИВАНИЯ КНОПОК!
  document.getElementById('chargeFormView').style.display = 'flex';
  document.getElementById('qrDisplayPanel').style.display = 'none';
  document.getElementById('paymentSuccessCard').style.display = 'none';
  inputs.charge = '0';
  updateDisplay('charge');
}

// Функции управления оверлеем ошибки
function showErrorOverlay(required, available) {
  document.getElementById('errorRequiredAmount').innerText = `${required.toLocaleString('ru-RU')} ₽`;
  document.getElementById('errorAvailableBalance').innerText = `${available.toLocaleString('ru-RU')} ₽`;
  document.getElementById('errorOverlay').style.display = 'flex';
}

function closeErrorOverlay() {
  document.getElementById('errorOverlay').style.display = 'none';
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(50px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
