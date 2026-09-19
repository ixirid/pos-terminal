const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const QRCode = require('qrcode');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// База данных в памяти
let clientBalance = 5000; // Начальный баланс клиента
const activeDisplays = new Map(); // Хранилище активных дисплеев
const receipts = []; // История чеков
let currentTransaction = null;

let settings = {
  askEveryTime: false,
  defaultDisplayId: null
};

// Маршруты страниц
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views', 'terminal.html')));
app.get('/display', (req, res) => res.sendFile(path.join(__dirname, 'views', 'display.html')));
app.get('/client', (req, res) => res.sendFile(path.join(__dirname, 'views', 'client.html')));
app.get('/pay', (req, res) => res.sendFile(path.join(__dirname, 'views', 'payment.html')));

// API
app.get('/api/info', (req, res) => {
  res.json({
    balance: clientBalance,
    displays: Array.from(activeDisplays.values()),
    settings: settings
  });
});

app.get('/api/receipts', (req, res) => {
  res.json(receipts);
});

app.get('/api/receipts/:id/download', (req, res) => {
  const receipt = receipts.find(r => r.id === req.params.id);
  if (!receipt) {
    return res.status(404).send('Чек не найден');
  }
  
  const receiptText = `
========================================
           ЧЕК ОПЛАТЫ #${receipt.id}
========================================
Дата: ${new Date(receipt.date).toLocaleString('ru-RU')}
Тип операции: ${receipt.type === 'charge' ? 'Списание' : 'Пополнение'}
Сумма: ${receipt.amount.toLocaleString('ru-RU')} ₽
Остаток на карте: ${receipt.cardRemaining.toLocaleString('ru-RU')} ₽
Статус: УСПЕШНО
========================================
Спасибо за покупку!
`;
  
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=receipt_${receipt.id}.txt`);
  res.send(receiptText);
});

app.post('/api/create-transaction', async (req, res) => {
  const { amount, displayId } = req.body;
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Некорректная сумма' });
  }

  const txId = 'TX-' + Math.random().toString(36).substring(2, 9).toUpperCase();
  const payUrl = `${req.protocol}://${req.get('host')}/pay?tx=${txId}`;
  
  let qrCodeDataUri = '';
  try {
    qrCodeDataUri = await QRCode.toDataURL(payUrl);
  } catch (err) {
    qrCodeDataUri = '';
  }

  currentTransaction = {
    id: txId,
    amount: parseInt(amount, 10),
    displayId: displayId || settings.defaultDisplayId,
    qrCode: qrCodeDataUri,
    status: 'pending'
  };

  // Отправляем транзакцию на дисплей
  io.emit('new_transaction', currentTransaction);

  res.json({ success: true, transaction: currentTransaction });
});

app.post('/api/pay-qr', (req, res) => {
  const { txId } = req.body;
  if (!currentTransaction || currentTransaction.id !== txId) {
    return res.status(400).json({ success: false, message: 'Транзакция не найдена или истекла' });
  }

  const amount = currentTransaction.amount;
  if (clientBalance < amount) {
    io.emit('payment_failed', {
      transaction: currentTransaction,
      message: 'Недостаточно средств'
    });
    return res.status(400).json({ success: false, message: 'Недостаточно средств на карте' });
  }

  // Списание средств
  clientBalance -= amount;
  currentTransaction.status = 'success';

  const receipt = {
    id: 'REC-' + Math.floor(100000 + Math.random() * 900000),
    amount: amount,
    type: 'charge',
    date: new Date().toISOString(),
    cardRemaining: clientBalance
  };
  receipts.unshift(receipt);

  io.emit('payment_success', {
    transaction: currentTransaction,
    receipt: receipt,
    cardRemaining: clientBalance
  });

  const completedTx = currentTransaction;
  currentTransaction = null;

  res.json({ success: true, receipt: receipt, cardRemaining: clientBalance });
});

app.post('/api/topup', (req, res) => {
  const amount = parseInt(req.body.amount, 10);
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Некорректная сумма' });

  clientBalance += amount;
  const receipt = {
    id: 'REC-' + Math.floor(100000 + Math.random() * 900000),
    amount: amount,
    type: 'topup',
    date: new Date().toISOString(),
    cardRemaining: clientBalance
  };
  receipts.unshift(receipt);

  io.emit('balance_updated', { balance: clientBalance });
  res.json({ success: true, balance: clientBalance, receipt: receipt });
});

app.post('/api/cancel-transaction', (req, res) => {
  currentTransaction = null;
  io.emit('transaction_cancelled');
  res.json({ success: true });
});

app.post('/api/terminal/settings', (req, res) => {
  settings = { ...settings, ...req.body };
  io.emit('settings_updated', settings);
  res.json({ success: true, settings });
});

// Socket.io обработка дисплеев и терминалов
io.on('connection', (socket) => {
  socket.on('register_display', (data) => {
    activeDisplays.set(socket.id, {
      id: socket.id,
      name: data.name || 'Дисплей ' + socket.id.substring(0, 4),
      isLocked: false
    });
    io.emit('update_displays', Array.from(activeDisplays.values()));
  });

  socket.on('rename_display', ({ id, name }) => {
    if (activeDisplays.has(id)) {
      activeDisplays.get(id).name = name;
      io.emit('update_displays', Array.from(activeDisplays.values()));
    }
  });

  socket.on('toggle_lock_display', ({ id }) => {
    if (activeDisplays.has(id)) {
      const disp = activeDisplays.get(id);
      disp.isLocked = !disp.isLocked;
      io.to(id).emit(disp.isLocked ? 'terminal_locked' : 'terminal_unlocked');
      io.emit('update_displays', Array.from(activeDisplays.values()));
    }
  });

  socket.on('disconnect', () => {
    if (activeDisplays.has(socket.id)) {
      activeDisplays.delete(socket.id);
      io.emit('update_displays', Array.from(activeDisplays.values()));
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
