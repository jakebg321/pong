import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import { SERVER_URL } from '../config';
import DebugPanel from './DebugPanel';

const PongGame = ({ mode = 'local' }) => {
  const canvasRef = useRef(null);
  const requestRef = useRef();
  const previousTimeRef = useRef();
  const socketRef = useRef(null);
  const [debugInfo, setDebugInfo] = useState({});
  
  const [gameStarted, setGameStarted] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [playerNumber, setPlayerNumber] = useState(null);
  const [gameId, setGameId] = useState(null);
  
  const gameStateRef = useRef({
    ball: {
      x: 400,
      y: 300,
      dx: 5,
      dy: 5,
      radius: 10
    },
    player: {
      x: 50,
      y: 250,
      width: 10,
      height: 100,
      dy: 0,
      speed: 8
    },
    opponent: {
      x: 740,
      y: 250,
      width: 10,
      height: 100,
    },
    score: {
      player: 0,
      opponent: 0
    },
    canvas: {
      width: 800,
      height: 600
    }
  });

  const [serverDebugInfo, setServerDebugInfo] = useState(null);

  // Initialize socket connection for multiplayer
  useEffect(() => {
    if (mode === 'multiplayer') {
      console.log('Connecting to server:', SERVER_URL);
      socketRef.current = io(SERVER_URL, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });
      
      socketRef.current.on('connect', () => {
        console.log('Connected to server');
      });

      socketRef.current.on('connect_error', (error) => {
        console.error('Connection error:', error);
        // You might want to show this to the user
        setDebugInfo(prev => ({
          ...prev,
          connectionError: `Connection error: ${error.message}`
        }));
      });
      
      socketRef.current.on('waiting', () => {
        console.log('Waiting for opponent...');
        setIsWaiting(true);
      });
      
      socketRef.current.on('matchFound', ({ gameId, playerNumber }) => {
        console.log(`Match found! Game ID: ${gameId}, Player: ${playerNumber}`);
        setGameId(gameId);
        setPlayerNumber(playerNumber);
        setIsWaiting(false);
        setGameStarted(true);
      });
      
      socketRef.current.on('gameState', (state) => {
        // Update local game state with server state
        gameStateRef.current = {
          ...gameStateRef.current,
          ball: state.ball,
          player: {
            ...gameStateRef.current.player,
            y: playerNumber === 1 ? state.paddles.player1.y : state.paddles.player2.y
          },
          opponent: {
            ...gameStateRef.current.opponent,
            y: playerNumber === 1 ? state.paddles.player2.y : state.paddles.player1.y
          },
          score: {
            player: playerNumber === 1 ? state.score.player1 : state.score.player2,
            opponent: playerNumber === 1 ? state.score.player2 : state.score.player1
          }
        };
      });
      
      socketRef.current.on('opponentLeft', () => {
        console.log('Opponent left the game');
        setGameStarted(false);
        setGameId(null);
        setPlayerNumber(null);
      });

      // Add debug info listener
      socketRef.current.on('debugUpdate', (debugInfo) => {
        setServerDebugInfo(debugInfo);
      });
      
      return () => {
        if (socketRef.current) {
          console.log('Disconnecting from server');
          socketRef.current.disconnect();
        }
      };
    }
  }, [mode]);

  // Handle keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!gameStarted) return;
      
      if (['w', 's', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        
        const direction = ['w', 'ArrowUp'].includes(e.key) ? 'up' : 'down';
        const speed = direction === 'up' ? -gameStateRef.current.player.speed : gameStateRef.current.player.speed;
        
        if (mode === 'multiplayer') {
          socketRef.current.emit('paddleMove', { gameId, direction });
        } else {
          gameStateRef.current.player.dy = speed;
        }
      }
    };

    const handleKeyUp = (e) => {
      if (!gameStarted) return;
      
      if (['w', 's', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        if (mode === 'local') {
          gameStateRef.current.player.dy = 0;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameStarted, mode, gameId]);

  // Update game state (local mode only)
  const updateGameState = () => {
    if (mode === 'multiplayer') return; // Server handles state updates in multiplayer
    
    const state = gameStateRef.current;
    
    // Update ball position
    state.ball.x += state.ball.dx;
    state.ball.y += state.ball.dy;
    
    // Update player paddle position
    state.player.y = Math.max(0, Math.min(
      state.canvas.height - state.player.height,
      state.player.y + state.player.dy
    ));
    
    // Ball collision with top and bottom walls
    if (state.ball.y - state.ball.radius < 0 || 
        state.ball.y + state.ball.radius > state.canvas.height) {
      state.ball.dy *= -1;
    }
    
    // Ball collision with player paddle
    if (
      state.ball.x - state.ball.radius < state.player.x + state.player.width &&
      state.ball.x - state.ball.radius > state.player.x &&
      state.ball.y > state.player.y &&
      state.ball.y < state.player.y + state.player.height
    ) {
      state.ball.dx = Math.abs(state.ball.dx);
      state.ball.dy += (Math.random() * 2 - 1);
    }
    
    // Ball collision with opponent paddle
    if (
      state.ball.x + state.ball.radius > state.opponent.x &&
      state.ball.x + state.ball.radius < state.opponent.x + state.opponent.width &&
      state.ball.y > state.opponent.y &&
      state.ball.y < state.opponent.y + state.opponent.height
    ) {
      state.ball.dx = -Math.abs(state.ball.dx);
      state.ball.dy += (Math.random() * 2 - 1);
    }
    
    // Player scores
    if (state.ball.x > state.canvas.width) {
      state.score.player += 1;
      resetBall();
    }
    
    // Opponent scores
    if (state.ball.x < 0) {
      state.score.opponent += 1;
      resetBall();
    }
    
    // Update debug info
    setDebugInfo({
      gameStarted,
      playerY: state.player.y,
      playerDY: state.player.dy,
      ballX: state.ball.x,
      ballY: state.ball.y,
      timestamp: new Date().toISOString()
    });
  };

  // Reset ball after scoring (local mode only)
  const resetBall = () => {
    if (mode === 'multiplayer') return;
    
    const state = gameStateRef.current;
    state.ball.x = state.canvas.width / 2;
    state.ball.y = state.canvas.height / 2;
    state.ball.dx = (Math.random() > 0.5 ? 5 : -5);
    state.ball.dy = (Math.random() > 0.5 ? 5 : -5);
  };

  // Game animation loop
  const animate = (time) => {
    if (!previousTimeRef.current) {
      previousTimeRef.current = time;
    }

    if (gameStarted && mode === 'local') {
      updateGameState();
    }
    
    drawGame();
    requestRef.current = requestAnimationFrame(animate);
  };

  // Start animation when component mounts
  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [gameStarted]);

  // Draw game on canvas
  const drawGame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const state = gameStateRef.current;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw middle line
    ctx.strokeStyle = '#fff';
    ctx.setLineDash([10, 15]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    
    // Draw paddles
    ctx.fillStyle = '#fff';
    ctx.fillRect(
      state.player.x, 
      state.player.y, 
      state.player.width, 
      state.player.height
    );
    ctx.fillRect(
      state.opponent.x, 
      state.opponent.y, 
      state.opponent.width, 
      state.opponent.height
    );
    
    // Draw ball
    ctx.beginPath();
    ctx.arc(
      state.ball.x, 
      state.ball.y, 
      state.ball.radius, 
      0, 
      Math.PI * 2
    );
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.closePath();
    
    // Draw score
    ctx.font = '48px Arial';
    ctx.fillText(state.score.player, canvas.width / 4, 50);
    ctx.fillText(state.score.opponent, 3 * canvas.width / 4, 50);
  };

  // Start the game
  const startGame = () => {
    if (mode === 'multiplayer') {
      socketRef.current.emit('findMatch');
    } else {
      setGameStarted(true);
    }
  };

  // Cancel matchmaking
  const cancelMatchmaking = () => {
    if (mode === 'multiplayer' && !gameStarted) {
      socketRef.current.emit('cancelMatch');
      setIsWaiting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-dark-bg text-text-primary">
      <h1 className="text-4xl font-fira mb-6 text-matrix-green">
        {mode === 'multiplayer' ? 'Multiplayer' : 'Local'} Pong Game
      </h1>
      
      {!gameStarted && !isWaiting && (
        <div className="mb-6">
          <button
            className="px-6 py-3 bg-matrix-green text-black font-bold rounded hover:bg-opacity-80 transition"
            onClick={startGame}
          >
            {mode === 'multiplayer' ? 'Find Match' : 'Start Game'}
          </button>
        </div>
      )}
      
      {isWaiting && (
        <div className="mb-6">
          <p className="text-matrix-green mb-4">Waiting for opponent...</p>
          <button
            className="px-6 py-3 bg-red-500 text-white font-bold rounded hover:bg-opacity-80 transition"
            onClick={cancelMatchmaking}
          >
            Cancel
          </button>
        </div>
      )}
      
      <canvas
        ref={canvasRef}
        width={gameStateRef.current.canvas.width}
        height={gameStateRef.current.canvas.height}
        className="border-2 border-matrix-green rounded-lg"
      />
      
      <div className="mt-4 text-white">
        <p>
          {gameStarted 
            ? "Use W/S or ↑/↓ arrow keys to move your paddle" 
            : mode === 'multiplayer' 
              ? "Click Find Match to play against another player"
              : "Click Start Game to begin"}
        </p>
        {mode === 'local' && (
          <p className="mt-2">Computer opponent will remain stationary</p>
        )}
      </div>
      
      {/* Debug Info Panel */}
      <div className="mt-4 p-4 bg-gray-800 rounded-lg w-full max-w-md">
        <h3 className="text-matrix-cyan font-bold mb-2">Debug Info</h3>
        <div className="text-sm font-mono">
          <p>Game Started: {debugInfo.gameStarted ? "Yes" : "No"}</p>
          <p>Mode: {mode}</p>
          <p>Server: {SERVER_URL}</p>
          {debugInfo.connectionError && (
            <p className="text-red-500">{debugInfo.connectionError}</p>
          )}
          {mode === 'multiplayer' && (
            <>
              <p>Player Number: {playerNumber || 'N/A'}</p>
              <p>Game ID: {gameId || 'N/A'}</p>
            </>
          )}
          <p>Player Y: {debugInfo.playerY}</p>
          <p>Player Direction: {debugInfo.playerDY}</p>
          <p>Ball Position: ({debugInfo.ballX}, {debugInfo.ballY})</p>
          <p>Last Update: {debugInfo.timestamp}</p>
        </div>
      </div>

      {/* Add DebugPanel */}
      {mode === 'multiplayer' && <DebugPanel debugInfo={serverDebugInfo} />}
    </div>
  );
};

export default PongGame;