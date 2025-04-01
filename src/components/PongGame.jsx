import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const PongGame = () => {
  const canvasRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [gameStatus, setGameStatus] = useState('idle'); // idle, waiting, playing
  const [gameId, setGameId] = useState(null);
  const [playerNumber, setPlayerNumber] = useState(null);
  const [gameState, setGameState] = useState({
    ball: {
      x: 400,
      y: 300,
      dx: 5,
      dy: 5,
      radius: 10
    },
    paddles: {
      player1: {
        x: 50,
        y: 250,
        width: 10,
        height: 100
      },
      player2: {
        x: 740,
        y: 250,
        width: 10,
        height: 100
      }
    },
    score: {
      player1: 0,
      player2: 0
    }
  });

  // Connect to socket server
  useEffect(() => {
    console.log('Initializing socket connection...');
    // Change the URL to match your server in production
    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);

    // Socket event listeners
    newSocket.on('connect', () => {
      console.log('Connected to server with socket ID:', newSocket.id);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    newSocket.on('waiting', () => {
      console.log('Waiting for opponent...');
      setGameStatus('waiting');
    });

    newSocket.on('matchFound', (data) => {
      console.log('Match found!', data);
      setGameId(data.gameId);
      setPlayerNumber(data.playerNumber);
      setGameStatus('playing');
    });

    newSocket.on('gameState', (state) => {
      console.log('Received game state update:', {
        ball: state.ball,
        paddles: state.paddles,
        score: state.score
      });
      setGameState(state);
    });

    newSocket.on('matchCanceled', () => {
      console.log('Match canceled');
      setGameStatus('idle');
    });

    newSocket.on('opponentLeft', () => {
      console.log('Opponent left the game');
      alert('Your opponent has left the game');
      setGameStatus('idle');
      setGameId(null);
      setPlayerNumber(null);
    });

    return () => {
      console.log('Disconnecting socket...');
      newSocket.disconnect();
    };
  }, []);

  // Handle keyboard controls
  useEffect(() => {
    if (!socket || gameStatus !== 'playing') {
      console.log('Keyboard controls not active:', { 
        socket: !!socket, 
        gameStatus,
        socketConnected: socket?.connected 
      });
      return;
    }

    const handleKeyDown = (e) => {
      if (!gameId) {
        console.log('No game ID available');
        return;
      }

      // Only handle game controls if we're in a game
      if (gameStatus !== 'playing') return;

      // Prevent default behavior for game controls
      if (e.key === 'w' || e.key === 's' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
      }

      console.log('Key pressed:', e.key);
      console.log('Current game state:', {
        gameId,
        playerNumber,
        gameStatus
      });

      switch(e.key) {
        case 'w':
        case 'ArrowUp':
          console.log('Sending paddle move up for game:', gameId);
          socket.emit('paddleMove', { gameId, direction: 'up' });
          break;
        case 's':
        case 'ArrowDown':
          console.log('Sending paddle move down for game:', gameId);
          socket.emit('paddleMove', { gameId, direction: 'down' });
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    console.log('Keyboard event listener added');

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      console.log('Keyboard event listener removed');
    };
  }, [socket, gameStatus, gameId, playerNumber]);

  // Handle canvas drawing
  useEffect(() => {
    if (!canvasRef.current || gameStatus !== 'playing') return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const drawGame = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw paddles
      ctx.fillStyle = '#fff';
      const { player1, player2 } = gameState.paddles;
      ctx.fillRect(player1.x, player1.y, player1.width, player1.height);
      ctx.fillRect(player2.x, player2.y, player2.width, player2.height);

      // Draw ball
      const { ball } = gameState;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.closePath();

      // Draw score
      ctx.font = '48px Arial';
      ctx.fillText(gameState.score.player1, canvas.width / 4, 50);
      ctx.fillText(gameState.score.player2, 3 * canvas.width / 4, 50);

      // Draw middle line
      ctx.beginPath();
      ctx.setLineDash([10, 15]);
      ctx.moveTo(canvas.width / 2, 0);
      ctx.lineTo(canvas.width / 2, canvas.height);
      ctx.strokeStyle = '#fff';
      ctx.stroke();
      ctx.closePath();

      // Animation frame
      requestAnimationFrame(drawGame);
    };

    // Start animation
    const animationId = requestAnimationFrame(drawGame);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [gameState, gameStatus]);

  // Handle find match button
  const handleFindMatch = () => {
    if (!socket) {
      console.error('Socket not connected!');
      return;
    }
    console.log('Emitting findMatch event');
    socket.emit('findMatch');
  };

  // Test socket connection
  const testConnection = () => {
    if (!socket) {
      console.error('Socket not connected!');
      return;
    }
    console.log('Socket connection status:', socket.connected);
    console.log('Socket ID:', socket.id);
  };

  // Handle cancel match button
  const handleCancelMatch = () => {
    if (!socket) return;
    socket.emit('cancelMatch');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-dark-bg text-text-primary">
      <h1 className="text-4xl font-fira mb-6 text-matrix-green">Online Pong</h1>
      
      {gameStatus === 'idle' && (
        <div className="text-center mb-6 space-y-4">
          <button
            className="px-6 py-3 bg-matrix-green text-black font-bold rounded hover:bg-opacity-80 transition block w-full"
            onClick={handleFindMatch}
          >
            Find Match
          </button>
          <button
            className="px-6 py-3 bg-blue-500 text-white font-bold rounded hover:bg-opacity-80 transition block w-full"
            onClick={testConnection}
          >
            Test Connection
          </button>
        </div>
      )}

      {gameStatus === 'waiting' && (
        <div className="text-center mb-6">
          <p className="text-matrix-cyan mb-4 animate-pulse">Waiting for opponent...</p>
          <button
            className="px-6 py-3 bg-red-500 text-white font-bold rounded hover:bg-opacity-80 transition"
            onClick={handleCancelMatch}
          >
            Cancel
          </button>
        </div>
      )}

      {gameStatus === 'playing' && (
        <>
          <div className="mb-4">
            <p className="text-center">
              You are Player {playerNumber} 
              <span className="mx-2">|</span>
              Use {playerNumber === 1 ? 'W/S' : '↑/↓'} keys to move
            </p>
          </div>
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className="border-2 border-matrix-green rounded-lg shadow-lg"
          />
        </>
      )}

      <div className="mt-6">
        <h2 className="text-xl font-fira mb-2 text-matrix-cyan">How to Play</h2>
        <ul className="list-disc pl-6">
          <li>Click "Find Match" to look for an opponent</li>
          <li>Player 1 uses W/S keys to move the paddle</li>
          <li>Player 2 uses ↑/↓ arrow keys to move the paddle</li>
          <li>First player to score 10 points wins!</li>
        </ul>
      </div>
    </div>
  );
};

export default PongGame;