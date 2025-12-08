import React, { useState, useEffect } from 'react';
import { GameField } from './components/GameField';
import { PowerMeter } from './components/PowerMeter';
import { ControlsHelp } from './components/ControlsHelp';
import { GamePhase, Point, GameResult } from './types';
import { FIELD_WIDTH, FIELD_HEIGHT } from './constants';
import { Trophy, Ban, RefreshCcw, Volume2, VolumeX } from 'lucide-react';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GamePhase>(GamePhase.PLACEMENT);
  const [ballPos, setBallPos] = useState<Point>({ x: FIELD_WIDTH / 2, y: FIELD_HEIGHT - 200 });
  const [power, setPower] = useState(0);
  const [score, setScore] = useState(0);
  const [result, setResult] = useState<GameResult>(null);
  const [attempts, setAttempts] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  const handleResult = (gameResult: GameResult) => {
    setGameState(GamePhase.RESULT);
    setResult(gameResult);
    if (gameResult === 'GOAL') {
      setScore(s => s + 1);
    }
  };

  const resetGame = () => {
    setGameState(GamePhase.PLACEMENT);
    setResult(null);
    setPower(0);
    setAttempts(a => a + 1);
    // Ball pos will be set by placement click
  };

  // Prevent Spacebar scrolling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && gameState !== GamePhase.PLACEMENT) {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  return (
    <div className="h-[100dvh] w-screen bg-gray-900 flex flex-col items-center overflow-hidden">
      {/* Absolute Header Overlay */}
      <div className="absolute top-4 left-0 right-0 z-20 flex justify-center pointer-events-none">
        <div className="w-full max-w-2xl flex justify-between items-center px-4 py-3 bg-gray-800/90 rounded-lg shadow-lg border border-gray-700 backdrop-blur-md pointer-events-auto">
          <h1 className="text-2xl font-black text-white italic tracking-wider">
            任意球<span className="text-green-500">大师</span> <span className="text-xs bg-green-900 text-green-300 px-2 py-0.5 rounded">测试版</span>
          </h1>
          <div className="flex gap-6 text-white font-mono items-center">
            {/* Audio Toggle Button */}
            <button 
              onClick={() => setIsMuted(!isMuted)}
              className="flex flex-col items-center justify-center h-full text-gray-400 hover:text-white transition-colors p-1"
              title={isMuted ? "开启音效" : "静音"}
            >
              {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
            </button>
            <div className="w-[1px] h-8 bg-gray-600"></div>

            <div className="flex flex-col items-center">
              <span className="text-xs text-gray-400">进球</span>
              <span className="text-xl font-bold">{score}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs text-gray-400">次数</span>
              <span className="text-xl font-bold">{attempts + 1}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="relative w-full h-full flex-1">
        <ControlsHelp phase={gameState} />
        
        <GameField 
          gameState={gameState} 
          setGameState={setGameState} 
          onResult={handleResult}
          power={power}
          setPower={setPower}
          ballPos={ballPos}
          setBallPos={setBallPos}
          attempts={attempts}
          isMuted={isMuted}
        />

        {gameState === GamePhase.POWER && <PowerMeter power={power} isActive={true} />}

        {/* Result Overlay */}
        {gameState === GamePhase.RESULT && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-50 animate-in fade-in zoom-in duration-300">
            <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center text-center max-w-sm mx-4">
              {result === 'GOAL' && (
                <>
                  <Trophy size={64} className="text-yellow-400 mb-4 animate-bounce" />
                  <h2 className="text-4xl font-black text-gray-800 mb-2">球进啦！</h2>
                  <p className="text-gray-500 mb-6">比瞎蒙准一点！</p>
                </>
              )}
              {result === 'SAVED' && (
                <>
                  <Ban size={64} className="text-red-500 mb-4" />
                  <h2 className="text-4xl font-black text-gray-800 mb-2">被扑出了！</h2>
                  <p className="text-gray-500 mb-6">守门员预判了你的预判。</p>
                </>
              )}
              {result === 'MISS' && (
                <>
                  <div className="text-6xl mb-4">💨</div>
                  <h2 className="text-4xl font-black text-gray-800 mb-2">偏出球门</h2>
                  <p className="text-gray-500 mb-6">下次踢地会更歪。</p>
                </>
              )}
              
              <button 
                onClick={resetGame}
                className="flex items-center gap-2 bg-gray-900 text-white px-8 py-3 rounded-full font-bold hover:bg-gray-700 transition-colors"
              >
                <RefreshCcw size={20} />
                再试一次
              </button>
            </div>
          </div>
        )}
      </div>
      
      <div className="absolute bottom-1 right-2 text-gray-500 text-xs pointer-events-none opacity-50">
        React + 物理引擎
      </div>
    </div>
  );
};

export default App;