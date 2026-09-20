const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Middleware for parsing JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets from public folder or current directory
app.use(express.static(path.join(__dirname)));

const activeDisplays = new Map(); // id -> { id, name, socketId, online, blocked }
const pendingTransactions = new Map(); // txId -> { txId, amount, payUrl, createdAt }

// POS Terminal main page (fallback to pay.html if index.html is missing)
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'index.html');
  const payPath = path.join(__dirname, 'pay.html');
  
  require('fs').access(indexPath, (err) => {
    if (!err) {
      res.sendFile(indexPath);
    } else {
      require('fs').access(payPath, (err2) => {
        if (!err2) {
          res.sendFile(payPath);
        } else {
          res.status(404).send('Terminal interface file not found.');
        }
      });
    }
  });
});

// Customer display multi-screen page
app.get('/display', (req, res) => {
  const displayPath = path.join(__dirname, 'display.html');
  require('fs').access(displayPath, (err) => {
    if (!err) {
      res.sendFile(displayPath);
    } else {
      res.sendFile(path.join(__dirname, 'pay.html'));
    }
  });
});

app.get('/pay', (req, res) => {
  res.sendFile(path.join(__dirname, 'pay.html'));
});

// API endpoint to verify or fetch transaction details by unique code/id
app.get('/api/transaction/:txId', (req, res) => {
  const { txId } = req.params;
  const tx = pendingTransactions.get(txId);
  
  if (!tx) {
    return res.status(404).json({ success: false, error: 'Транзакция не найдена или истек срок действия' });
  }
  
  res.json({ success: true, transaction: tx });
});

// API endpoint to confirm payment from external client or QR scan page
app.post('/api/pay/confirm', (req, res) => {
  const { txId } = req.body;
  const tx = pendingTransactions.get(txId);

  if (!tx) {
    return res.status(404).json({ success: false, error: 'Транзакция не найдена' });
  }

  // Broadcast success event to all POS terminals and customer displays
  io.emit('payment_completed_external', {
    txId: tx.txId,
    amount: tx.amount,
    targetDisplay: tx.targetDisplay || 'all'
  });

  pendingTransactions.delete(txId);
  res.json({ success: true, message: 'Оплата успешно подтверждена' });
});

io.on('connection', (socket) => {
  console.log(`[Socket] Новое подключение: ${socket.id}`);

  // Register customer display connection
  socket.on('register_display', (data) => {
    const displayId = data && data.displayId ? data.displayId : ('disp_' + socket.id.slice(0, 6));
    const displayName = data && data.name ? data.name : ('Экран #' + displayId);

    activeDisplays.set(socket.id, {
      id: displayId,
      name: displayName,
      socketId: socket.id,
      online: true,
      blocked: false
    });

    socket.join('displays_room');
    broadcastDisplaysList();
  });

  socket.on('request_displays_list', () => {
    broadcastDisplaysList();
  });

  socket.on('get_active_displays', () => {
    broadcastDisplaysList();
  });

  // Handle QR code display command from POS terminal
  socket.on('display_show_qr', (data) => {
    const { txId, amount, targetDisplay, payUrl, qrUrl } = data;
    
    // Store transaction with its unique link
    if (txId) {
      pendingTransactions.set(txId, {
        txId,
        amount,
        payUrl,
        targetDisplay,
        createdAt: Date.now()
      });
    }

    if (targetDisplay === 'all') {
      io.to('displays_room').emit('show_qr_screen', { txId, amount, payUrl, qrUrl });
    } else {
      // Find specific display socket
      for (let [sId, info] of activeDisplays.entries()) {
        if (info.id === targetDisplay || sId === targetDisplay) {
          io.to(sId).emit('show_qr_screen', { txId, amount, payUrl, qrUrl });
          break;
        }
      }
    }
  });

  // Handle welcome screen command
  socket.on('display_show_welcome', (data) => {
    const { targetDisplay } = data || {};
    if (targetDisplay === 'all') {
      io.to('displays_room').emit('show_welcome_screen');
    } else {
      for (let [sId, info] of activeDisplays.entries()) {
        if (info.id === targetDisplay || sId === targetDisplay) {
          io.to(sId).emit('show_welcome_screen');
          break;
        }
      }
    }
  });

  // Handle block/unblock command
  socket.on('display_block', (data) => {
    const { targetDisplay, blocked } = data;
    if (targetDisplay === 'all') {
      for (let info of activeDisplays.values()) {
        info.blocked = blocked;
      }
      io.to('displays_room').emit('set_blocked_status', { blocked });
    } else {
      for (let [sId, info] of activeDisplays.entries()) {
        if (info.id === targetDisplay || sId === targetDisplay) {
          info.blocked = blocked;
          io.to(sId).emit('set_blocked_status', { blocked });
          break;
        }
      }
    }
    broadcastDisplaysList();
  });

  socket.on('sync_balance_only', (data) => {
    socket.broadcast.emit('balance_updated', data);
  });

  socket.on('process_transaction', (data) => {
    socket.broadcast.emit('balance_updated', data);
    io.to('displays_room').emit('show_success_screen', data);
  });

  socket.on('disconnect', () => {
    if (activeDisplays.has(socket.id)) {
      activeDisplays.delete(socket.id);
      broadcastDisplaysList();
    }
    console.log(`[Socket] Отключение: ${socket.id}`);
  });
});

function broadcastDisplaysList() {
  const displaysArr = Array.from(activeDisplays.values());
  io.emit('displays_update', displaysArr);
}

server.listen(PORT, () => {
  console.log(`POS сервер запущен на порту ${PORT}`);
  console.log(`Терминал: http://localhost:${PORT}`);
  console.log(`Дисплей покупателя: http://localhost:${PORT}/display`);
});
