import React from 'react';
import LocalPongGame from './LocalPongGame';
import PongGame from './PongGame';

const GameModeSelector = () => {
  const [gameMode, setGameMode] = React.useState(null); // null, 'local', or 'multiplayer'

  if (gameMode === 'local') {
    return <LocalPongGame />;
  }

  if (gameMode === 'multiplayer') {
    return <PongGame />;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-dark-bg text-text-primary">
      <h1 className="text-4xl font-fira mb-8 text-matrix-green">Pong Game</h1>
      
      <div className="space-y-4">
        <button
          className="w-64 px-6 py-3 bg-matrix-green text-black font-bold rounded hover:bg-opacity-80 transition"
          onClick={() => setGameMode('local')}
        >
          Play Local
        </button>
        
        <button
          className="w-64 px-6 py-3 bg-matrix-cyan text-black font-bold rounded hover:bg-opacity-80 transition"
          onClick={() => setGameMode('multiplayer')}
        >
          Play Online
        </button>
      </div>
    </div>
  );
};

export default GameModeSelector; 