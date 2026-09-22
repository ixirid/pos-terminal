const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Хранилище состояния приложения в памяти
let clientDisplays = []; 
let pendingTransactions = {}; 
let history = []; 
let clientBalance = 0; // Единый общий баланс системы (начальный баланс 0)

// === ФАЙЛОВОЕ ХРАНИЛИЩЕ ДЛЯ СОХРАНЕНИЯ БАЛАНСА И ИСТОРИИ ===
const DB_PATH = path.join(__dirname, 'db.json');

function loadDbData() {
  if (fs.existsSync(DB_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
      if (typeof data.balance === 'number') {
        clientBalance = data.balance;
      }
      if (Array.isArray(data.history)) {
        history = data.history;
      }
    } catch (e) {
      console.error('Ошибка чтения db.json:', e);
    }
  } else {
    saveDbData();
  }
}

function saveDbData() {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify({
      balance: clientBalance,
      history: history
    }, null, 2), 'utf8');
  } catch (e) {
    console.error('Ошибка записи в db.json:', e);
  }
}

// Загружаем сохранённые данные при старте сервера
loadDbData();

// Загрузка конфигурационного файла
const CONFIG_PATH = path.join(__dirname, 'config.json');
let config = { serverIp: 'localhost', askTerminal: true };
if (fs.existsSync(CONFIG_PATH)) {
  try {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (e) {
    console.error('Ошибка чтения config.json:', e);
  }
}

function sendTargetedEvent(eventName, payload, targetDisplayId) {
  if (!targetDisplayId) {
    io.emit(eventName, payload);
  } else {
    for (let [socketId, sock] of io.sockets.sockets) {
      const isDisplay = clientDisplays.some(d => d.socketId === socketId);
      const isTarget = clientDisplays.some(d => d.id === targetDisplayId && d.socketId === socketId);
      
      if (!isDisplay || isTarget) {
        sock.emit(eventName, payload);
      }
    }
  }
}

// ==================== HTML РОУТЫ ====================

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'terminal.html'));
});

app.get('/display', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'display.html'));
});

app.get('/client', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'client_portal.html'));
});

app.get('/pay', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'pay.html'));
});

// ==================== API ЭНДПОИНТЫ ====================

app.get('/api/info', (req, res) => {
  res.json({
    config,
    history,
    displays: clientDisplays,
    balance: clientBalance
  });
});

app.get('/api/displays', (req, res) => {
  res.json({ displays: clientDisplays });
});

app.post('/api/settings', (req, res) => {
  if (req.body.askTerminal !== undefined) {
    config.askTerminal = req.body.askTerminal;
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  res.json({ success: true, config });
});

app.post('/api/displays/:id/update', (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  const display = clientDisplays.find(d => d.id === id);
  if (display) {
    if (name) display.name = name;
    io.emit('update_displays', clientDisplays);
    return res.json({ success: true, displays: clientDisplays });
  }
  res.status(404).json({ success: false, error: 'Display not found' });
});

app.post('/api/displays/:id/block', (req, res) => {
  const { id } = req.params;
  const { isBlocked } = req.body;
  const display = clientDisplays.find(d => d.id === id);
  if (display) {
    display.isBlocked = !!isBlocked;
    io.emit('update_displays', clientDisplays);
    
    io.to(display.id).emit('display_block_status', { id: display.id, isBlocked: display.isBlocked });
    if (display.socketId) {
      io.to(display.socketId).emit('display_block_status', { id: display.id, isBlocked: display.isBlocked });
    }

    return res.json({ success: true, displays: clientDisplays });
  }
  res.status(404).json({ success: false, error: 'Display not found' });
});

app.get('/api/receipt/:id', (req, res) => {
  const txId = req.params.id;
  const item = history.find(h => String(h.id) === String(txId));
  if (!item) {
    return res.status(404).send('Чек не найден');
  }
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Чек #${item.id}</title></head><body style="font-family:sans-serif;padding:20px;"><h2>Кассовый чек #${item.id}</h2><p>Тип операции: ${item.type === 'charge' ? 'Оплата' : 'Пополнение'}</p><p>Сумма: <b>${item.amount} ₽</b></p><p>Дата: ${new Date(item.createdAt).toLocaleString()}</p></body></html>`);
});

// Создание транзакции (Генерация QR-кода)
app.post('/api/create-transaction', (req, res) => {
  const { amount, targetDisplayId } = req.body;
  
  const parsedAmount = parseInt(amount, 10);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ success: false, error: 'Invalid transaction amount' });
  }

  const txId = 'tx_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
  
  // Автоматическое определение хоста на Render
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:10000';
  const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  
  const payUrl = `${protocol}://${host}/pay?tx=${txId}&id=${txId}&amount=${parsedAmount}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(payUrl)}`;

  const transaction = {
    id: txId,
    amount: parsedAmount,
    qrCode: qrCodeUrl,
    payUrl: payUrl,
    targetDisplayId: targetDisplayId || null,
    createdAt: Date.now(),
    status: 'pending'
  };

  pendingTransactions[txId] = transaction;
  console.log(`[TX CREATED] ID: ${txId}, URL: ${payUrl}`);

  sendTargetedEvent('show_qr', transaction, targetDisplayId);
  sendTargetedEvent('transaction_created', transaction, targetDisplayId);

  res.json({ success: true, transaction });
});

// Шорткат оплаты картой
app.get('/api/shortcut/pay-active', (req, res) => {
  const activeTx = Object.values(pendingTransactions).filter(tx => tx.status === 'pending');
  if (activeTx.length === 0) {
    return res.status(404).json({ success: false, error: 'No active transactions found' });
  }
  
  const tx = activeTx[activeTx.length - 1];

  if (clientBalance < tx.amount) {
    tx.status = 'failed';
    const failPayload = { transaction: tx, reason: 'insufficient_funds' };
    
    sendTargetedEvent('payment_failed', failPayload, tx.targetDisplayId);
    return res.status(400).json({ success: false, error: 'insufficient_funds', transaction: tx });
  }

  clientBalance -= tx.amount;
  tx.status = 'success';

  history.unshift({
    id: tx.id,
    amount: tx.amount,
    type: 'charge',
    createdAt: Date.now()
  });

  saveDbData(); // Сохраняем измененный баланс и историю в файл

  const successPayload = { transaction: tx, newBalance: clientBalance };
  sendTargetedEvent('payment_success', successPayload, tx.targetDisplayId);

  // Оповещаем весь проект об обновлении общего баланса
  io.emit('client_balance_updated', { balance: clientBalance });

  res.json({ success: true, transaction: tx, newBalance: clientBalance });
});

// Получение статуса транзакции
app.get('/api/transaction/:txId', (req, res) => {
  const reqId = String(req.params.txId);
  const tx = pendingTransactions[reqId] || Object.values(pendingTransactions).find(t => String(t.id) === reqId);
  
  if (!tx) {
    return res.status(404).json({ error: 'Transaction not found' });
  }
  
  res.json({ transaction: tx, balance: clientBalance });
});

// Проведение оплаты (POST)
app.post('/api/process-payment', (req, res) => {
  const { txId } = req.body;
  const reqId = String(txId);
  const tx = pendingTransactions[reqId] || Object.values(pendingTransactions).find(t => String(t.id) === reqId);

  if (!tx || tx.status !== 'pending') {
    return res.status(400).json({ success: false, error: 'Invalid or expired transaction' });
  }

  if (clientBalance < tx.amount) {
    tx.status = 'failed';
    const failPayload = { transaction: tx, reason: 'insufficient_funds' };
    sendTargetedEvent('payment_failed', failPayload, tx.targetDisplayId);

    return res.json({ success: false, error: 'insufficient_funds' });
  }

  clientBalance -= tx.amount;
  tx.status = 'success';

  history.unshift({
    id: tx.id,
    amount: tx.amount,
    type: 'charge',
    createdAt: Date.now()
  });

  saveDbData(); // Сохраняем измененный баланс и историю в файл

  const successPayload = { transaction: tx, newBalance: clientBalance };
  sendTargetedEvent('payment_success', successPayload, tx.targetDisplayId);

  io.emit('client_balance_updated', { balance: clientBalance });

  res.json({ success: true, newBalance: clientBalance });
});

// Пополнение единого баланса
app.post('/api/topup', (req, res) => {
  const { amount } = req.body;
  const topupAmount = parseInt(amount, 10);
  
  if (isNaN(topupAmount) || topupAmount <= 0) {
    return res.status(400).json({ success: false, error: 'Invalid topup amount' });
  }

  clientBalance += topupAmount;
  const txId = 'top_' + Date.now();

  history.unshift({
    id: txId,
    amount: topupAmount,
    type: 'topup',
    createdAt: Date.now()
  });

  saveDbData(); // Сохраняем измененный баланс и историю в файл

  io.emit('client_balance_updated', { balance: clientBalance });
  res.json({ success: true, newBalance: clientBalance });
});

app.get('/api/history', (req, res) => {
  res.json({ history });
});

app.post('/api/cancel-transaction', (req, res) => {
  pendingTransactions = {};
  io.emit('transaction_cancelled');
  res.json({ success: true });
});

// ==================== SOCKET.IO СВЯЗЬ ====================

io.on('connection', (socket) => {
  console.log(`Клиент подключился через WebSocket: ${socket.id}`);

  // При любом подключении сразу же отправляем текущий общий баланс
  socket.emit('client_balance_updated', { balance: clientBalance });

  socket.on('get_balance', () => {
    socket.emit('client_balance_updated', { balance: clientBalance });
  });

  socket.on('register_display', (data) => {
    const displayId = (data && data.id) ? data.id : ('socket_' + socket.id);
    const displayName = (data && data.name) ? data.name : `Дисплей (${socket.id.substring(0, 4)})`;

    let existing = clientDisplays.find(d => d.id === displayId);
    
    if (existing) {
      existing.socketId = socket.id;
      existing.ip = socket.handshake.address;
      existing.name = displayName;
    } else {
      clientDisplays.push({
        id: displayId,
        socketId: socket.id,
        name: displayName,
        ip: socket.handshake.address,
        isBlocked: false
      });
    }

    socket.join(displayId);
    io.emit('update_displays', clientDisplays);
  });

  socket.on('toggle_display_lock', (data) => {
    const { id, isBlocked } = data;
    const display = clientDisplays.find(d => d.id === id);
    if (display) {
      display.isBlocked = !!isBlocked;
      io.emit('update_displays', clientDisplays);
      io.to(display.id).emit('display_block_status', { id: display.id, isBlocked: display.isBlocked });
      if (display.socketId) {
        io.to(display.socketId).emit('display_block_status', { id: display.id, isBlocked: display.isBlocked });
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`Клиент отключился: ${socket.id}`);
    clientDisplays = clientDisplays.filter(d => d.socketId !== socket.id);
    io.emit('update_displays', clientDisplays);
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`POS сервер успешно запущен и работает на порту ${PORT}`);
  console.log(`Терминал доступен по адресу: http://localhost:${PORT}`);
  console.log(`Дисплей покупателя доступен по адресу: http://localhost:${PORT}/display`);
});
