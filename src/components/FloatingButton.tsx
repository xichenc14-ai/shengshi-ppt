'use client';

import React from 'react';

interface FloatingButtonProps {
  label: string;
  icon: string;
  onClick: () => void;
  disabled?: boolean;
}

export default function FloatingButton({ label, icon, onClick, disabled }: FloatingButtonProps) {
  return (
    <div className="fixed right-5 bottom-8 z-40">
      <button
        onClick={onClick}
        disabled={disabled}
        className={`relative w-14 h-14 rounded-2xl shadow-xl flex flex-col items-center justify-center transition-all duration-300 ${
          disabled
            ? 'bg-gray-200 shadow-gray-200/50 cursor-not-allowed'
            : 'bg-gradient-to-br from-[#5B4FE9] to-[#8B5CF6] shadow-purple-300/50 hover:shadow-2xl hover:shadow-purple-400/50 hover:scale-105 active:scale-95 animate-breathe'
        }`}
      >
        {/* Breathing glow */}
        {!disabled && (
          <div className="absolute inset-0 rounded-2xl bg-[#5B4FE9]/20 animate-ping-slow" />
        )}
        <span className="text-lg relative z-10">{icon}</span>
        <span className={`text-[8px] font-medium leading-none mt-0.5 relative z-10 ${
          disabled ? 'text-gray-400' : 'text-white/80'
        }`}>
          {label}
        </span>
      </button>
    </div>
  );
}
