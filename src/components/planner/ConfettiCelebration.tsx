import React, { useEffect, useState } from 'react';

const PRAISE_PHRASES = [
  "Отлично! 🎉",
  "Молодец! ⭐",
  "Супер! 🚀",
  "Ты лучшая! 💪",
  "Так держать! 🔥",
  "Невероятно! ✨",
  "Великолепно! 🏆",
];

const CONFETTI_COLORS = [
  'hsl(var(--primary))',
  'hsl(280 80% 60%)',
  'hsl(var(--success))',
  'hsl(var(--warning))',
  'hsl(330 80% 60%)',
  'hsl(200 80% 60%)',
];

interface ConfettiParticle {
  id: number;
  left: number;
  delay: number;
  color: string;
  size: number;
  duration: number;
}

export const ConfettiCelebration: React.FC = () => {
  const [praise] = useState(() => 
    PRAISE_PHRASES[Math.floor(Math.random() * PRAISE_PHRASES.length)]
  );
  
  const [particles] = useState<ConfettiParticle[]>(() => 
    Array.from({ length: 60 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.8,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: 4 + Math.random() * 4,
      duration: 2 + Math.random() * 1.5,
    }))
  );

  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 3500);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[300] overflow-hidden">
      {/* Confetti particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="confetti-particle absolute rounded-full"
          style={{
            left: `${p.left}%`,
            top: '-10px',
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
      
      {/* Praise text */}
      <div className="praise-text absolute inset-0 flex items-center justify-center">
        <span className="text-3xl font-black text-primary drop-shadow-lg bg-card/90 px-8 py-4 rounded-3xl border border-primary/20 shadow-xl">
          {praise}
        </span>
      </div>
    </div>
  );
};
