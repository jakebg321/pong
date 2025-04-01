// server.cjs
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// CORS configuration based on environment
const isDev = process.env.NODE_ENV !== 'production';
const ALLOWED_ORIGINS = [
  'http://localhost:5173',  // Vite dev server
  'http://localhost:3000',  // Local server
  'https://pluto3d.onrender.com' // Production server
];

// Configure Socket.IO with proper CORS and WebSocket settings
const io = new Server(server, {
  cors: {
    origin: isDev ? '*' : ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Serve static files in production
if (!isDev) {
  const distPath = path.join(__dirname, 'dist');
  console.log('Serving static files from:', distPath);
  app.use(express.static(distPath));
  
  // Handle SPA routing
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Game constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PADDLE_WIDTH = 10;
const PADDLE_HEIGHT = 100;
const BALL_RADIUS = 10;
const PADDLE_SPEED = 15;
const BALL_SPEED = 7;

// Game state management
const games = new Map();
let waitingPlayer = null;

// Debug state tracking
const debugState = {
  connectedPlayers: new Set(),
  activeGames: new Map(),
  serverStartTime: Date.now(),
  stats: {
    totalGamesPlayed: 0,
    totalPlayersConnected: 0,
    peakConcurrentPlayers: 0,
    currentSearchingPlayers: 0
  },
  recentEvents: []
};

function createGameState() {
  return {
    ball: {
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT / 2,
      dx: (Math.random() > 0.5 ? 1 : -1) * BALL_SPEED,
      dy: (Math.random() > 0.5 ? 1 : -1) * BALL_SPEED,
      radius: BALL_RADIUS
    },
    paddles: {
      player1: {
        x: 50,
        y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2,
        width: PADDLE_WIDTH,
        height: PADDLE_HEIGHT,
        score: 0
      },
      player2: {
        x: CANVAS_WIDTH - 50 - PADDLE_WIDTH,
        y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2,
        width: PADDLE_WIDTH,
        height: PADDLE_HEIGHT,
        score: 0
      }
    },
    score: {
      player1: 0,
      player2: 0
    }
  };
}

// Add event to recent events list
function addDebugEvent(event) {
  const timestamp = new Date().toISOString();
  debugState.recentEvents.unshift({ timestamp, event });
  // Keep only last 10 events
  if (debugState.recentEvents.length > 10) {
    debugState.recentEvents.pop();
  }
  broadcastDebugInfo();
}

// Broadcast debug info to all connected clients
function broadcastDebugInfo() {
  const debugInfo = {
    connectedPlayers: Array.from(debugState.connectedPlayers),
    activeGames: Array.from(debugState.activeGames.keys()),
    stats: debugState.stats,
    recentEvents: debugState.recentEvents,
    uptime: Math.floor((Date.now() - debugState.serverStartTime) / 1000),
  };
  io.emit('debugUpdate', debugInfo);
}

// Broadcast debug info periodically
setInterval(broadcastDebugInfo, 1000);

// Socket connection handling
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);
  debugState.connectedPlayers.add(socket.id);
  debugState.stats.totalPlayersConnected++;
  debugState.stats.peakConcurrentPlayers = Math.max(
    debugState.stats.peakConcurrentPlayers,
    debugState.connectedPlayers.size
  );
  addDebugEvent(`Player connected: ${socket.id}`);

  socket.on('findMatch', () => {
    console.log('Player seeking match:', socket.id);
    debugState.stats.currentSearchingPlayers++;
    addDebugEvent(`Player searching: ${socket.id}`);

    if (waitingPlayer && waitingPlayer !== socket.id) {
      const gameId = `${waitingPlayer}-${socket.id}`;
      const game = {
        id: gameId,
        player1: waitingPlayer,
        player2: socket.id,
        state: createGameState(),
        interval: null,
        lastUpdateTime: Date.now(),
        startTime: Date.now()
      };

      games.set(gameId, game);
      debugState.activeGames.set(gameId, {
        player1: waitingPlayer,
        player2: socket.id,
        startTime: Date.now()
      });
      debugState.stats.totalGamesPlayed++;
      debugState.stats.currentSearchingPlayers -= 2;
      
      // Join both players to a game room
      socket.join(gameId);
      io.sockets.sockets.get(waitingPlayer)?.join(gameId);

      // Notify players
      io.to(waitingPlayer).emit('matchFound', { gameId, playerNumber: 1 });
      io.to(socket.id).emit('matchFound', { gameId, playerNumber: 2 });
      
      waitingPlayer = null;
      startGameLoop(gameId);
      
      addDebugEvent(`Match started: ${gameId}`);
    } else {
      waitingPlayer = socket.id;
      socket.emit('waiting');
      addDebugEvent(`Player waiting: ${socket.id}`);
    }
  });

  socket.on('cancelMatch', () => {
    if (waitingPlayer === socket.id) {
      waitingPlayer = null;
      debugState.stats.currentSearchingPlayers--;
      addDebugEvent(`Player cancelled search: ${socket.id}`);
    }
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    debugState.connectedPlayers.delete(socket.id);
    
    if (waitingPlayer === socket.id) {
      waitingPlayer = null;
      debugState.stats.currentSearchingPlayers--;
    }

    // Handle active games
    for (const [gameId, game] of games.entries()) {
      if (game.player1 === socket.id || game.player2 === socket.id) {
        const otherPlayer = game.player1 === socket.id ? game.player2 : game.player1;
        io.to(otherPlayer).emit('opponentLeft');
        clearInterval(game.interval);
        games.delete(gameId);
        debugState.activeGames.delete(gameId);
        addDebugEvent(`Game ended (disconnect): ${gameId}`);
      }
    }
    
    addDebugEvent(`Player disconnected: ${socket.id}`);
  });
});

function startGameLoop(gameId) {
  const game = games.get(gameId);
  if (!game) return;

  // Reduce update frequency to 30 FPS for better performance
  game.interval = setInterval(() => {
    updateGameState(gameId);
    // Only send updates if there's been a significant change
    if (hasSignificantChange(game.state)) {
      io.to(gameId).emit('gameState', game.state);
    }
  }, 1000 / 30); // 30 FPS
}

// Add function to check if state has changed significantly
function hasSignificantChange(state) {
  // Check if ball or paddle positions have changed significantly
  const threshold = 1; // Minimum change threshold
  return Math.abs(state.ball.dx) > threshold || 
         Math.abs(state.ball.dy) > threshold ||
         Math.abs(state.paddles.player1.y - state.paddles.player1.lastY) > threshold ||
         Math.abs(state.paddles.player2.y - state.paddles.player2.lastY) > threshold;
}

function updateGameState(gameId) {
  const game = games.get(gameId);
  if (!game) return;

  const state = game.state;
  const now = Date.now();
  const deltaTime = (now - game.lastUpdateTime) / (1000 / 30); // Normalize to 30 FPS
  game.lastUpdateTime = now;

  // Store previous paddle positions for change detection
  state.paddles.player1.lastY = state.paddles.player1.y;
  state.paddles.player2.lastY = state.paddles.player2.y;

  // Update ball position with capped speed
  const maxSpeed = 10;
  state.ball.dx = Math.max(Math.min(state.ball.dx, maxSpeed), -maxSpeed);
  state.ball.dy = Math.max(Math.min(state.ball.dy, maxSpeed), -maxSpeed);
  
  state.ball.x += state.ball.dx * deltaTime;
  state.ball.y += state.ball.dy * deltaTime;

  // Ball collision with top and bottom walls
  if (state.ball.y - state.ball.radius < 0) {
    state.ball.y = state.ball.radius;
    state.ball.dy = Math.abs(state.ball.dy);
  } else if (state.ball.y + state.ball.radius > CANVAS_HEIGHT) {
    state.ball.y = CANVAS_HEIGHT - state.ball.radius;
    state.ball.dy = -Math.abs(state.ball.dy);
  }

  // Ball collision with paddles
  const paddles = [state.paddles.player1, state.paddles.player2];
  for (const paddle of paddles) {
    // Check if ball is within paddle's vertical range
    if (state.ball.y >= paddle.y && state.ball.y <= paddle.y + paddle.height) {
      // Check if ball is colliding with paddle
      if (state.ball.x + state.ball.radius > paddle.x && 
          state.ball.x - state.ball.radius < paddle.x + paddle.width) {
        // Calculate relative intersection point (-1 to 1)
        const relativeIntersectY = (state.ball.y - (paddle.y + paddle.height/2)) / (paddle.height/2);
        
        // Calculate new ball direction
        const bounceAngle = relativeIntersectY * Math.PI/3; // Max 60-degree bounce
        const speed = Math.sqrt(state.ball.dx * state.ball.dx + state.ball.dy * state.ball.dy);
        
        // Determine if ball is hitting from left or right
        const isRightPaddle = paddle === state.paddles.player2;
        state.ball.dx = (isRightPaddle ? -1 : 1) * speed * Math.cos(bounceAngle);
        state.ball.dy = speed * Math.sin(bounceAngle);
        
        // Ensure ball doesn't get stuck inside paddle
        state.ball.x = isRightPaddle ? 
          paddle.x - state.ball.radius : 
          paddle.x + paddle.width + state.ball.radius;
      }
    }
  }

  // Score points
  if (state.ball.x - state.ball.radius < 0) {
    state.score.player2++;
    resetBall(state);
  } else if (state.ball.x + state.ball.radius > CANVAS_WIDTH) {
    state.score.player1++;
    resetBall(state);
  }
}

function resetBall(state) {
  state.ball.x = CANVAS_WIDTH / 2;
  state.ball.y = CANVAS_HEIGHT / 2;
  state.ball.dx = (Math.random() > 0.5 ? 1 : -1) * BALL_SPEED;
  state.ball.dy = (Math.random() > 0.5 ? 1 : -1) * BALL_SPEED;
}

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});