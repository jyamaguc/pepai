"use client";

import React from 'react';

interface CurrencySelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: 'credits' | 'pepPoints') => void;
  credits: number;
  pepPoints: number;
}

export const CurrencySelectionModal: React.FC<CurrencySelectionModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  credits,
  pepPoints
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100">
        <div className="p-8 border-b border-slate-50 flex justify-between items-center">
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Choose Currency</h2>
          <button 
            onClick={onClose} 
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:text-slate-900 transition-all"
          >
            ✕
          </button>
        </div>
        
        <div className="p-8 space-y-4">
          <p className="text-sm font-medium text-slate-500 mb-6 text-center">
            How would you like to pay for this AI action?
          </p>
          
          <button
            onClick={() => onSelect('credits')}
            disabled={credits < 5}
            className={`w-full p-6 rounded-2xl border-2 transition-all flex items-center justify-between group ${
              credits >= 5 
                ? 'border-slate-100 hover:border-emerald-500 hover:bg-emerald-50' 
                : 'opacity-50 cursor-not-allowed bg-slate-50 border-transparent'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-2xl group-hover:bg-white transition-colors">⚽</div>
              <div className="text-left">
                <div className="font-black text-slate-900 uppercase tracking-tight">Use Credits</div>
                <div className="text-[10px] font-bold text-slate-400">Balance: {credits}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-black text-emerald-600">5 ⚽</div>
              {credits < 5 && <div className="text-[8px] font-black text-red-400 uppercase">Insufficient</div>}
            </div>
          </button>

          <button
            onClick={() => onSelect('pepPoints')}
            disabled={pepPoints < 1}
            className={`w-full p-6 rounded-2xl border-2 transition-all flex items-center justify-between group ${
              pepPoints >= 1 
                ? 'border-slate-100 hover:border-blue-500 hover:bg-blue-50' 
                : 'opacity-50 cursor-not-allowed bg-slate-50 border-transparent'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-2xl group-hover:bg-white transition-colors">⚡</div>
              <div className="text-left">
                <div className="font-black text-slate-900 uppercase tracking-tight">Use Pep Points</div>
                <div className="text-[10px] font-bold text-slate-400">Balance: {pepPoints}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-black text-blue-600">1 ⚡</div>
              {pepPoints < 1 && <div className="text-[8px] font-black text-red-400 uppercase">Insufficient</div>}
            </div>
          </button>
        </div>
        
        <div className="p-8 bg-slate-50 text-center">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Pep Points never expire and can be used anytime.
          </p>
        </div>
      </div>
    </div>
  );
};
