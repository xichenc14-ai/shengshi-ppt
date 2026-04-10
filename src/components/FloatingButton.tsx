'use client';

import React from 'react';

interface FloatingButtonProps {
  label: string;
  icon?: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export default function FloatingButton({ label, icon, onClick, disabled, loading }: FloatingButtonProps) {
  return (
    <div className="fixed right-5 bottom-8 z-40">
      <button
        onClick={onClick}
        disabled={disabled || loading}
        className={`relative px-6 py-3.5 rounded-2xl shadow-xl flex items-center gap-2 transition-all duration-300 group ${
          disabled || loading
            ? 'bg-gray-200 text-gray-400 shadow-gray-200/50 cursor-not-allowed'
            : 'bg-gradient-to-br from-[#5B4FE9] to-[#8B5CF6] text-white shadow-purple-300/50 hover:shadow-2xl hover:shadow-purple-400/50 hover:scale-105 active:scale-95'
        }`}
      >
        {/* Breathing glow ring */}
        {!disabled && !loading && (
          <span className="absolute inset-0 rounded-2xl bg-[#5B4FE9]/20 animate-ping-slow" />
        )}
        
        {loading ? (
          <span className="loading-dots relative z-10">
            <span /><span /><span />
          </span>
        ) : (
          <>
            {icon && <span className="text-base relative z-10">{icon}</span>}
            <span className="text-sm font-semibold relative z-10">{label}</span>
          </>
        )}
      </button>
    </div>
  );
}
