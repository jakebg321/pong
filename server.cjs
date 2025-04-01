// server.cjs
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // In production, restrict this to your domain
    methods: ["GET", "POST"]
  }
});

// Serve static files in production
app.use(express.static(path.join(__dirname, 'dist')));

// Game settings
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const BALL_RADIUS = 10;
const PADDLE_WIDTH = 10;
const PADDLE_HEIGHT = 100;

// Waiting room for players
let waitingPlayer = null;
// Active games
const games = new Map();

// Game state factory
function createGameState() {
  return {
    ball: {
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT / 2,
      dx: Math.random() > 0.5 ? 5 : -5,
      dy: Math.random() > 0.5 ? 5 : -5,
      radius: BALL_RADIUS
    },
    paddles: {
      player1: {
        x: 50,
        y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2,
        width: PADDLE_WIDTH,
        height: PADDLE_HEIGHT
      },
      player2: {
        x: CANVAS_WIDTH - 50 - PADDLE_WIDTH,
        y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2,
        width: PADDLE_WIDTH,
        height: PADDLE_HEIGHT
      }
    },
    score: {
      player1: 0,
      player2: 0
    }
  };
}

// Handle socket connections
io.on('connection', (socket) => {
  console.log('A player connected:', socket.id);

  // Player looking for a match
  socket.on('findMatch', () => {
    console.log('Player looking for match:', socket.id);

    if (waitingPlayer && waitingPlayer !== socket.id) {
      // Create a new game with the waiting player
      const gameId = `${waitingPlayer}-${socket.id}`;
      const player1 = waitingPlayer;
      const player2 = socket.id;
      
      console.log(`Starting game: ${gameId}`);
      console.log(`Player 1: ${player1}`);
      console.log(`Player 2: ${player2}`);
      
      // Initialize game state
      games.set(gameId, {
        id: gameId,
        player1,
        player2,
        state: createGameState(),
        interval: null
      });
      
      // Notify both players of the match
      io.to(player1).emit('matchFound', { gameId, playerNumber: 1 });
      io.to(player2).emit('matchFound', { gameId, playerNumber: 2 });
      
      // Clear waiting player
      waitingPlayer = null;
      
      // Start game loop
      startGameLoop(gameId);
    } else {
      // No waiting player, so this player waits
      waitingPlayer = socket.id;
      socket.emit('waiting');
    }
  });

  // Player cancels matchmaking
  socket.on('cancelMatch', () => {
    if (waitingPlayer === socket.id) {
      waitingPlayer = null;
      socket.emit('matchCanceled');
      console.log('Player canceled matchmaking:', socket.id);
    }
  });

  // Player paddle movement
  socket.on('paddleMove', (data) => {
    const { gameId, direction } = data;
    console.log('Received paddle move:', { gameId, direction, socketId: socket.id });
    
    const game = games.get(gameId);
    if (!game) {
      console.log('Game not found:', gameId);
      return;
    }
    
    // Determine which paddle to move
    const isPlayer1 = socket.id === game.player1;
    const paddleKey = isPlayer1 ? 'player1' : 'player2';
    console.log(`Moving ${paddleKey} paddle ${direction}`);
    
    // Move paddle based on direction
    if (direction === 'up') {
      game.state.paddles[paddleKey].y = Math.max(
        0, 
        game.state.paddles[paddleKey].y - 15
      );
    } else if (direction === 'down') {
      game.state.paddles[paddleKey].y = Math.min(
        CANVAS_HEIGHT - game.state.paddles[paddleKey].height,
        game.state.paddles[paddleKey].y + 15
      );
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    
    // Check if player was waiting
    if (waitingPlayer === socket.id) {
      waitingPlayer = null;
    }
    
    // Check if player was in a game
    for (const [gameId, game] of games.entries()) {
      if (game.player1 === socket.id || game.player2 === socket.id) {
        // Notify other player of game end
        const otherPlayer = game.player1 === socket.id ? game.player2 : game.player1;
        io.to(otherPlayer).emit('opponentLeft');
        
        // Clear game interval and remove game
        clearInterval(game.interval);
        games.delete(gameId);
      }
    }
  });
});

// Game loop
function startGameLoop(gameId) {
  const game = games.get(gameId);
  if (!game) return;
  
  game.interval = setInterval(() => {
    updateGameState(gameId);
    
    // Send updated state to both players
    io.to(game.player1).emit('gameState', game.state);
    io.to(game.player2).emit('gameState', game.state);
  }, 1000 / 60); // 60 FPS
}

// Update game state
function updateGameState(gameId) {
  const game = games.get(gameId);
  if (!game) return;
  
  const { state } = game;
  
  // Update ball position
  state.ball.x += state.ball.dx;
  state.ball.y += state.ball.dy;
  
  // Ball collision with top and bottom
  if (state.ball.y + state.ball.radius > CANVAS_HEIGHT || state.ball.y - state.ball.radius < 0) {
    state.ball.dy *= -1;
  }
  
  // Ball collision with paddles
  if (
    state.ball.x - state.ball.radius < state.paddles.player1.x + state.paddles.player1.width &&
    state.ball.y > state.paddles.player1.y &&
    state.ball.y < state.paddles.player1.y + state.paddles.player1.height &&
    state.ball.dx < 0
  ) {
    state.ball.dx *= -1;
  }
  
  if (
    state.ball.x + state.ball.radius > state.paddles.player2.x &&
    state.ball.y > state.paddles.player2.y &&
    state.ball.y < state.paddles.player2.y + state.paddles.player2.height &&
    state.ball.dx > 0
  ) {
    state.ball.dx *= -1;
  }
  
  // Score points
  if (state.ball.x < 0) {
    state.score.player2 += 1;
    resetBall(state);
  }
  
  if (state.ball.x > CANVAS_WIDTH) {
    state.score.player1 += 1;
    resetBall(state);
  }
}

// Reset ball after scoring
function resetBall(state) {
  state.ball.x = CANVAS_WIDTH / 2;
  state.ball.y = CANVAS_HEIGHT / 2;
  state.ball.dx = Math.random() > 0.5 ? 5 : -5;
  state.ball.dy = Math.random() > 0.5 ? 5 : -5;
}

// Start the server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});