```javascript
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(__dirname));

let currentPlayer = 1;
let tileStates = {}; 
let globalQuestions = null;

io.on('connection', (socket) => {
    // Novému připojení zašleme aktuální stav
    socket.emit('init-state', { currentPlayer, tileStates });
    if (globalQuestions) {
        socket.emit('questions-broadcast', globalQuestions);
    }

    // Zrcadlení nahraných otázek druhému zařízení
    socket.on("sync-questions", (questions) => {
        globalQuestions = questions;
        socket.broadcast.emit("questions-broadcast", globalQuestions);
    });

    // Otevření otázky u obou hráčů naráz
    socket.on("node-selected-live", (tileId) => {
        io.emit("open-question-screen", tileId);
    });
    
    // Alias pro starší typ volání
    socket.on("tile-selected-live", (tileId) => {
        io.emit("open-question-screen", tileId);
    });

    // Zpracování barvy políčka
    socket.on('tile-processed-live', (data) => {
        tileStates[data.tileId] = data.status;
        currentPlayer = currentPlayer === 1 ? 2 : 1;
        io.emit('state-updated', { currentPlayer, tileStates });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server uspesne bezi na portu ${PORT}`);
});