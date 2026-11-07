import React from 'react';

interface FocusCardProps {
  date: string | number;
  month: string;
  focusTitle: string;
  focusDesc: string;
}

export const FocusCard: React.FC<FocusCardProps> = ({ 
  date, 
  month, 
  focusTitle, 
  focusDesc 
}) => (
  <div className="focus-card mb-8">
    <div className="flex items-center gap-4 mb-3 relative z-10">
      <div className="bg-card text-primary w-12 h-12 rounded-xl flex flex-col items-center justify-center font-black shadow-inner">
        <span className="text-[9px] uppercase opacity-60 leading-none">{month}</span>
        <span className="text-xl leading-none">{date}</span>
      </div>
      <div>
        <div className="text-base font-black text-primary-foreground uppercase tracking-wide">
          Ваш фокус дня
        </div>
      </div>
    </div>
    <p className="text-primary-foreground/80 text-xs leading-relaxed relative z-10 whitespace-pre-line">
      {focusDesc || <span className="italic opacity-70">Фокус дня доступен при подписке</span>}
    </p>
  </div>
);
