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
    socket.emit('init-state', { currentPlayer, tileStates });
    if(globalQuestions) {
        socket.emit('questions-broadcast', globalQuestions);
    }

    socket.on("sync-questions", (questions) => {
        globalQuestions = questions;
        socket.broadcast.emit("questions-broadcast", globalQuestions);
    });

    socket.on("tile-selected-live", (tileId) => {
        io.emit("open-question-screen", tileId);
    });

    socket.on('tile-processed-live', (data) => {
        tileStates[data.tileId] = data.status;
        currentPlayer = currentPlayer === 1 ? 2 : 1;
        io.emit('state-updated', { currentPlayer, tileStates });
    });
});

server.listen(3000, () => {
    console.log(`Server bezi na http://localhost:3000`);
});
