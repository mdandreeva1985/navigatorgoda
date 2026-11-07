import React, { useState } from 'react';
import { CheckCircle2, Circle, Edit2, Trash2, Check, X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ListItemProps {
  id: number | string;
  text: string;
  subtext?: string;
  completed: boolean;
  isRecurring?: boolean;
  onToggle: ((id: number | string) => void) | (() => void);
  onDelete: (id: number | string, deleteAll?: boolean) => void;
  onUpdate?: (id: number | string, newText: string) => void;
}

export const ListItem: React.FC<ListItemProps> = ({ 
  id, 
  text, 
  subtext, 
  completed,
  isRecurring,
  onToggle, 
  onDelete,
  onUpdate
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(text);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSave = () => {
    if (editText.trim() && onUpdate) {
      onUpdate(id, editText.trim());
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditText(text);
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (isRecurring) {
      setShowDeleteConfirm(true);
    } else {
      onDelete(id, false);
    }
  };

  const confirmDeleteSingle = () => {
    onDelete(id, false);
    setShowDeleteConfirm(false);
  };

  const confirmDeleteAll = () => {
    onDelete(id, true);
    setShowDeleteConfirm(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 py-2 px-1">
        <input
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          className="flex-1 text-sm font-medium bg-muted rounded-xl px-3 py-2 border-none outline-none focus:ring-2 focus:ring-primary/30"
          autoFocus
        />
        <button 
          onClick={handleSave}
          className="text-success p-1.5 hover:bg-success/10 rounded-lg transition-colors"
        >
          <Check size={16} />
        </button>
        <button 
          onClick={handleCancel}
          className="text-muted-foreground p-1.5 hover:bg-muted rounded-lg transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 py-2 px-1">
        <button onClick={() => {
          if (onToggle.length === 0) {
            (onToggle as () => void)();
          } else {
            (onToggle as (id: number | string) => void)(id);
          }
        }} className="shrink-0">
          {completed ? (
            <CheckCircle2 className="text-success" size={18} />
          ) : (
            <Circle className="text-muted-foreground/40" size={18} />
          )}
        </button>
        <div className="flex flex-col flex-1 min-w-0">
          <span className={`text-sm font-medium break-words ${completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
            {text}
          </span>
          {subtext && (
            <span className="text-[10px] text-muted-foreground">{subtext}</span>
          )}
        </div>
        <div className="flex gap-0.5 shrink-0">
          {onUpdate && (
            <button 
              onClick={() => setIsEditing(true)}
              className="text-muted-foreground/40 p-1 hover:text-muted-foreground transition-colors"
            >
              <Edit2 size={12} />
            </button>
          )}
          <button 
            onClick={handleDelete} 
            className="text-muted-foreground/40 p-1 hover:text-destructive transition-colors"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="max-w-[90vw] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Удалить повторяющуюся задачу?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Выберите, удалить только эту запись или все повторяющиеся записи «{text}».
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <button 
              onClick={confirmDeleteSingle}
              className="w-full py-3 rounded-xl text-sm font-bold bg-muted text-foreground hover:bg-muted/80 transition-colors"
            >
              Удалить только эту
            </button>
            <AlertDialogAction onClick={confirmDeleteAll} className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Удалить все повторения
            </AlertDialogAction>
            <AlertDialogCancel className="w-full mt-0">Отмена</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
