import React from 'react';

const DebugPanel = ({ debugInfo }) => {
  if (!debugInfo) return null;

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs}h ${mins}m ${secs}s`;
  };

  return (
    <div className="fixed top-4 right-4 bg-black bg-opacity-90 text-matrix-green p-4 rounded-lg shadow-lg w-80 font-mono text-sm">
      <h3 className="text-lg font-bold mb-4 border-b border-matrix-green pb-2">Server Debug Info</h3>
      
      <div className="space-y-4">
        {/* Server Stats */}
        <div>
          <h4 className="font-bold mb-2">Server Statistics</h4>
          <div className="grid grid-cols-2 gap-2">
            <div>Uptime:</div>
            <div>{formatTime(debugInfo.uptime)}</div>
            <div>Connected Players:</div>
            <div>{debugInfo.connectedPlayers.length}</div>
            <div>Active Games:</div>
            <div>{debugInfo.activeGames.length}</div>
            <div>Players Searching:</div>
            <div>{debugInfo.stats.currentSearchingPlayers}</div>
          </div>
        </div>

        {/* Historical Stats */}
        <div>
          <h4 className="font-bold mb-2">Historical Data</h4>
          <div className="grid grid-cols-2 gap-2">
            <div>Total Games:</div>
            <div>{debugInfo.stats.totalGamesPlayed}</div>
            <div>Total Players:</div>
            <div>{debugInfo.stats.totalPlayersConnected}</div>
            <div>Peak Players:</div>
            <div>{debugInfo.stats.peakConcurrentPlayers}</div>
          </div>
        </div>

        {/* Recent Events */}
        <div>
          <h4 className="font-bold mb-2">Recent Events</h4>
          <div className="space-y-1 max-h-40 overflow-y-auto text-xs">
            {debugInfo.recentEvents.map((event, index) => (
              <div key={index} className="grid grid-cols-[auto,1fr] gap-2">
                <span className="text-matrix-cyan">
                  {new Date(event.timestamp).toLocaleTimeString()}:
                </span>
                <span>{event.event}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Connected Players */}
        <div>
          <h4 className="font-bold mb-2">Connected Players</h4>
          <div className="text-xs space-y-1 max-h-20 overflow-y-auto">
            {debugInfo.connectedPlayers.map((playerId) => (
              <div key={playerId} className="truncate">
                {playerId}
              </div>
            ))}
          </div>
        </div>

        {/* Active Games */}
        <div>
          <h4 className="font-bold mb-2">Active Games</h4>
          <div className="text-xs space-y-1 max-h-20 overflow-y-auto">
            {debugInfo.activeGames.map((gameId) => (
              <div key={gameId} className="truncate">
                {gameId}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DebugPanel; 