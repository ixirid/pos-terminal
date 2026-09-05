const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

// Загрузка конфигурации
let config = { serverIp: 'localhost', port: 3000 };
try {
  const configPath = path.join(__dirname, 'config.json');
  if (fs.existsSync(configPath)) {
    const rawConfig = fs.readFileSync(configPath, 'utf8');
    config = { ...config, ...JSON.parse(rawConfig) };
  }
} catch (err) {
  console.error('Ошибка чтения config.json, используем значения по умолчанию:', err.message);
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Настройка CORS для всего приложения
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-Memory Хранилище
let state = {
  balance: 0,
  activeTransaction: null, // { id, amount, status: 'pending'|'paid'|'cancelled', createdAt }
  history: [] // История последних транзакций
};

// Динамическое формирование ссылки для QR-кода на основе текущего хоста запроса
function getPayUrl(req, transactionId) {
  const protocol = req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}/pay/${transactionId}`;
}

// REST API
// Получение текущей конфигурации
app.get('/api/info', (req, res) => {
  res.json({
    config,
    activeTransaction: state.activeTransaction,
    history: state.history
  });
});

// ТЕСТОВЫЙ ЭНДПОИНТ ДЛЯ ПРОВЕРКИ СВЯЗИ С IPHONE
app.get('/api/shortcut/test', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.json({
    success: true,
    message: "Связь с сервером успешно установлена! Код сервера обновлен.",
    currentBalance: state.balance
  });
});

// Создание транзакции на оплату (без предварительной проверки баланса)
app.post('/api/create-transaction', async (req, res) => {
  try {
    const amount = parseFloat(req.body.amount);

    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Укажите корректную сумму оплаты' });
    }

    const transactionId = 'tx_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const payUrl = getPayUrl(req, transactionId);

    // Генерация QR-кода в формате DataURL
    const qrCodeDataUrl = await QRCode.toDataURL(payUrl, {
      margin: 1,
      color: {
        dark: '#171717',
        light: '#FFFFFF'
      },
      width: 320
    });

    state.activeTransaction = {
      id: transactionId,
      amount,
      status: 'pending',
      payUrl,
      qrCode: qrCodeDataUrl,
      createdAt: new Date().toISOString()
    };

    // Оповещаем терминал о создании транзакции
    io.emit('transaction_created', state.activeTransaction);

    res.json({
      success: true,
      transaction: state.activeTransaction
    });
  } catch (err) {
    console.error('Ошибка создания транзакции:', err);
    res.status(500).json({ error: 'Ошибка сервера при создании QR-кода' });
  }
});

// Запрос данных транзакции для клиента (передаем баланс счета)
app.get('/api/transaction/:id', (req, res) => {
  const { id } = req.params;
  if (state.activeTransaction && state.activeTransaction.id === id) {
    return res.json({
      found: true,
      transaction: state.activeTransaction,
      clientBalance: state.balance,
      balanceAvailable: state.balance >= state.activeTransaction.amount
    });
  }
  
  // Проверяем в истории
  const historical = state.history.find(t => t.id === id);
  if (historical) {
    return res.json({
      found: true,
      transaction: historical,
      clientBalance: state.balance,
      balanceAvailable: false
    });
  }

  res.status(404).json({ error: 'Транзакция не найдена или истекла' });
});

// Подтверждение оплаты клиентом
app.post('/api/pay/:id', (req, res) => {
  const { id } = req.params;

  if (!state.activeTransaction || state.activeTransaction.id !== id) {
    return res.status(404).json({ error: 'Активная транзакция не найдена' });
  }

  if (state.activeTransaction.status === 'paid') {
    return res.status(400).json({ error: 'Транзакция уже оплачена' });
  }

  const amount = state.activeTransaction.amount;

  // Проверка баланса в момент оплаты клиентом
  if (amount > state.balance) {
    const failedTx = { ...state.activeTransaction };
    state.activeTransaction = null; // Сбрасываем активную транзакцию

    // Оповещаем терминал о неудачной оплате
    io.emit('payment_failed', {
      transaction: failedTx,
      reason: 'insufficient_funds',
      balance: state.balance
    });

    return res.status(400).json({
      error: `Недостаточно средств на балансе! Доступно: ${state.balance.toLocaleString('ru-RU')} ₽`
    });
  }

  // Списание с баланса
  state.balance -= amount;
  state.activeTransaction.status = 'paid';
  state.activeTransaction.paidAt = new Date().toISOString();

  const completedTx = { ...state.activeTransaction, type: 'payment' };

  // Добавляем в историю
  state.history.unshift(completedTx);
  if (state.history.length > 20) state.history.pop();

  state.activeTransaction = null;

  // Оповещаем терминал
  io.emit('payment_success', {
    transaction: completedTx,
    newBalance: state.balance,
    history: state.history
  });

  res.json({
    success: true,
    message: 'Оплата успешно произведена!',
    transaction: completedTx,
    newBalance: state.balance
  });
});

// ОБРАБОТЧИК ДЛЯ БЫСТРЫХ КОМАНД (ЯВНО ПОДДЕРЖИВАЕТ И GET, И POST, И OPTIONS)
const handleShortcutPay = (req, res) => {
  // Добавляем заголовки CORS вручную для надежности iOS-запросов
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  if (!state.activeTransaction || state.activeTransaction.status !== 'pending') {
    return res.status(400).json({
      success: false,
      error: 'Нет активного счета',
      message: 'На терминале сейчас нет открытых счетов для оплаты.'
    });
  }

  const amount = state.activeTransaction.amount;

  if (amount > state.balance) {
    const failedTx = { ...state.activeTransaction };
    state.activeTransaction = null; // Сбрасываем активную транзакцию

    // Оповещаем терминал о неудачной оплате
    io.emit('payment_failed', {
      transaction: failedTx,
      reason: 'insufficient_funds',
      balance: state.balance
    });

    return res.status(400).json({
      success: false,
      error: 'Недостаточно средств',
      message: `Недостаточно средств. Счет: ${amount} ₽. Баланс: ${state.balance} ₽.`
    });
  }

  // Проводим оплату
  state.balance -= amount;
  state.activeTransaction.status = 'paid';
  state.activeTransaction.paidAt = new Date().toISOString();

  const completedTx = { ...state.activeTransaction, type: 'payment' };

  state.history.unshift(completedTx);
  if (state.history.length > 20) state.history.pop();

  state.activeTransaction = null;

  // Оповещаем терминал по WebSockets
  io.emit('payment_success', {
    transaction: completedTx,
    newBalance: state.balance,
    history: state.history
  });

  res.json({
    success: true,
    amount: amount,
    newBalance: state.balance,
    message: `Успешно оплачено ${amount.toLocaleString('ru-RU')} ₽. Остаток: ${state.balance.toLocaleString('ru-RU')} ₽.`
  });
};

// Регистрируем обработчик на все методы
app.get('/api/shortcut/pay-active', handleShortcutPay);
app.post('/api/shortcut/pay-active', handleShortcutPay);
app.all('/api/shortcut/pay-active', handleShortcutPay);

// Отмена транзакции
app.post('/api/cancel-transaction', (req, res) => {
  if (state.activeTransaction) {
    state.activeTransaction.status = 'cancelled';
    io.emit('transaction_cancelled', { id: state.activeTransaction.id });
    state.activeTransaction = null;
  }
  res.json({ success: true });
});

// Пополнение баланса
app.post('/api/topup', (req, res) => {
  const amount = parseFloat(req.body.amount);

  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Укажите корректную сумму для пополнения' });
  }

  state.balance += amount;

  const topupRecord = {
    id: 'topup_' + Date.now(),
    type: 'topup',
    amount: amount,
    createdAt: new Date().toISOString()
  };

  state.history.unshift(topupRecord);
  if (state.history.length > 20) state.history.pop();

  // Оповещаем по WebSockets
  io.emit('balance_updated', {
    newBalance: state.balance,
    addedAmount: amount,
    history: state.history
  });

  res.json({
    success: true,
    newBalance: state.balance,
    message: `Баланс успешно пополнен на ${amount.toLocaleString('ru-RU')} ₽`
  });
});

// Маршруты страниц
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'terminal.html'));
});

app.get('/pay/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'pay.html'));
});

// Socket.io соединения
io.on('connection', (socket) => {
  socket.emit('init_state', {
    activeTransaction: state.activeTransaction,
    history: state.history,
    config
  });

  socket.on('disconnect', () => {});
});

const PORT = process.env.PORT || config.port || 3000;
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 POS Терминал запущен!`);
  console.log(`🖥  Панель Терминала (ПК): http://localhost:${PORT}`);
  console.log(`🌐 Внешний адрес: http://${config.serverIp}:${PORT}`);
  console.log(`====================================================`);
});