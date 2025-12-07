
import React from 'react';
import { GamePhase } from '../types';
import { ArrowLeft, ArrowRight, MousePointer, Space, MoveHorizontal, MousePointerClick, RefreshCcw } from 'lucide-react';

interface ControlsHelpProps {
  phase: GamePhase;
}

export const ControlsHelp: React.FC<ControlsHelpProps> = ({ phase }) => {
  const Step = ({ icon, text }: { icon: React.ReactNode; text: string }) => (
    <div className="flex items-center gap-3 bg-black/60 px-4 py-2 rounded-full backdrop-blur-md border border-white/10 animate-fade-in shadow-lg">
      <span className="text-yellow-400">{icon}</span>
      <span className="text-white font-medium text-sm">{text}</span>
    </div>
  );

  return (
    <div className="absolute bottom-12 md:bottom-8 left-4 flex flex-col gap-2 pointer-events-none z-20 w-auto items-start">
      {phase === GamePhase.PLACEMENT && (
        <Step 
          icon={<MousePointer size={18} />} 
          text="Click outside penalty box to place ball" 
        />
      )}
      
      {phase === GamePhase.AIMING && (
        <>
          <Step 
            icon={<MoveHorizontal size={18} />} 
            text="Move Mouse to Aim" 
          />
          <Step 
            icon={<MousePointerClick size={18} />} 
            text="Click to Toggle Spin Mode" 
          />
           <Step 
            icon={<RefreshCcw size={18} />} 
            text="Click again to Adjust Aim" 
          />
          <Step 
            icon={<div className="font-bold text-xs border border-white px-1 rounded">SPACE</div>} 
            text="Press SPACE to Start Power" 
          />
        </>
      )}

      {phase === GamePhase.POWER && (
        <Step 
          icon={<div className="font-bold text-xs border border-white px-1 rounded">SPACE</div>} 
          text="Press SPACE again to Shoot!" 
        />
      )}
    </div>
  );
};
