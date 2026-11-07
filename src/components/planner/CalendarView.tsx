import React, { useState, useEffect } from 'react';
import { Menu, Filter, ChevronLeft, ChevronRight, BookOpen, Plus } from 'lucide-react';
import { DayDataSection } from './DayDataSection';
import { Modal } from './Modal';
import { EmojiGuideModal } from './EmojiGuideModal';
import type { Task, Habit } from '@/pages/Index';
import type { DbDailyEnergy, DbAchievement } from '@/hooks/useUserData';

type CalendarViewType = 'day' | 'week' | 'month' | 'year';
type FilterType = 'all' | 'lucky' | 'money_activation' | 'rest' | 'money_haircut' | 'solar_eclipse' | 'lunar_eclipse' | 'no_wealth' | 'mercury_retrograde' | 'noble_person' | 'courage' | 'movement' | 'networking' | 'creative' | 'intelligence' | 'investments' | 'work_earnings' | 'purchases' | 'planning' | 'practices' | 'self_care' | 'doctor' | 'crisis';

interface CalendarViewProps {
  viewDate: Date;
  setViewDate: (date: Date) => void;
  tasks: Task[];
  habits: Habit[];
  toggleTask: (id: number | string) => void;
  deleteTask: (id: number | string, deleteAll?: boolean) => void;
  toggleHabit: (id: number | string, dateStr: string) => void;
  deleteHabit: (id: number | string) => void;
  updateTask?: (id: number | string, newText: string) => void;
  updateHabit?: (id: number | string, newText: string) => void;
  yearGoal: string;
  monthGoal: string;
  onOpenAddModal: (dateStr: string) => void;
  hintText?: string | null;
  dailyEnergy?: DbDailyEnergy[];
  achievements?: DbAchievement[];
  onAchievementChange?: (dateStr: string, a1: string, a2: string, a3: string) => void;
  getPersonalEmojisForDate?: (dateStr: string) => string;
  getPersonalEmojisListForDate?: (dateStr: string) => string[];
  getPersonalFocusForDate?: (dateStr: string) => string;
  hasSubscription?: boolean;
}

// Get week dates for a given date
const getWeekDates = (date: Date) => {
  const current = new Date(date);
  const day = current.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(current);
  monday.setDate(current.getDate() + diff);
  
  const weekDates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    weekDates.push(d);
  }
  return weekDates;
};

export const CalendarView: React.FC<CalendarViewProps> = ({
  viewDate,
  setViewDate,
  tasks,
  habits,
  toggleTask,
  deleteTask,
  toggleHabit,
  deleteHabit,
  updateTask,
  updateHabit,
  yearGoal,
  monthGoal,
  onOpenAddModal,
  hintText,
  dailyEnergy = [],
  achievements = [],
  onAchievementChange,
  getPersonalEmojisForDate,
  getPersonalEmojisListForDate,
  getPersonalFocusForDate,
  hasSubscription = false,
}) => {
  // Helper to get energy data for a specific date
  const getEnergyForDate = (dateStr: string): DbDailyEnergy | undefined => {
    return dailyEnergy.find(e => e.date.startsWith(dateStr));
  };

  // Helper to check if a date is lucky
  const isLuckyDay = (dateStr: string): boolean => {
    const energy = getEnergyForDate(dateStr);
    return energy?.is_lucky_day || false;
  };

  // Helper to check if a date is rest day
  const isRestDay = (dateStr: string): boolean => {
    const energy = getEnergyForDate(dateStr);
    return energy?.is_rest_day || false;
  };

  // Helper to get all energy emojis for a date
  const getEnergyEmojis = (dateStr: string): string => {
    const energy = getEnergyForDate(dateStr);
    if (!energy) return '';
    const emojis: string[] = [];
    if (energy.is_lucky_day) emojis.push('✅');
    if (energy.is_money_activation) emojis.push('💸');
    if (energy.is_rest_day) emojis.push('🛌');
    if (energy.is_money_haircut) emojis.push('✂️');
    if (energy.is_solar_eclipse) emojis.push('🌑');
    if (energy.is_lunar_eclipse) emojis.push('🌕');
    if (energy.is_no_wealth_day) emojis.push('⛔');
    if (energy.is_mercury_retrograde) emojis.push('🪐');
    return emojis.join('');
  };
  const [calendarView, setCalendarViewState] = useState<CalendarViewType>('month');
  const [showMenu, setShowMenu] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);
  const [isInstructionOpen, setIsInstructionOpen] = useState(false);
  const [hasSelectedDateInMonth, setHasSelectedDateInMonth] = useState(false);
  const [yearViewYear, setYearViewYear] = useState(() => new Date().getFullYear());

  // Current date reference - use device date
  const currentDate = new Date();

  // Check if a day has all tasks and habits completed
  const isDayFullyCompleted = (day: number, monthIndex: number, yearOverride?: number) => {
    const year = yearOverride ?? currentDate.getFullYear();
    const month = String(monthIndex + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `${year}-${month}-${dayStr}`;
    
    const dayTasks = tasks.filter(t => t.date === dateStr);
    const activeHabits = habits.filter(h => dateStr >= h.startDate && dateStr <= h.endDate);
    
    // If no tasks and no habits, not considered completed
    if (dayTasks.length === 0 && activeHabits.length === 0) return false;
    
    const allTasksCompleted = dayTasks.every(t => t.completed);
    const allHabitsCompleted = activeHabits.every(h => h.completedDates.includes(dateStr));
    
    return allTasksCompleted && allHabitsCompleted;
  };

  // Handle view change from menu - resets to today
  const handleMenuViewChange = (view: CalendarViewType) => {
    const today = new Date();
    setCalendarViewState(view);
    if (view === 'day') {
      setViewDate(today);
      setSelectedCalendarDate(today);
    } else if (view === 'week') {
      setViewDate(today);
      setSelectedCalendarDate(today);
    } else if (view === 'month') {
      setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
      // If opening current month, show current day
      const isCurrentMonth = today.getMonth() === viewDate.getMonth() && today.getFullYear() === viewDate.getFullYear();
      if (today.getMonth() === new Date(today.getFullYear(), today.getMonth(), 1).getMonth()) {
        setSelectedCalendarDate(today);
        setHasSelectedDateInMonth(true);
      } else {
        setSelectedCalendarDate(null);
        setHasSelectedDateInMonth(false);
      }
    }
  };

  // When month changes, check if it's current month
  useEffect(() => {
    if (calendarView === 'month') {
      const isCurrentMonth = currentDate.getMonth() === viewDate.getMonth() && currentDate.getFullYear() === viewDate.getFullYear();
      if (isCurrentMonth) {
        setSelectedCalendarDate(currentDate);
        setHasSelectedDateInMonth(true);
      } else {
        setSelectedCalendarDate(null);
        setHasSelectedDateInMonth(false);
      }
    }
  }, [viewDate, calendarView]);

  // Handle navigation to day from week/month - keeps selected date
  const navigateToDay = (date: Date) => {
    setSelectedCalendarDate(new Date(date));
    setViewDate(new Date(date));
    setCalendarViewState('day');
  };

  const changeViewDate = (amount: number) => {
    if (calendarView === 'day') {
      const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate() + amount);
      setViewDate(newDate);
    } else if (calendarView === 'week') {
      const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate() + (amount * 7));
      setViewDate(newDate);
    } else if (calendarView === 'month') {
      const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + amount, 1);
      setViewDate(newDate);
    }
  };

  const getDayStatus = (dayNum: number, monthIndex: number, year: number) => {
    if (activeFilter === 'all') return true;
    const monthStr = String(monthIndex + 1).padStart(2, '0');
    const dayStr = String(dayNum).padStart(2, '0');
    const dateStr = `${year}-${monthStr}-${dayStr}`;
    const energy = getEnergyForDate(dateStr);
    
    // General energy filters
    switch (activeFilter) {
      case 'lucky': return energy?.is_lucky_day || false;
      case 'money_activation': return energy?.is_money_activation || false;
      case 'rest': return energy?.is_rest_day || false;
      case 'money_haircut': return energy?.is_money_haircut || false;
      case 'solar_eclipse': return energy?.is_solar_eclipse || false;
      case 'lunar_eclipse': return energy?.is_lunar_eclipse || false;
      case 'no_wealth': return energy?.is_no_wealth_day || false;
      case 'mercury_retrograde': return energy?.is_mercury_retrograde || false;
    }
    
    // Personal emoji filters
    const personalEmojis = getPersonalEmojisListForDate?.(dateStr) || [];
    const emojiFilterMap: Record<string, string> = {
      noble_person: '🙌',
      courage: '🏆',
      movement: '🚀',
      networking: '🤝',
      creative: '🎨',
      intelligence: '💡',
      investments: '💰',
      work_earnings: '💵',
      purchases: '🛍️',
      planning: '📝',
      practices: '🧘‍♀️',
      self_care: '❤️',
      doctor: '👩‍⚕️',
      crisis: '⚖️',
    };
    
    const targetEmoji = emojiFilterMap[activeFilter];
    if (targetEmoji) {
      return personalEmojis.includes(targetEmoji);
    }
    
    return true;
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1;
  };

  const getWeekHeader = () => {
    const weekDates = getWeekDates(viewDate);
    const firstDay = weekDates[0];
    const lastDay = weekDates[6];
    const monthFirst = firstDay.toLocaleDateString('ru', { month: 'short' });
    const monthLast = lastDay.toLocaleDateString('ru', { month: 'short' });
    
    if (monthFirst === monthLast) {
      return `${firstDay.getDate()} - ${lastDay.getDate()} ${monthFirst}`;
    }
    return `${firstDay.getDate()} ${monthFirst} - ${lastDay.getDate()} ${monthLast}`;
  };

  const renderMonthGrid = (monthIndex: number, isMini = false, yearOverride?: number) => {
    const year = yearOverride ?? viewDate.getFullYear();
    const daysInMonth = getDaysInMonth(year, monthIndex);
    const firstDay = getFirstDayOfMonth(year, monthIndex);
    
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    
    return (
      <div className={`grid grid-cols-7 ${isMini ? 'gap-0.5' : 'gap-2'} text-center`}>
        {days.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="aspect-square" />;
          }
          
          const isVisible = getDayStatus(day, monthIndex, year);
          const isCurrent = currentDate.getFullYear() === year && currentDate.getMonth() === monthIndex && currentDate.getDate() === day;
          const isSelected = selectedCalendarDate && selectedCalendarDate.getFullYear() === year && selectedCalendarDate.getMonth() === monthIndex && selectedCalendarDate.getDate() === day;
          
          if (isMini) {
            const colorStyle = isCurrent 
              ? "bg-primary text-primary-foreground" 
              : (!isVisible 
                ? "opacity-10 text-muted-foreground" 
                : (activeFilter !== 'all' 
                  ? "text-primary font-black" 
                  : "text-muted-foreground"));
            return (
              <div 
                key={day} 
                className={`text-[8px] font-bold aspect-square flex items-center justify-center rounded-sm font-mono ${colorStyle}`}
              >
                {day}
              </div>
            );
          }
          
          const baseStyle = isCurrent 
            ? "calendar-day-current" 
            : (!isVisible 
              ? "calendar-day-dimmed" 
              : (activeFilter !== 'all' 
                ? "calendar-day-filtered" 
                : "calendar-day-default"));
          
          // Build date string to check for lucky day
          const monthStr = String(monthIndex + 1).padStart(2, '0');
          const dayStr = String(day).padStart(2, '0');
          const cellDateStr = `${year}-${monthStr}-${dayStr}`;
          const isLucky = isLuckyDay(cellDateStr);
          
          const isCompleted = isDayFullyCompleted(day, monthIndex, year);
          
          // Get personal emojis if function is available
          const personalEmojis = getPersonalEmojisForDate ? getPersonalEmojisForDate(cellDateStr) : '';
          const energyEmojis = getEnergyEmojis(cellDateStr);
          const allEmojis = [energyEmojis, personalEmojis].filter(Boolean).join('');
          
          return (
            <button 
              key={day} 
              onClick={() => {
                setSelectedCalendarDate(new Date(year, monthIndex, day));
                setHasSelectedDateInMonth(true);
              }} 
              className={`calendar-day ${baseStyle} ${isSelected ? 'calendar-day-selected' : ''} flex flex-col items-center justify-center gap-0 relative`}
            >
              {isCompleted && (
                <span className="absolute -top-1 text-[10px]">👑</span>
              )}
              <span className="text-xs font-bold leading-none">{day}</span>
              {allEmojis && (
                <span className="text-[7px] leading-none mt-0.5">{allEmojis}</span>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="px-6 pt-10 pb-48">
      {/* Header */}
      <div className="flex flex-col mb-4">
        <div className="flex justify-between items-center mb-4">
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="btn-icon">
              <Menu size={20} />
            </button>
            
            {showMenu && (
              <div className="absolute top-14 left-0 w-48 bg-card rounded-2xl shadow-elevated border border-border/50 z-[110] overflow-hidden py-1 animate-zoom-in">
                {(['day', 'week', 'month', 'year'] as CalendarViewType[]).map(v => (
                  <button 
                    key={v} 
                    onClick={() => { handleMenuViewChange(v); setShowMenu(false); }} 
                    className={`w-full text-left px-5 py-3 text-sm font-bold ${calendarView === v ? 'text-primary bg-accent' : 'text-foreground'}`}
                  >
                    {v === 'day' ? '1 День' : v === 'week' ? 'Неделя' : v === 'month' ? 'Месяц' : 'Год'}
                  </button>
                ))}
                <button 
                  onClick={() => { setIsInstructionOpen(true); setShowMenu(false); }} 
                  className="w-full text-left px-5 py-3 text-sm text-muted-foreground font-medium border-t border-border/50 flex items-center gap-2 hover:bg-muted"
                >
                  <BookOpen size={14} /> Гид по эмодзи
                </button>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                if (calendarView === 'year') {
                  setYearViewYear(yearViewYear - 1);
                } else {
                  changeViewDate(-1);
                }
              }} 
              className="text-muted-foreground/40 hover:text-primary p-1 transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
            <h2 className="text-lg font-black text-foreground min-w-[140px] text-center tracking-tight">
              {calendarView === 'day' 
                ? viewDate.toLocaleDateString('ru', { day: 'numeric', month: 'long' }) 
                : calendarView === 'month' 
                  ? viewDate.toLocaleDateString('ru', { month: 'long', year: 'numeric' })
                  : calendarView === 'week' 
                    ? getWeekHeader()
                    : `${yearViewYear} Год`}
            </h2>
            <button 
              onClick={() => {
                if (calendarView === 'year') {
                  setYearViewYear(yearViewYear + 1);
                } else {
                  changeViewDate(1);
                }
              }} 
              className="text-muted-foreground/40 hover:text-primary p-1 transition-colors"
            >
              <ChevronRight size={24} />
            </button>
          </div>
          
          <div className="min-w-[44px] text-right">
            {calendarView !== 'day' && (
              <div className="relative">
                <button 
                  onClick={() => setShowFilter(!showFilter)} 
                  className={`btn-icon ${activeFilter !== 'all' ? 'bg-primary text-primary-foreground border-primary' : ''}`}
                >
                  <Filter size={20} />
                </button>
                
                {showFilter && (
                  <div className="absolute top-14 right-0 w-64 bg-card rounded-2xl shadow-elevated border border-border/50 z-[110] py-1 animate-zoom-in max-h-[70vh] overflow-y-auto">
                    {/* General energy filters */}
                    <div className="px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Общие</div>
                    {[
                      { id: 'all' as FilterType, label: 'Показать все', emoji: '' }, 
                      { id: 'lucky' as FilterType, label: 'Удачные дни', emoji: '✅' }, 
                      { id: 'money_activation' as FilterType, label: 'Активация денег', emoji: '💸' },
                      { id: 'rest' as FilterType, label: 'Дни отдыха', emoji: '🛌' },
                      { id: 'money_haircut' as FilterType, label: 'Денежная стрижка', emoji: '✂️' },
                      { id: 'solar_eclipse' as FilterType, label: 'Солнечное затмение', emoji: '🌑' },
                      { id: 'lunar_eclipse' as FilterType, label: 'Лунное затмение', emoji: '🌕' },
                      { id: 'no_wealth' as FilterType, label: 'Дни без богатства', emoji: '⛔' },
                      { id: 'mercury_retrograde' as FilterType, label: 'Ретроградный Меркурий', emoji: '🪐' },
                    ].map(f => (
                      <button 
                        key={f.id} 
                        onClick={() => { setActiveFilter(f.id); setShowFilter(false); }} 
                        className={`w-full text-left px-5 py-3 text-sm font-medium ${activeFilter === f.id ? 'text-primary bg-accent' : 'text-foreground hover:bg-muted'}`}
                      >
                        {f.emoji && <span className="mr-2">{f.emoji}</span>}{f.label}
                      </button>
                    ))}
                    
                    {/* Personal emoji filters - only show with subscription */}
                    {hasSubscription && (
                      <div className="border-t border-border/50 mt-1 pt-1">
                        <div className="px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Персональные</div>
                        {[
                          { id: 'noble_person' as FilterType, label: 'Благородный человек', emoji: '🙌' },
                          { id: 'courage' as FilterType, label: 'Смелость', emoji: '🏆' },
                          { id: 'movement' as FilterType, label: 'Движение', emoji: '🚀' },
                          { id: 'networking' as FilterType, label: 'Нетворкинг', emoji: '🤝' },
                          { id: 'creative' as FilterType, label: 'Творчество', emoji: '🎨' },
                          { id: 'intelligence' as FilterType, label: 'Интеллект', emoji: '💡' },
                          { id: 'investments' as FilterType, label: 'Инвестиции', emoji: '💰' },
                          { id: 'work_earnings' as FilterType, label: 'Работа/Заработок', emoji: '💵' },
                          { id: 'purchases' as FilterType, label: 'Покупки', emoji: '🛍️' },
                          { id: 'planning' as FilterType, label: 'Планирование', emoji: '📝' },
                          { id: 'practices' as FilterType, label: 'Практики', emoji: '🧘‍♀️' },
                          { id: 'self_care' as FilterType, label: 'Забота о себе', emoji: '❤️' },
                          { id: 'doctor' as FilterType, label: 'Врач', emoji: '👩‍⚕️' },
                          { id: 'crisis' as FilterType, label: 'Кризис', emoji: '⚖️' },
                        ].map(f => (
                          <button 
                            key={f.id} 
                            onClick={() => { setActiveFilter(f.id); setShowFilter(false); }} 
                            className={`w-full text-left px-5 py-3 text-sm font-medium ${activeFilter === f.id ? 'text-primary bg-accent' : 'text-foreground hover:bg-muted'}`}
                          >
                            <span className="mr-2">{f.emoji}</span>{f.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Goals */}
        {calendarView === 'year' ? (
          <div className="bg-card px-4 py-3 rounded-2xl border border-border/50 shadow-sm">
            <span className="text-[7px] font-black text-muted-foreground uppercase tracking-[0.15em] mb-0.5 leading-none block">
              Цель года
            </span>
            <p className="text-[10px] font-bold text-foreground leading-tight">{yearGoal}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-primary px-4 py-3 rounded-2xl shadow-sm">
              <span className="text-[7px] font-black text-primary-foreground/70 uppercase tracking-[0.15em] mb-0.5 leading-none block">
                Цель месяца
              </span>
              <p className="text-[10px] font-bold text-primary-foreground leading-tight line-clamp-2">{monthGoal}</p>
            </div>
            <div className="bg-card px-4 py-3 rounded-2xl border border-border/50 shadow-sm">
              <span className="text-[7px] font-black text-muted-foreground uppercase tracking-[0.15em] mb-0.5 leading-none block">
                Цель года
              </span>
              <p className="text-[10px] font-bold text-foreground leading-tight line-clamp-2">{yearGoal}</p>
            </div>
          </div>
        )}
      </div>

      {/* Calendar content */}
      {calendarView === 'day' && (
        <DayDataSection 
          dateObj={viewDate} 
          tasks={tasks} 
          habits={habits} 
          toggleTask={toggleTask} 
          deleteTask={deleteTask} 
          toggleHabit={toggleHabit} 
          deleteHabit={deleteHabit}
          updateTask={updateTask}
          updateHabit={updateHabit}
          hintText={hintText}
          dailyEnergy={dailyEnergy}
          achievements={achievements}
          onAchievementChange={onAchievementChange}
          getPersonalFocusForDate={getPersonalFocusForDate}
        />
      )}
      
      {calendarView === 'month' && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => (
              <div key={d} className="text-[10px] font-black text-muted-foreground/40 uppercase">{d}</div>
            ))}
          </div>
          {renderMonthGrid(viewDate.getMonth())}
          {hasSelectedDateInMonth && (
            <DayDataSection 
              dateObj={selectedCalendarDate} 
              tasks={tasks} 
              habits={habits} 
              toggleTask={toggleTask} 
              deleteTask={deleteTask} 
              toggleHabit={toggleHabit} 
              deleteHabit={deleteHabit}
              updateTask={updateTask}
              updateHabit={updateHabit}
              hintText={hintText}
              dailyEnergy={dailyEnergy}
              achievements={achievements}
              onAchievementChange={onAchievementChange}
              getPersonalFocusForDate={getPersonalFocusForDate}
            />
          )}
        </div>
      )}
      
      {calendarView === 'week' && (
        <div className="mt-4 space-y-3">
          <div className="flex divide-x divide-border">
            {getWeekDates(viewDate).map((date, i) => {
              const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
              const dayNum = date.getDate();
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const day = String(date.getDate()).padStart(2, '0');
              const dateStr = `${year}-${month}-${day}`;
              const isToday = date.getDate() === currentDate.getDate() && date.getMonth() === currentDate.getMonth() && date.getFullYear() === currentDate.getFullYear();
              const dayTasks = tasks.filter(t => t.date === dateStr);
              const dayOfWeek = date.getDay() === 0 ? 6 : date.getDay() - 1;
              
              const isVisible = getDayStatus(dayNum, date.getMonth(), date.getFullYear());
              const isDimmed = !isVisible && activeFilter !== 'all';
              const isLucky = isLuckyDay(dateStr);
              
              // Get personal emojis if function is available
              const personalEmojis = getPersonalEmojisForDate ? getPersonalEmojisForDate(dateStr) : '';
              const energyEmojis = getEnergyEmojis(dateStr);
              const allEmojis = [energyEmojis, personalEmojis].filter(Boolean).join('');
              
              return (
                <button 
                  key={`${dateStr}`} 
                  onClick={() => navigateToDay(date)} 
                  className={`flex-1 flex flex-col items-center py-2 px-1 transition-all ${
                    isDimmed 
                      ? 'opacity-30 bg-muted' 
                      : isToday 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-card text-foreground'
                  }`}
                >
                  <div className="text-[9px] font-bold uppercase opacity-60">{dayNames[dayOfWeek]}</div>
                  <div className="text-base font-black my-0.5">{dayNum}</div>
                  {allEmojis && <div className="text-[10px] mb-0.5">{allEmojis}</div>}
                  <div className="w-full h-px bg-border/50 my-1" />
                  {dayTasks.length > 0 ? (
                    <div className="w-full space-y-0.5 px-0.5">
                      {dayTasks.map(task => (
                        <div 
                          key={task.id} 
                          className={`text-[7px] font-medium px-1 py-0.5 rounded bg-muted/50 text-left leading-tight ${
                            isToday ? 'bg-primary-foreground/20' : ''
                          }`}
                          style={{ wordBreak: 'break-word', overflowWrap: 'break-word', whiteSpace: 'normal' }}
                        >
                          {task.text}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={`text-[8px] min-h-[20px] flex items-center ${isToday ? 'text-primary-foreground/60' : 'text-muted-foreground/50'}`}>—</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
      
      {calendarView === 'year' && (
        <div className="grid grid-cols-3 gap-3 mt-4 pb-10 animate-fade-in">
          {['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'].map((m, i) => (
            <button 
              key={m} 
              onClick={() => { setViewDate(new Date(yearViewYear, i, 1)); setCalendarViewState('month'); }} 
              className="bg-card border border-border/50 rounded-3xl p-2.5 shadow-sm active:scale-95 transition-all"
            >
              <div className="text-[10px] font-black uppercase mb-2 text-foreground leading-none">{m}</div>
              {renderMonthGrid(i, true, yearViewYear)}
            </button>
          ))}
        </div>
      )}

      {/* Emoji Guide Modal */}
      <EmojiGuideModal 
        isOpen={isInstructionOpen} 
        onClose={() => setIsInstructionOpen(false)} 
      />

      {/* FAB Button */}
      <div className="fixed bottom-32 right-6 z-[160]">
        <button 
          onClick={() => {
            // Get the correct date based on current view
            let dateToUse: Date;
            if (calendarView === 'day') {
              dateToUse = viewDate;
            } else if (calendarView === 'month' && selectedCalendarDate) {
              dateToUse = selectedCalendarDate;
            } else if (calendarView === 'week' && selectedCalendarDate) {
              dateToUse = selectedCalendarDate;
            } else {
              // Fallback to current date (25 Jan 2026)
              dateToUse = new Date(2026, 0, 25);
            }
            
            // Format date as YYYY-MM-DD without timezone issues
            const year = dateToUse.getFullYear();
            const month = String(dateToUse.getMonth() + 1).padStart(2, '0');
            const day = String(dateToUse.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            
            onOpenAddModal(dateStr);
          }}
          className="w-14 h-14 bg-card rounded-full flex items-center justify-center text-primary shadow-lg border border-border/50 active:scale-90 transition-all"
        >
          <Plus size={28} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
};
