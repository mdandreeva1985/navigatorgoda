import React from 'react';

interface ModalProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}

export const Modal: React.FC<ModalProps> = ({ title, children, onClose }) => (
  <div className="modal-overlay">
    <div className="modal-content">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-base font-black text-foreground tracking-tight">{title}</h3>
        <button 
          onClick={onClose} 
          className="p-1.5 bg-muted rounded-full text-muted-foreground hover:text-foreground transition-colors"
        >
          ✕
        </button>
      </div>
      {children}
    </div>
  </div>
);
