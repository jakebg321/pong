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

  // Add prediction state
  const [predictedState, setPredictedState] = useState(null);
  const lastUpdateTime = useRef(Date.now());
  const pendingMoves = useRef([]);

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

  // Handle keyboard controls with prediction
  useEffect(() => {
    if (!socket || gameStatus !== 'playing') return;

    const handleKeyDown = (e) => {
      if (!gameId) return;
      if (gameStatus !== 'playing') return;

      if (e.key === 'w' || e.key === 's' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
      }

      const direction = (e.key === 'w' || e.key === 'ArrowUp') ? 'up' : 'down';
      const move = {
        direction,
        timestamp: Date.now()
      };

      // Add to pending moves
      pendingMoves.current.push(move);

      // Update local prediction immediately
      const paddle = playerNumber === 1 ? 'player1' : 'player2';
      const newState = { ...gameState };
      const paddleSpeed = 15;
      const deltaY = direction === 'up' ? -paddleSpeed : paddleSpeed;
      
      newState.paddles[paddle].y = Math.max(
        0,
        Math.min(CANVAS_HEIGHT - newState.paddles[paddle].height,
          newState.paddles[paddle].y + deltaY)
      );

      setPredictedState(newState);
      socket.emit('paddleMove', { gameId, direction });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [socket, gameStatus, gameId, playerNumber, gameState]);

  // Handle game state updates with interpolation
  useEffect(() => {
    if (!socket) return;

    socket.on('gameState', (serverState) => {
      const now = Date.now();
      const latency = now - lastUpdateTime.current;
      lastUpdateTime.current = now;

      // Remove processed moves
      pendingMoves.current = pendingMoves.current.filter(
        move => move.timestamp > now - latency
      );

      // Interpolate between predicted and server state
      const interpolatedState = interpolateStates(predictedState, serverState);
      setGameState(interpolatedState);
      setPredictedState(null);
    });
  }, [socket]);

  // Interpolation function
  const interpolateStates = (predicted, server) => {
    if (!predicted) return server;

    const alpha = 0.3; // Interpolation factor
    const interpolated = { ...server };

    // Interpolate paddle positions
    interpolated.paddles.player1.y = 
      predicted.paddles.player1.y * alpha + 
      server.paddles.player1.y * (1 - alpha);
    
    interpolated.paddles.player2.y = 
      predicted.paddles.player2.y * alpha + 
      server.paddles.player2.y * (1 - alpha);

    return interpolated;
  };

  // Update canvas drawing to use interpolated state
  useEffect(() => {
    if (!canvasRef.current || gameStatus !== 'playing') return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const drawGame = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Use interpolated state for smooth rendering
      const state = predictedState || gameState;
      
      // Draw paddles
      ctx.fillStyle = '#fff';
      const { player1, player2 } = state.paddles;
      ctx.fillRect(player1.x, player1.y, player1.width, player1.height);
      ctx.fillRect(player2.x, player2.y, player2.width, player2.height);

      // Draw ball
      const { ball } = state;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.closePath();

      // Draw score
      ctx.font = '48px Arial';
      ctx.fillText(state.score.player1, canvas.width / 4, 50);
      ctx.fillText(state.score.player2, 3 * canvas.width / 4, 50);

      // Draw middle line
      ctx.beginPath();
      ctx.setLineDash([10, 15]);
      ctx.moveTo(canvas.width / 2, 0);
      ctx.lineTo(canvas.width / 2, canvas.height);
      ctx.strokeStyle = '#fff';
      ctx.stroke();
      ctx.closePath();

      requestAnimationFrame(drawGame);
    };

    const animationId = requestAnimationFrame(drawGame);
    return () => cancelAnimationFrame(animationId);
  }, [gameState, predictedState, gameStatus]);

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