import React, { useState, useRef, useCallback } from 'react';
import { Bold, Italic, Underline, List, Smile } from 'lucide-react';
import { Button } from './button';
import { Textarea } from './textarea';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './popover';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}

const EMOJI_LIST = [
  '✅', '🏆', '🚀', '🤝', '🎨', '💡', '🙌',
  '💰', '💵', '💸', '🛍️', '✂️',
  '📝', '🧘‍♀️', '❤️', '🛌', '👩‍⚕️',
  '⚖️', '🌑', '🌕', '⛔', '🪐',
  '🔥', '💫', '⭐', '🎯', '💪', '🌟', '✨',
];

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder,
  rows = 8,
  className = '',
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showEmojis, setShowEmojis] = useState(false);

  const insertAtCursor = useCallback((insertText: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = value.substring(0, start) + insertText + value.substring(end);
    onChange(newValue);
    
    // Set cursor position after inserted text
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + insertText.length, start + insertText.length);
    }, 0);
  }, [value, onChange]);

  const wrapSelection = useCallback((prefix: string, suffix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    
    if (selectedText) {
      const newValue = value.substring(0, start) + prefix + selectedText + suffix + value.substring(end);
      onChange(newValue);
      
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + prefix.length, end + prefix.length);
      }, 0);
    } else {
      insertAtCursor(prefix + suffix);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + prefix.length, start + prefix.length);
      }, 0);
    }
  }, [value, onChange, insertAtCursor]);

  const handleBold = () => wrapSelection('**', '**');
  const handleItalic = () => wrapSelection('_', '_');
  const handleUnderline = () => wrapSelection('<u>', '</u>');
  const handleList = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    
    // Insert bullet at the beginning of the current line
    const before = value.substring(0, lineStart);
    const after = value.substring(lineStart);
    
    if (after.startsWith('• ')) {
      // Remove bullet
      onChange(before + after.substring(2));
    } else {
      // Add bullet
      onChange(before + '• ' + after);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + 2, start + 2);
      }, 0);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    insertAtCursor(emoji);
    setShowEmojis(false);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-1 flex-wrap">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleBold}
          className="h-8 w-8 p-0"
          title="Жирный (**текст**)"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleItalic}
          className="h-8 w-8 p-0"
          title="Курсив (_текст_)"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleUnderline}
          className="h-8 w-8 p-0"
          title="Подчёркнутый (<u>текст</u>)"
        >
          <Underline className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleList}
          className="h-8 w-8 p-0"
          title="Список (• )"
        >
          <List className="h-4 w-4" />
        </Button>
        <Popover open={showEmojis} onOpenChange={setShowEmojis}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              title="Эмодзи"
            >
              <Smile className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <div className="grid grid-cols-7 gap-1">
              {EMOJI_LIST.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleEmojiSelect(emoji)}
                  className="p-2 hover:bg-muted rounded text-lg transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="font-mono text-sm"
      />
      <p className="text-xs text-muted-foreground">
        Используйте **жирный**, _курсив_, {'<u>подчёркнутый</u>'}, • для списка
      </p>
    </div>
  );
};

// Component to render rich text with formatting
interface RichTextDisplayProps {
  content: string;
  className?: string;
}

export const RichTextDisplay: React.FC<RichTextDisplayProps> = ({ content, className = '' }) => {
  const parseText = (text: string): React.ReactNode[] => {
    if (!text) return [];
    
    const parts: React.ReactNode[] = [];
    let currentIndex = 0;
    
    // Regular expressions for formatting
    const patterns = [
      { regex: /\*\*([^*]+)\*\*/g, render: (match: string, content: string, key: number) => <strong key={key}>{content}</strong> },
      { regex: /_([^_]+)_/g, render: (match: string, content: string, key: number) => <em key={key}>{content}</em> },
      { regex: /<u>([^<]+)<\/u>/g, render: (match: string, content: string, key: number) => <u key={key}>{content}</u> },
    ];
    
    // Simple approach: replace all patterns then render
    let processed = text;
    
    // Replace **bold**
    processed = processed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Replace _italic_
    processed = processed.replace(/_([^_]+)_/g, '<em>$1</em>');
    // <u> is already HTML
    
    return [<span key="content" dangerouslySetInnerHTML={{ __html: processed }} className="whitespace-pre-line" />];
  };

  return (
    <div className={`prose prose-sm max-w-none ${className}`}>
      {parseText(content)}
    </div>
  );
};
