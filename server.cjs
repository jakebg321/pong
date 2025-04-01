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

// Socket connection handling
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('findMatch', () => {
    console.log('Player seeking match:', socket.id);

    if (waitingPlayer && waitingPlayer !== socket.id) {
      const gameId = `${waitingPlayer}-${socket.id}`;
      const game = {
        id: gameId,
        player1: waitingPlayer,
        player2: socket.id,
        state: createGameState(),
        interval: null,
        lastUpdateTime: Date.now()
      };

      games.set(gameId, game);
      
      // Join both players to a game room
      socket.join(gameId);
      io.sockets.sockets.get(waitingPlayer)?.join(gameId);

      // Notify players
      io.to(waitingPlayer).emit('matchFound', { gameId, playerNumber: 1 });
      io.to(socket.id).emit('matchFound', { gameId, playerNumber: 2 });
      
      waitingPlayer = null;
      startGameLoop(gameId);
      
      console.log('Match started:', gameId);
    } else {
      waitingPlayer = socket.id;
      socket.emit('waiting');
      console.log('Player waiting:', socket.id);
    }
  });

  socket.on('paddleMove', ({ gameId, direction }) => {
    const game = games.get(gameId);
    if (!game) return;

    const isPlayer1 = socket.id === game.player1;
    const paddleKey = isPlayer1 ? 'player1' : 'player2';
    const paddle = game.state.paddles[paddleKey];

    // Move paddle
    if (direction === 'up') {
      paddle.y = Math.max(0, paddle.y - PADDLE_SPEED);
    } else if (direction === 'down') {
      paddle.y = Math.min(CANVAS_HEIGHT - paddle.height, paddle.y + PADDLE_SPEED);
    }
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    
    if (waitingPlayer === socket.id) {
      waitingPlayer = null;
    }

    // Handle active games
    for (const [gameId, game] of games.entries()) {
      if (game.player1 === socket.id || game.player2 === socket.id) {
        const otherPlayer = game.player1 === socket.id ? game.player2 : game.player1;
        io.to(otherPlayer).emit('opponentLeft');
        clearInterval(game.interval);
        games.delete(gameId);
        console.log('Game ended due to player disconnect:', gameId);
      }
    }
  });
});

function startGameLoop(gameId) {
  const game = games.get(gameId);
  if (!game) return;

  game.interval = setInterval(() => {
    updateGameState(gameId);
    io.to(gameId).emit('gameState', game.state);
  }, 1000 / 60); // 60 FPS
}

function updateGameState(gameId) {
  const game = games.get(gameId);
  if (!game) return;

  const state = game.state;
  const now = Date.now();
  const deltaTime = (now - game.lastUpdateTime) / (1000 / 60); // Normalize to 60 FPS
  game.lastUpdateTime = now;

  // Update ball position
  state.ball.x += state.ball.dx * deltaTime;
  state.ball.y += state.ball.dy * deltaTime;

  // Ball collision with top and bottom walls
  if (state.ball.y - state.ball.radius < 0 || 
      state.ball.y + state.ball.radius > CANVAS_HEIGHT) {
    state.ball.dy *= -1;
  }

  // Ball collision with paddles
  const paddles = [state.paddles.player1, state.paddles.player2];
  for (const paddle of paddles) {
    if (state.ball.x + state.ball.radius > paddle.x &&
        state.ball.x - state.ball.radius < paddle.x + paddle.width &&
        state.ball.y > paddle.y &&
        state.ball.y < paddle.y + paddle.height) {
      
      // Reverse horizontal direction
      state.ball.dx *= -1;
      
      // Add some randomness to vertical direction
      state.ball.dy += (Math.random() - 0.5) * 2;
      
      // Normalize ball speed
      const speed = Math.sqrt(state.ball.dx * state.ball.dx + state.ball.dy * state.ball.dy);
      state.ball.dx = (state.ball.dx / speed) * BALL_SPEED;
      state.ball.dy = (state.ball.dy / speed) * BALL_SPEED;
    }
  }

  // Scoring
  if (state.ball.x + state.ball.radius < 0) {
    // Player 2 scores
    state.score.player2++;
    resetBall(state);
  } else if (state.ball.x - state.ball.radius > CANVAS_WIDTH) {
    // Player 1 scores
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