import React, { useEffect, useRef, useState } from 'react';

const LocalPongGame = () => {
  const canvasRef = useRef(null);
  const requestRef = useRef();
  const previousTimeRef = useRef();
  const [debugInfo, setDebugInfo] = useState({});
  
  const [gameStarted, setGameStarted] = useState(false);
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
    computer: {
      x: 740,
      y: 250,
      width: 10,
      height: 100,
    },
    score: {
      player: 0,
      computer: 0
    },
    canvas: {
      width: 800,
      height: 600
    }
  });

  // Handle keyboard controls
  useEffect(() => {
    console.log("[KEYBOARD] Setting up keyboard event listeners");
    
    const handleKeyDown = (e) => {
      // Don't handle keys if game hasn't started
      if (!gameStarted) return;
      
      console.log(`[KEYBOARD] Key pressed: ${e.key}`);
      
      // Prevent default browser behavior for game controls
      if (['w', 's', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        
        switch(e.key) {
          case 'w':
          case 'ArrowUp':
            console.log("[KEYBOARD] Moving paddle UP");
            gameStateRef.current.player.dy = -gameStateRef.current.player.speed;
            break;
          case 's':
          case 'ArrowDown':
            console.log("[KEYBOARD] Moving paddle DOWN");
            gameStateRef.current.player.dy = gameStateRef.current.player.speed;
            break;
        }
      }
    };

    const handleKeyUp = (e) => {
      if (!gameStarted) return;
      
      if (['w', 's', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        gameStateRef.current.player.dy = 0;
      }
    };

    // Add event listeners to window instead of canvas to ensure they always work
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameStarted]);

  // Update game state
  const updateGameState = () => {
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
    
    // Ball collision with computer paddle
    if (
      state.ball.x + state.ball.radius > state.computer.x &&
      state.ball.x + state.ball.radius < state.computer.x + state.computer.width &&
      state.ball.y > state.computer.y &&
      state.ball.y < state.computer.y + state.computer.height
    ) {
      state.ball.dx = -Math.abs(state.ball.dx);
      state.ball.dy += (Math.random() * 2 - 1);
    }
    
    // Player scores
    if (state.ball.x > state.canvas.width) {
      state.score.player += 1;
      resetBall();
    }
    
    // Computer scores
    if (state.ball.x < 0) {
      state.score.computer += 1;
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

  // Reset ball after scoring
  const resetBall = () => {
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

    if (gameStarted) {
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
      state.computer.x, 
      state.computer.y, 
      state.computer.width, 
      state.computer.height
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
    ctx.fillText(state.score.computer, 3 * canvas.width / 4, 50);
  };

  // Start the game
  const startGame = () => {
    console.log("[GAME] Starting game!");
    setGameStarted(true);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-dark-bg text-text-primary">
      <h1 className="text-4xl font-fira mb-6 text-matrix-green">Local Pong Game</h1>
      
      {!gameStarted && (
        <div className="mb-6">
          <button
            className="px-6 py-3 bg-matrix-green text-black font-bold rounded hover:bg-opacity-80 transition"
            onClick={startGame}
          >
            Start Game
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
        <p>{gameStarted 
          ? "Use W/S or ↑/↓ arrow keys to move your paddle" 
          : "Click Start Game to begin"}</p>
        <p className="mt-2">Computer opponent will remain stationary</p>
      </div>
      
      {/* Debug Info Panel */}
      <div className="mt-4 p-4 bg-gray-800 rounded-lg w-full max-w-md">
        <h3 className="text-matrix-cyan font-bold mb-2">Debug Info</h3>
        <div className="text-sm font-mono">
          <p>Game Started: {debugInfo.gameStarted ? "Yes" : "No"}</p>
          <p>Player Y: {debugInfo.playerY}</p>
          <p>Player Direction: {debugInfo.playerDY}</p>
          <p>Ball Position: ({debugInfo.ballX}, {debugInfo.ballY})</p>
          <p>Last Update: {debugInfo.timestamp}</p>
        </div>
      </div>
    </div>
  );
};

export default LocalPongGame;