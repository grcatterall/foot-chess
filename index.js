// Simple Node.js WebSocket backend for Chess-Football Multiplayer
// Requires: npm install ws

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8081;

// Create HTTP server
const server = http.createServer((req, res) => {
  let filePath = '.' + req.url;
  
  // If requesting root, serve index.html
  if (filePath === './') {
    filePath = './index.html';
  }
  
  // Get file extension to set proper content type
  const extname = String(path.extname(filePath)).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm'
  };

  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // File not found
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>', 'utf-8');
      } else {
        // Server error
        res.writeHead(500);
        res.end('Server Error: ' + error.code + ' ..\n');
      }
    } else {
      // Success
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// Create WebSocket server using the HTTP server
const wss = new WebSocket.Server({ server });

// Game state
let players = []; // { id, name, ws }
let gameStarted = false;
let gameState = null; // Can store board, ball position, scores, turn, etc.

function broadcast(data) {
  const msg = JSON.stringify(data);
  players.forEach(p => {
    if (p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(msg);
    }
  });
}

function sendPlayerList() {
  broadcast({ type: 'players', players: players.map(p => p.name) });
}

function resetGameState() {
  gameState = {
    board: null, // Let client initialize
    scores: { white: 0, black: 0 },
    turn: 'white'
  };
}

wss.on('connection', (ws) => {
  const playerId = Date.now() + Math.random();
  let playerName = null;

  ws.on('message', (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (err) {
      console.error('Invalid JSON:', message);
      return;
    }

    switch (data.type) {
      case 'join':
        playerName = data.name || 'Player';
        if (data.password && data.password !== 'ass') {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid password.' }));
            return;
        }
        players.push({ id: playerId, name: playerName, ws });
        console.log(`${playerName} joined.`);
        sendPlayerList();
        broadcast({ type: 'log', message: `${playerName} joined the game.` });
        break;

      case 'start':
        if (!gameStarted && players.length >= 2) {
          gameStarted = true;
          resetGameState();
          broadcast({ type: 'started', state: gameState });
          broadcast({ type: 'log', message: 'Game started!' });
        } else {
          ws.send(JSON.stringify({ type: 'error', message: 'Need at least 2 players to start.' }));
        }
        break;

      case 'move':
      case 'pass':
      case 'shoot':
        // Here we trust the client to send updated game state (for simplicity)
        // In production, validate moves server-side.
        if (gameStarted) {
          gameState = data.state;
          broadcast({ type: 'state', state: gameState });
          broadcast({ type: 'log', message: `${playerName} performed ${data.type}` });
        }
        break;

      default:
        console.log('Unknown message type:', data.type);
    }
  });

  ws.on('close', () => {
    players = players.filter(p => p.id !== playerId);
    sendPlayerList();
    broadcast({ type: 'log', message: `${playerName || 'A player'} disconnected.` });
    if (players.length < 2 && gameStarted) {
      gameStarted = false;
      broadcast({ type: 'log', message: 'Not enough players. Game stopped.' });
    }
  });
});

console.log(`Chess-Football server running on http://localhost:${PORT}`);
console.log(`WebSocket server running on ws://localhost:${PORT}`);

// Start the server
server.listen(PORT);
