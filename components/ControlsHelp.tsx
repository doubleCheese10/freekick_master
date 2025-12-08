
import React from 'react';
import { GamePhase } from '../types';
import { MousePointer, MoveHorizontal, CheckCircle, ArrowDown } from 'lucide-react';

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
          text="第一步：点击禁区外放置足球" 
        />
      )}
      
      {phase === GamePhase.AIMING_DIRECTION && (
        <>
          <Step 
            icon={<MoveHorizontal size={18} />} 
            text="第二步：使用左右按钮调整方向，点击场地移动位置" 
          />
          <Step 
            icon={<CheckCircle size={18} />} 
            text="点击「确认方向」进入下一步" 
          />
        </>
      )}

      {phase === GamePhase.PULL_BACK && (
        <Step 
          icon={<ArrowDown size={18} />} 
          text="第三步：向后拖动蓄力 (像拉弹弓)" 
        />
      )}
    </div>
  );
};
