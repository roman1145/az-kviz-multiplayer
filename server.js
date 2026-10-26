const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(express.static(__dirname));

let currentPlayer = 1;
let tileStates = {}; 

io.on('connection', (socket) => {
    console.log('Nový hráč se právě připojil!');

    socket.emit('init-state', { currentPlayer, tileStates });

    socket.on('tile-clicked', (data) => {
        tileStates[data.tileId] = data.status;
        currentPlayer = currentPlayer === 1 ? 2 : 1;
        io.emit('state-updated', { currentPlayer, tileStates });
    });

    socket.on('disconnect', () => {
        console.log('Hráč se odpojil.');
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server úspěšně běží na http://localhost:${PORT}`);
});
