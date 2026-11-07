import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Clock } from 'lucide-react';
import { FocusCard } from './FocusCard';
import { ListItem } from './ListItem';
import { HoursHintModal } from './HoursHintModal';
import { ConfettiCelebration } from './ConfettiCelebration';
import { RichTextDisplay } from '@/components/ui/rich-text-editor';
import type { Task, Habit } from '@/pages/Index';
import type { DbDailyEnergy, DbAchievement } from '@/hooks/useUserData';

interface DayDataSectionProps {
  dateObj: Date;
  tasks: Task[];
  habits: Habit[];
  toggleTask: (id: number | string) => void;
  deleteTask: (id: number | string, deleteAll?: boolean) => void;
  toggleHabit: (id: number | string, dateStr: string) => void;
  deleteHabit: (id: number | string) => void;
  updateTask?: (id: number | string, newText: string) => void;
  updateHabit?: (id: number | string, newText: string) => void;
  onAchievementChange?: (dateStr: string, achievement1: string, achievement2: string, achievement3: string) => void;
  hintText?: string | null;
  dailyEnergy?: DbDailyEnergy[];
  achievements?: DbAchievement[];
  getPersonalFocusForDate?: (dateStr: string) => string;
}

export const DayDataSection: React.FC<DayDataSectionProps> = ({ 
  dateObj, 
  tasks, 
  habits, 
  toggleTask, 
  deleteTask, 
  toggleHabit, 
  deleteHabit,
  updateTask,
  updateHabit,
  onAchievementChange,
  hintText,
  dailyEnergy = [],
  achievements = [],
  getPersonalFocusForDate,
}) => {
  const [showHoursHint, setShowHoursHint] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const previousPercentRef = useRef<number | null>(null);
  
  const dNum = dateObj.getDate();
  
  // Format date string without timezone issues
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;
  
  // Get achievements for this date from DB
  const dayAchievement = useMemo(() => {
    // If (for any reason) we have multiple entries for the same date in client state,
    // prefer the latest one.
    for (let i = achievements.length - 1; i >= 0; i--) {
      const a = achievements[i];
      if (a?.date?.startsWith(dateStr)) return a;
    }
    return undefined;
  }, [achievements, dateStr]);
  
  // Local state for input fields
  const [localAchievements, setLocalAchievements] = useState<string[]>(['', '', '']);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<string>('');
  
  // Sync local state with DB data - only on date change or initial load
  useEffect(() => {
    const achievementKey = `${dateStr}-${dayAchievement?.id || 'new'}`;
    
    // Only update if it's a different date/achievement
    if (lastSavedRef.current !== achievementKey) {
      if (dayAchievement) {
        setLocalAchievements([
          dayAchievement.achievement_1 || '',
          dayAchievement.achievement_2 || '',
          dayAchievement.achievement_3 || ''
        ]);
      } else {
        setLocalAchievements(['', '', '']);
      }
      lastSavedRef.current = achievementKey;
    }
  }, [dayAchievement?.id, dateStr]);
  
  // Filter tasks for this specific date
  const dayTasks = tasks.filter(t => t.date === dateStr);
  
  // Calculate daily completion percentage
  const completedTasks = dayTasks.filter(t => t.completed).length;
  const totalTasks = dayTasks.length;
  const dayCompletionPercent = totalTasks > 0 
    ? Math.round((completedTasks / totalTasks) * 100) 
    : 0;
  
  // Filter habits that are active on this date
  const activeHabits = habits.filter(h => {
    return dateStr >= h.startDate && dateStr <= h.endDate;
  });

  // Trigger celebration when reaching 100%
  useEffect(() => {
    if (dayCompletionPercent === 100 && previousPercentRef.current !== 100 && totalTasks > 0) {
      setShowCelebration(true);
      const timer = setTimeout(() => setShowCelebration(false), 3000);
      return () => clearTimeout(timer);
    }
    previousPercentRef.current = dayCompletionPercent;
  }, [dayCompletionPercent, totalTasks]);

  // Debounced save function
  const debouncedSave = useCallback((date: string, a1: string, a2: string, a3: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      onAchievementChange?.(date, a1, a2, a3);
    }, 500);
  }, [onAchievementChange]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleAchievementInput = (index: number, value: string) => {
    const updated = [...localAchievements];
    updated[index] = value;
    setLocalAchievements(updated);
    
    // Save to database via debounced callback
    debouncedSave(dateStr, updated[0], updated[1], updated[2]);
  };
  
  // Get energy data for this date
  const energyData = dailyEnergy.find(e => e.date.startsWith(dateStr));
  const dailyAdvice = energyData?.daily_advice || '';
  
  // Get personalized focus for this date
  const personalFocus = getPersonalFocusForDate ? getPersonalFocusForDate(dateStr) : '';
  
  return (
    <div className="mt-8 animate-slide-in-bottom space-y-6 pb-40">
      {dailyAdvice && (
        <RichTextDisplay 
          content={dailyAdvice} 
          className="text-muted-foreground text-[11px] font-semibold"
        />
      )}
      
      <FocusCard 
        date={dNum} 
        month={dateObj.toLocaleDateString('ru', { month: 'short' })} 
        focusTitle="Фокус дня" 
        focusDesc={personalFocus} 
      />
      
      {/* Daily Progress Circle */}
      <div className="flex flex-col items-center py-4">
        <div className="w-20 h-20 relative">
          {showCelebration && <ConfettiCelebration />}
          <svg className="w-full h-full -rotate-90">
            <circle 
              cx="40" cy="40" r="36" 
              fill="transparent" 
              stroke="hsl(var(--muted))" 
              strokeWidth="4" 
            />
            <circle 
              cx="40" cy="40" r="36" 
              fill="transparent" 
              stroke="hsl(var(--primary))" 
              strokeWidth="4" 
              strokeDasharray={`${(dayCompletionPercent * 226) / 100} 226`} 
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-black text-foreground">{dayCompletionPercent}%</span>
            <span className="text-[8px] text-muted-foreground font-bold uppercase tracking-wide">задач</span>
          </div>
        </div>
      </div>
      
      {/* Hours Hint */}
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground text-xs">Подсказка для планирования дня</span>
        <button 
          onClick={() => setShowHoursHint(true)}
          className="hover:scale-110 transition-transform"
        >
          <Clock size={14} className="text-primary" />
        </button>
      </div>
      
      <section>
        <h3 className="font-black text-foreground tracking-tight mb-4 px-1">Задачи дня</h3>
        {dayTasks.length > 0 ? (
          dayTasks.map(t => (
            <ListItem 
              key={t.id} 
              id={t.id} 
              text={t.text} 
              completed={t.completed}
              isRecurring={!!t.recurringGroupId}
              onToggle={toggleTask} 
              onDelete={deleteTask}
              onUpdate={updateTask}
            />
          ))
        ) : (
          <p className="text-xs text-muted-foreground/50 italic py-2">Задач пока нет</p>
        )}
      </section>
      
      <section>
        <h3 className="font-black text-foreground tracking-tight mb-4 px-1">Привычки</h3>
        {activeHabits.length > 0 ? (
          activeHabits.map(h => {
            const isCompletedToday = h.completedDates.includes(dateStr);
            const completed = h.completedDates.length;
            const targetDays = h.repeat === 'week' ? 7 
                             : h.repeat === 'month' ? 30 
                             : h.repeat === '3months' ? 90 : 365;
            return (
              <ListItem 
                key={h.id} 
                id={h.id} 
                text={h.text} 
                subtext={`${completed}/${targetDays} дней`} 
                completed={isCompletedToday} 
                onToggle={() => toggleHabit(h.id, dateStr)} 
                onDelete={deleteHabit}
                onUpdate={updateHabit}
              />
            );
          })
        ) : (
          <p className="text-xs text-muted-foreground/50 italic py-2">Привычек на эту дату нет</p>
        )}
      </section>
      
      <section className="card-soft border-b-4 border-b-accent mb-8">
        <h4 className="font-bold text-foreground text-sm italic mb-4">Мои 3 достижения:</h4>
        {[0, 1, 2].map(i => (
          <div key={i} className="flex items-center gap-3 mb-3">
            <span className="w-5 h-5 bg-accent rounded-full flex items-center justify-center text-[10px] font-black text-primary shrink-0">
              {i + 1}
            </span>
            <input 
              type="text" 
              placeholder="" 
              className="input-soft flex-1 p-2"
              value={localAchievements[i]}
              onChange={(e) => handleAchievementInput(i, e.target.value)}
            />
          </div>
        ))}
      </section>

      <HoursHintModal isOpen={showHoursHint} onClose={() => setShowHoursHint(false)} hintText={hintText} />
    </div>
  );
};
