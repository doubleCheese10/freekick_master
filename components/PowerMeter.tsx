import React from 'react';

interface PowerMeterProps {
  power: number;
  isActive: boolean;
}

export const PowerMeter: React.FC<PowerMeterProps> = ({ power, isActive }) => {
  return (
    <div className="absolute bottom-40 right-8 flex flex-col items-center gap-2 bg-black/50 p-4 rounded-lg backdrop-blur-sm z-20 pointer-events-none">
      <span className="text-white font-bold text-sm tracking-widest">力度</span>
      <div className="w-8 h-48 bg-gray-700 rounded-full border-2 border-white overflow-hidden relative">
        <div
          className={`absolute bottom-0 left-0 w-full ease-linear ${
            power > 90 ? 'bg-red-500' : power > 70 ? 'bg-yellow-400' : 'bg-green-500'
          }`}
          style={{ height: `${power}%` }}
        ></div>
        {/* Tick marks */}
        <div className="absolute top-[25%] left-0 w-full h-[1px] bg-white/30"></div>
        <div className="absolute top-[50%] left-0 w-full h-[1px] bg-white/30"></div>
        <div className="absolute top-[75%] left-0 w-full h-[1px] bg-white/30"></div>
      </div>
      <span className="text-white font-mono">{Math.round(power)}%</span>
    </div>
  );
};