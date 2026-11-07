import React from 'react';
import { Modal } from './Modal';

interface HoursHintModalProps {
  isOpen: boolean;
  onClose: () => void;
  hintText?: string | null;
}

export const HoursHintModal: React.FC<HoursHintModalProps> = ({ isOpen, onClose, hintText }) => {
  if (!isOpen) return null;

  return (
    <Modal title="Подсказка для планирования дня" onClose={onClose}>
      <div className="py-2 max-h-[60vh] overflow-y-auto">
        {hintText ? (
          <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{hintText}</p>
        ) : (
          <p className="text-xs text-muted-foreground italic">Подсказка пока не задана консультантом, доступна при подписке</p>
        )}
      </div>
    </Modal>
  );
};
