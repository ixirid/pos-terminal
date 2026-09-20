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
let clientDisplays = []; // Список подключенных дисплеев покупателя
let pendingTransactions = {}; // Активные транзакции по ID
let history = []; // История операций (оплаты, пополнения)
let clientBalance = 0; // Баланс счета клиента (по умолчанию с запасом для тестов)

// Загрузка конфигурационного файла (если есть)
const CONFIG_PATH = path.join(__dirname, 'config.json');
let config = { serverIp: 'localhost', askTerminal: true };
if (fs.existsSync(CONFIG_PATH)) {
  try {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (e) {
    console.error('Ошибка чтения config.json:', e);
  }
}

// Вспомогательная функция для отправки событий только кассе и конкретному дисплею (если он указан)
function sendTargetedEvent(eventName, payload, targetDisplayId) {
  if (!targetDisplayId) {
    // Если дисплей не выбран — отправляем всем
    io.emit(eventName, payload);
  } else {
    // Если дисплей выбран — отправляем ТОЛЬКО кассе (не-дисплеям) и целевому дисплею
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

// Получение общей информации о системе
app.get('/api/info', (req, res) => {
  res.json({
    config,
    history,
    displays: clientDisplays,
    balance: clientBalance
  });
});

// Получение списка всех активных дисплеев
app.get('/api/displays', (req, res) => {
  res.json({ displays: clientDisplays });
});

// Обновление настроек
app.post('/api/settings', (req, res) => {
  if (req.body.askTerminal !== undefined) {
    config.askTerminal = req.body.askTerminal;
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  res.json({ success: true, config });
});

// Обновление имени дисплея через REST
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

// Блокировка дисплея через REST
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

// Получение чека
app.get('/api/receipt/:id', (req, res) => {
  const txId = req.params.id;
  const item = history.find(h => h.id === txId);
  if (!item) {
    return res.status(404).send('Чек не найден');
  }
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Чек #${item.id}</title></head><body style="font-family:sans-serif;padding:20px;"><h2>Кассовый чек #${item.id}</h2><p>Тип операции: ${item.type === 'charge' ? 'Оплата' : 'Пополнение'}</p><p>Сумма: <b>${item.amount} ₽</b></p><p>Дата: ${new Date(item.createdAt).toLocaleString()}</p></body></html>`);
});

// Создание новой транзакции (Оплата)
app.post('/api/create-transaction', (req, res) => {
  const { amount, targetDisplayId } = req.body;
  
  const parsedAmount = parseInt(amount, 10);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ success: false, error: 'Invalid transaction amount' });
  }

  const txId = 'tx_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
  
  const host = req.headers.host || 'localhost:10000';
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const payUrl = `${protocol}://${host}/pay?amount=${parsedAmount}&tx=${txId}`;
  
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

  // Рассылаем QR только на кассу и целевой дисплей
  sendTargetedEvent('show_qr', transaction, targetDisplayId);
  sendTargetedEvent('transaction_created', transaction, targetDisplayId);

  res.json({ success: true, transaction });
});

// Получение активной транзакции и автоматическое проведение оплаты картой (GET-шорткат)
app.get('/api/shortcut/pay-active', (req, res) => {
  const activeTx = Object.values(pendingTransactions).filter(tx => tx.status === 'pending');
  if (activeTx.length === 0) {
    return res.status(404).json({ success: false, error: 'No active transactions found' });
  }
  
  const tx = activeTx[activeTx.length - 1];

  if (clientBalance < tx.amount) {
    tx.status = 'failed';
    const failPayload = { transaction: tx, reason: 'insufficient_funds' };
    
    // Ошибка (крестик) только на кассу и нужный дисплей
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

  const successPayload = { transaction: tx, newBalance: clientBalance };
  
  // Успех (галочка) только на кассу и нужный дисплей
  sendTargetedEvent('payment_success', successPayload, tx.targetDisplayId);

  io.emit('client_balance_updated', { balance: clientBalance });

  res.json({ success: true, transaction: tx, newBalance: clientBalance });
});

// Получение статуса транзакции
app.get('/api/transaction/:txId', (req, res) => {
  const tx = pendingTransactions[req.params.txId];
  if (!tx) {
    return res.status(404).json({ error: 'Transaction not found' });
  }
  res.json({ transaction: tx, balance: clientBalance });
});

// Обработка проведения оплаты (Списание средств через POST)
app.post('/api/process-payment', (req, res) => {
  const { txId } = req.body;
  const tx = pendingTransactions[txId];

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

  const successPayload = { transaction: tx, newBalance: clientBalance };
  sendTargetedEvent('payment_success', successPayload, tx.targetDisplayId);

  io.emit('client_balance_updated', { balance: clientBalance });

  res.json({ success: true, newBalance: clientBalance });
});

// Пополнение баланса клиента
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

  io.emit('client_balance_updated', { balance: clientBalance });
  res.json({ success: true, newBalance: clientBalance });
});

// Получение истории операций
app.get('/api/history', (req, res) => {
  res.json({ history });
});

// Отмена активных транзакций
app.post('/api/cancel-transaction', (req, res) => {
  pendingTransactions = {};
  io.emit('transaction_cancelled');
  res.json({ success: true });
});

// ==================== SOCKET.IO СВЯЗЬ ====================

io.on('connection', (socket) => {
  console.log(`Клиент подключился через WebSocket: ${socket.id}`);

  // Регистрация дисплея
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

  // Обработчик блокировки/разблокировки через socket
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

// Запуск сервера
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`POS сервер успешно запущен и работает на порту ${PORT}`);
  console.log(`Терминал доступен по адресу: http://localhost:${PORT}`);
  console.log(`Дисплей покупателя доступен по адресу: http://localhost:${PORT}/display`);
});
