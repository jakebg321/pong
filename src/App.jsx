import React, { useState } from 'react';
import PongGame from './components/LocalPongGame';
import './App.css';

const App = () => {
  const [gameMode, setGameMode] = useState(null);

  if (!gameMode) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-dark-bg text-text-primary">
        <h1 className="text-6xl font-fira mb-12 text-matrix-green">Pong</h1>
        <div className="space-x-6">
          <button
            className="px-8 py-4 bg-matrix-green text-black font-bold rounded-lg hover:bg-opacity-80 transition text-xl"
            onClick={() => setGameMode('local')}
          >
            Local Game
          </button>
          <button
            className="px-8 py-4 bg-matrix-green text-black font-bold rounded-lg hover:bg-opacity-80 transition text-xl"
            onClick={() => setGameMode('multiplayer')}
          >
            Multiplayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        className="absolute top-4 left-4 px-4 py-2 bg-matrix-green text-black rounded hover:bg-opacity-80 transition"
        onClick={() => setGameMode(null)}
      >
        ← Back to Menu
      </button>
      <PongGame mode={gameMode} />
    </div>
  );
};

export default App;