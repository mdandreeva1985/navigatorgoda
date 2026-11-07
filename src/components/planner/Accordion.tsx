import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';

interface AccordionProps {
  title: string;
  children: React.ReactNode;
}

export const Accordion: React.FC<AccordionProps> = ({ title, children }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="border-b border-border/50 last:border-0 overflow-hidden">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="w-full flex justify-between items-center p-6 text-left hover:bg-accent/30 transition-all"
      >
        <span className="text-sm font-black text-foreground/80 uppercase tracking-tight">{title}</span>
        <div className={`transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`}>
          <ChevronRight size={18} className={isOpen ? 'text-primary' : 'text-muted-foreground/40'} />
        </div>
      </button>
      {isOpen && (
        <div className="px-6 pb-7 text-muted-foreground animate-slide-in-top">
          {children}
        </div>
      )}
    </div>
  );
};
