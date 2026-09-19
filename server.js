const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

let config = { serverIp: 'localhost', port: 3000, askTerminal: true };
try {
  const configPath = path.join(__dirname, 'config.json');
  if (fs.existsSync(configPath)) {
    const rawConfig = fs.readFileSync(configPath, 'utf8');
    config = { ...config, ...JSON.parse(rawConfig) };
  }
} catch (err) {
  console.error('Ошибка чтения config.json:', err.message);
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-Memory Хранилище
let state = {
  balance: 5000, // Начальный баланс для тестов
  activeTransaction: null,
  history: [], // [{ id, type, amount, createdAt, paidAt, receiptId }]
  displays: [] // [{ id, name, ip, isBlocked, lastSeen }]
};

function getPayUrl(req, transactionId) {
  const protocol = req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}/pay/${transactionId}`;
}

// REST API
app.get('/api/info', (req, res) => {
  res.json({
    config,
    balance: state.balance,
    activeTransaction: state.activeTransaction,
    history: state.history,
    displays: state.displays
  });
});

app.get('/api/shortcut/test', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.json({
    success: true,
    message: "Связь с сервером установлена!",
    currentBalance: state.balance
  });
});

// Настройка "спрашивать каждый раз"
app.post('/api/settings', (req, res) => {
  if (req.body.askTerminal !== undefined) {
    config.askTerminal = !!req.body.askTerminal;
  }
  res.json({ success: true, config });
});

// Управление дисплеями
app.get('/api/displays', (req, res) => {
  res.json({ displays: state.displays });
});

app.post('/api/displays/register', (req, res) => {
  const { id, name } = req.body;
  if (!id) return res.status(400).json({ error: 'ID дисплея обязателен' });

  const clientIp = req.ip || req.connection.remoteAddress;
  let display = state.displays.find(d => d.id === id);

  if (display) {
    display.ip = clientIp;
    display.lastSeen = Date.now();
  } else {
    state.displays.push({
      id,
      name: name || `Дисплей ${id.slice(0, 4)}`,
      ip: clientIp,
      isBlocked: false,
      lastSeen: Date.now()
    });
  }
  io.emit('displays_updated', { displays: state.displays });
  res.json({ success: true });
});

app.post('/api/displays/:id/update', (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  const display = state.displays.find(d => d.id === id);
  if (display && name) {
    display.name = name;
    io.emit('displays_updated', { displays: state.displays });
  }
  res.json({ success: true });
});

app.post('/api/displays/:id/block', (req, res) => {
  const { id } = req.params;
  const { isBlocked } = req.body;
  const display = state.displays.find(d => d.id === id);
  if (display) {
    display.isBlocked = !!isBlocked;
    io.emit('display_block_status', { id, isBlocked: display.isBlocked });
    io.emit('displays_updated', { displays: state.displays });
  }
  res.json({ success: true });
});

// Создание транзакции
app.post('/api/create-transaction', async (req, res) => {
  try {
    const amount = parseFloat(req.body.amount);
    const targetDisplayId = req.body.targetDisplayId || null;

    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Укажите корректную сумму' });
    }

    const transactionId = 'tx_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const payUrl = getPayUrl(req, transactionId);

    const qrCodeDataUrl = await QRCode.toDataURL(payUrl, {
      margin: 1,
      color: { dark: '#171717', light: '#FFFFFF' },
      width: 320
    });

    state.activeTransaction = {
      id: transactionId,
      amount,
      status: 'pending',
      payUrl,
      qrCode: qrCodeDataUrl,
      targetDisplayId,
      createdAt: new Date().toISOString()
    };

    io.emit('transaction_created', state.activeTransaction);

    res.json({ success: true, transaction: state.activeTransaction });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера при создании QR-кода' });
  }
});

// Данные транзакции для страницы оплаты
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

// Подтверждение оплаты
app.post('/api/pay/:id', (req, res) => {
  const { id } = req.params;

  if (!state.activeTransaction || state.activeTransaction.id !== id) {
    return res.status(404).json({ error: 'Активная транзакция не найдена' });
  }

  if (state.activeTransaction.status === 'paid') {
    return res.status(400).json({ error: 'Транзакция уже оплачена' });
  }

  const amount = state.activeTransaction.amount;

  if (amount > state.balance) {
    const failedTx = { ...state.activeTransaction };
    state.activeTransaction = null;

    io.emit('payment_failed', {
      transaction: failedTx,
      reason: 'insufficient_funds',
      balance: state.balance
    });

    return res.status(400).json({
      error: `Недостаточно средств на балансе! Доступно: ${state.balance.toLocaleString('ru-RU')} ₽`
    });
  }

  state.balance -= amount;
  state.activeTransaction.status = 'paid';
  state.activeTransaction.paidAt = new Date().toISOString();

  const completedTx = { ...state.activeTransaction, type: 'payment' };

  state.history.unshift(completedTx);
  if (state.history.length > 50) state.history.pop();

  state.activeTransaction = null;

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

// История чеков
app.get('/api/history', (req, res) => {
  res.json({ history: state.history });
});

// Скачивание уникального чека в текстовом формате
app.get('/api/receipt/:id', (req, res) => {
  const { id } = req.params;
  const tx = state.history.find(t => t.id === id);
  if (!tx) {
    return res.status(404).send('Чек не найден');
  }

  const receiptText = `
========================================
           ОФИЦИАЛЬНЫЙ ЧЕК SberPay
========================================
Идентификатор (ID): ${tx.id}
Тип операции: Безналичная оплата
Сумма: ${tx.amount.toLocaleString('ru-RU')} ₽
Дата создания: ${tx.createdAt}
Дата оплаты: ${tx.paidAt || tx.createdAt}
Статус: Успешно оплачено
Остаток на карте после оплаты: ${state.balance.toLocaleString('ru-RU')} ₽
========================================
      Спасибо за использование SberPay!
========================================
  `.trim();

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="receipt_${tx.id}.txt"`);
  res.send(receiptText);
});

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
    return res.status(400).json({ error: 'Укажите корректную сумму' });
  }

  state.balance += amount;

  const topupRecord = {
    id: 'topup_' + Date.now(),
    type: 'topup',
    amount: amount,
    createdAt: new Date().toISOString()
  };

  state.history.unshift(topupRecord);
  if (state.history.length > 50) state.history.pop();

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

// Страницы
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'terminal.html'));
});

app.get('/pay/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'pay.html'));
});

app.get('/display', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'display.html'));
});

app.get('/client', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'client_portal.html'));
});

io.on('connection', (socket) => {
  socket.emit('init_state', {
    activeTransaction: state.activeTransaction,
    history: state.history,
    displays: state.displays,
    config
  });
});

const PORT = process.env.PORT || config.port || 3000;
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 POS Терминал обновлен и запущен!`);
  console.log(`🖥  Панель Терминала: http://localhost:${PORT}`);
  console.log(`📺 Клиентский Дисплей: http://localhost:${PORT}/display`);
  console.log(`👤 Портал Клиента: http://localhost:${PORT}/client`);
  console.log(`====================================================`);
});
