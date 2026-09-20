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
let clientBalance = 0; // Баланс счета клиента

// Загрузка конфигурационного файла (если есть)
const CONFIG_PATH = path.join(__dirname, 'config.json');
let config = { serverIp: 'localhost' };
if (fs.existsSync(CONFIG_PATH)) {
  try {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (e) {
    console.error('Ошибка чтения config.json:', e);
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

// Создание новой транзакции (генерация QR-кода и отправка на дисплей)
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
  
  // Генерация ссылки на QR-код через сторонний генератор
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

  // Адресная доставка события QR-кода на конкретный дисплей или массовая рассылка
  if (targetDisplayId) {
    io.to(targetDisplayId).emit('show_qr', transaction);
    // Дублируем для обратной совместимости со старыми клиентами
    io.to(targetDisplayId).emit('transaction_created', transaction);
  } else {
    io.emit('show_qr', transaction);
    io.emit('transaction_created', transaction);
  }

  res.json({ success: true, transaction });
});

// Получение статуса конкретной транзакции
app.get('/api/transaction/:txId', (req, res) => {
  const tx = pendingTransactions[req.params.txId];
  if (!tx) {
    return res.status(404).json({ error: 'Transaction not found' });
  }
  res.json({ transaction: tx, balance: clientBalance });
});

// Обработка проведения оплаты
app.post('/api/process-payment', (req, res) => {
  const { txId } = req.body;
  const tx = pendingTransactions[txId];

  if (!tx || tx.status !== 'pending') {
    return res.status(400).json({ success: false, error: 'Invalid or expired transaction' });
  }

  // Проверка достаточности средств на балансе клиента
  if (clientBalance < tx.amount) {
    tx.status = 'failed';
    
    const failPayload = { transaction: tx, reason: 'insufficient_funds' };
    if (tx.targetDisplayId) {
      io.to(tx.targetDisplayId).emit('payment_failed', failPayload);
    } else {
      io.emit('payment_failed', failPayload);
    }

    return res.json({ success: false, error: 'insufficient_funds' });
  }

  // Списание средств и успешное завершение транзакции
  clientBalance -= tx.amount;
  tx.status = 'success';

  history.unshift({
    id: tx.id,
    amount: tx.amount,
    type: 'charge',
    createdAt: Date.now()
  });

  const successPayload = { transaction: tx, newBalance: clientBalance };
  if (tx.targetDisplayId) {
    io.to(tx.targetDisplayId).emit('payment_success', successPayload);
  } else {
    io.emit('payment_success', successPayload);
  }

  // Рассылаем обновление баланса всем клиентам и терминалам
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

  // Регистрация дисплея строго по уникальному постоянному ID
  socket.on('register_display', (data) => {
    // Если клиент не прислал корректный объект с ID, игнорируем или создаем временный
    const displayId = (data && data.id) ? data.id : ('socket_' + socket.id);
    const displayName = (data && data.name) ? data.name : `Дисплей (${socket.id.substring(0, 4)})`;

    let existing = clientDisplays.find(d => d.id === displayId);
    
    if (existing) {
      // Обновляем сокет-соединение для существующего постоянного дисплея
      existing.socketId = socket.id;
      existing.ip = socket.handshake.address;
      existing.name = displayName;
    } else {
      // Регистрируем новое устройство
      clientDisplays.push({
        id: displayId,
        socketId: socket.id,
        name: displayName,
        ip: socket.handshake.address,
        locked: false
      });
    }

    // Добавляем сокет в комнату, названную в честь постоянного ID дисплея
    socket.join(displayId);
    
    // Рассылаем обновленный список дисплеев на терминалы
    io.emit('update_displays', clientDisplays);
  });

  // Обработка отключения клиента
  socket.on('disconnect', () => {
    console.log(`Клиент отключился: ${socket.id}`);
    
    // Удаляем из списка активных только те, у которых совпадает socketId,
    // чтобы устройство при кратковременном обрыве связи сохраняло свой ID.
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
