const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let clientDisplays = [];
let pendingTransactions = {};
let history = [];
let clientBalance = 0;

const CONFIG_PATH = path.join(__dirname, 'config.json');
let config = { serverIp: 'localhost' };
if (fs.existsSync(CONFIG_PATH)) {
  try {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (e) {}
}

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

app.post('/api/create-transaction', (req, res) => {
  const { amount, targetDisplayId } = req.body;
  const txId = 'tx_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
  
  const host = req.headers.host || 'localhost:10000';
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const payUrl = `${protocol}://${host}/pay?amount=${amount}&tx=${txId}`;
  
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(payUrl)}`;

  const transaction = {
    id: txId,
    amount: parseInt(amount, 10),
    qrCode: qrCodeUrl,
    payUrl: payUrl,
    createdAt: Date.now(),
    status: 'pending'
  };

  pendingTransactions[txId] = transaction;

  if (targetDisplayId) {
    io.to(targetDisplayId).emit('show_qr', transaction);
  } else {
    io.emit('show_qr', transaction);
  }

  res.json({ success: true, transaction });
});

app.get('/api/transaction/:txId', (req, res) => {
  const tx = pendingTransactions[req.params.txId];
  if (!tx) {
    return res.status(404).json({ error: 'Transaction not found' });
  }
  res.json({ transaction: tx, balance: clientBalance });
});

app.post('/api/process-payment', (req, res) => {
  const { txId } = req.body;
  const tx = pendingTransactions[txId];

  if (!tx || tx.status !== 'pending') {
    return res.status(400).json({ success: false, error: 'Invalid or expired transaction' });
  }

  if (clientBalance < tx.amount) {
    tx.status = 'failed';
    io.emit('payment_failed', { transaction: tx, reason: 'insufficient_funds' });
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

  io.emit('payment_success', { transaction: tx, newBalance: clientBalance });
  io.emit('client_balance_updated', { balance: clientBalance });

  res.json({ success: true, newBalance: clientBalance });
});

app.post('/api/topup', (req, res) => {
  const { amount } = req.body;
  const topupAmount = parseInt(amount, 10);
  if (topupAmount <= 0) return res.status(400).json({ success: false });

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

app.get('/api/history', (req, res) => {
  res.json({ history });
});

app.post('/api/cancel-transaction', (req, res) => {
  pendingTransactions = {};
  io.emit('transaction_cancelled');
  res.json({ success: true });
});

io.on('connection', (socket) => {
  socket.on('register_display', (data) => {
    const existing = clientDisplays.find(d => d.id === data.id);
    if (existing) {
      existing.socketId = socket.id;
      existing.ip = socket.handshake.address;
    } else {
      clientDisplays.push({
        id: data.id,
        socketId: socket.id,
        name: data.name || `Дисплей ${clientDisplays.length + 1}`,
        ip: socket.handshake.address,
        locked: false
      });
    }
    socket.join(data.id);
    io.emit('update_displays', clientDisplays);
  });

  socket.on('disconnect', () => {
    clientDisplays = clientDisplays.filter(d => d.socketId !== socket.id);
    io.emit('update_displays', clientDisplays);
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`POS сервер запущен на порту ${PORT}`);
  console.log(`Терминал: http://localhost:${PORT}`);
  console.log(`Дисплей покупателя: http://localhost:${PORT}/display`);
});
