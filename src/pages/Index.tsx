import React, { useState, useMemo, useEffect } from 'react';
import { Zap, Loader2 } from 'lucide-react';
import { Navigation, type TabId } from '@/components/planner/Navigation';
import { FocusCard } from '@/components/planner/FocusCard';
import { CalendarView } from '@/components/planner/CalendarView';
import { AnalyticsView } from '@/components/planner/AnalyticsView';
import { ProfileView } from '@/components/planner/ProfileView';
import { ForecastView } from '@/components/planner/ForecastView';
import { Modal } from '@/components/planner/Modal';
import { RichTextDisplay } from '@/components/ui/rich-text-editor';
import { useUserData } from '@/hooks/useUserData';

// Task interface for components
export interface Task {
  id: number | string;
  text: string;
  completed: boolean;
  date: string;
  recurringGroupId?: string | null;
}

// Habit interface with per-date completion tracking
export interface Habit {
  id: number | string;
  text: string;
  completedDates: string[];
  streak: number;
  target: number;
  repeat: 'week' | 'month' | '3months' | 'year';
  startDate: string;
  endDate: string;
}

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [viewDate, setViewDate] = useState(new Date());
  const [showUnifiedModal, setShowUnifiedModal] = useState(false);
  const [addType, setAddType] = useState<'task' | 'habit'>('task');

  // Load data from database
  const {
    loading,
    profile,
    tasks: dbTasks,
    habits: dbHabits,
    dailyEnergy,
    userHint,
    generalForecast,
    individualForecasts,
    achievements,
    addTask,
    toggleTask,
    deleteTask,
    updateTask,
    addHabit,
    toggleHabit,
    deleteHabit,
    updateHabit,
    saveYearGoal,
    saveMonthGoal,
    saveAchievement,
    getYearGoal,
    getMonthGoals,
    getTodayEnergy,
    getHabitCompletedDates,
    getPersonalEmojisForDate,
    getPersonalEmojisListForDate,
    getPersonalFocusForDate,
    hasActiveSubscription,
    updateProfile,
    error: loadError,
    loadUserData,
  } = useUserData();

  // Convert DB tasks to component format
  const tasks: Task[] = useMemo(() => {
    return dbTasks.map(t => ({
      id: t.id,
      text: t.text,
      completed: t.completed,
      date: t.date.split('T')[0],
      recurringGroupId: t.recurring_group_id,
    }));
  }, [dbTasks]);

  // Convert DB habits to component format
  const habits: Habit[] = useMemo(() => {
    return dbHabits.map(h => {
      const completedDates = getHabitCompletedDates(h.id);
      const targetDays = h.repeat === 'week' ? 7 : h.repeat === 'month' ? 30 : h.repeat === '3months' ? 90 : 365;
      return {
        id: h.id,
        text: h.text,
        completedDates,
        streak: completedDates.length,
        target: targetDays,
        repeat: h.repeat,
        startDate: h.start_date.split('T')[0],
        endDate: h.end_date?.split('T')[0] || '',
      };
    });
  }, [dbHabits, getHabitCompletedDates]);

  // Get user info from profile
  const userFirstName = profile?.first_name || 'Пользователь';
  const userFullName = profile?.first_name && profile?.last_name 
    ? `${profile.first_name} ${profile.last_name}`
    : profile?.first_name || 'Пользователь';
  const userBirthDate = profile?.birth_date 
    ? new Date(profile.birth_date).toLocaleDateString('ru', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';

  // Get goals from forecasts
  const yearGoal = getYearGoal();
  const monthGoals = getMonthGoals();
  const currentMonthGoal = monthGoals[viewDate.getMonth()] || "Цель месяца не задана";

  // Get today's energy
  const todayEnergy = getTodayEnergy();
  const energyText = todayEnergy?.daily_advice || 'Энергия дня: Гармоничный день';
  
  // Get all energy emojis for today
  const getTodayEmojis = (): string => {
    if (!todayEnergy) return '';
    const emojis: string[] = [];
    if (todayEnergy.is_lucky_day) emojis.push('✅');
    if (todayEnergy.is_money_activation) emojis.push('💸');
    if (todayEnergy.is_rest_day) emojis.push('🛌');
    if (todayEnergy.is_money_haircut) emojis.push('✂️');
    if (todayEnergy.is_solar_eclipse) emojis.push('🌑');
    if (todayEnergy.is_lunar_eclipse) emojis.push('🌕');
    if (todayEnergy.is_no_wealth_day) emojis.push('⛔');
    if (todayEnergy.is_mercury_retrograde) emojis.push('🪐');
    return emojis.join(' ');
  };
  const todayEmojis = getTodayEmojis();

  // Format date for input (YYYY-MM-DD)
  const formatDateForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Get personalized focus for today
  const todayStr = formatDateForInput(new Date());
  const personalFocusToday = getPersonalFocusForDate(todayStr);

  // Focus content - use personalized focus if available
  const focusTitle = "Фокус дня";
  const focusDesc = personalFocusToday || "";

  // Form states for adding
  const [newItemText, setNewItemText] = useState('');
  const [newItemDate, setNewItemDate] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [newHabitRepeat, setNewHabitRepeat] = useState<'week' | 'month' | '3months' | 'year'>('week');
  const [newTaskRepeat, setNewTaskRepeat] = useState<'none' | 'daily' | 'weekdays' | 'monthly' | 'yearly'>('none');

  const completionRate = useMemo(() => {
    const todayStr = formatDateForInput(viewDate);
    const todayTasks = tasks.filter(t => t.date === todayStr);
    if (todayTasks.length === 0) return 0;
    return Math.round((todayTasks.filter(t => t.completed).length / todayTasks.length) * 100);
  }, [tasks, viewDate]);

  // Handlers that call DB functions
  const handleToggleTask = async (id: number | string) => {
    await toggleTask(String(id));
  };

  const handleDeleteTask = async (id: number | string, deleteAll: boolean = false) => {
    await deleteTask(String(id), deleteAll);
  };

  const handleToggleHabit = async (id: number | string, dateStr: string) => {
    await toggleHabit(String(id), dateStr);
  };

  const handleDeleteHabit = async (id: number | string) => {
    await deleteHabit(String(id));
  };

  const handleUpdateTask = async (id: number | string, newText: string) => {
    await updateTask(String(id), newText);
  };

  const handleUpdateHabit = async (id: number | string, newText: string) => {
    await updateHabit(String(id), newText);
  };

  const handleSaveItem = async () => {
    if (!newItemText.trim()) return;
    
    if (addType === 'task') {
      if (newTaskRepeat === 'none') {
        // Single task
        await addTask(newItemText.trim(), newItemDate);
      } else {
        // Repeating task - create multiple tasks with shared recurring_group_id
        const [year, month, day] = newItemDate.split('-').map(Number);
        const startDate = new Date(year, month - 1, day);
        const endDate = new Date(2027, 1, 3); // February 3, 2027
        
        // Generate a unique group ID for all related tasks
        const recurringGroupId = crypto.randomUUID();
        
        const dates: string[] = [];
        const current = new Date(startDate);
        
        while (current <= endDate) {
          const dayOfWeek = current.getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          
          // Skip weekends for 'weekdays' repeat
          if (!(newTaskRepeat === 'weekdays' && isWeekend)) {
            const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
            dates.push(dateStr);
          }
          
          if (newTaskRepeat === 'daily' || newTaskRepeat === 'weekdays') {
            current.setDate(current.getDate() + 1);
          } else if (newTaskRepeat === 'monthly') {
            current.setMonth(current.getMonth() + 1);
          } else if (newTaskRepeat === 'yearly') {
            current.setFullYear(current.getFullYear() + 1);
          }
        }
        
        // Create all tasks with the same recurring_group_id
        for (const dateStr of dates) {
          await addTask(newItemText.trim(), dateStr, recurringGroupId);
        }
      }
    } else {
      await addHabit(newItemText.trim(), newItemDate, newHabitRepeat);
    }
    
    setNewItemText('');
    setNewTaskRepeat('none');
    setShowUnifiedModal(false);
  };

  const handleSetYearGoal = async (goal: string) => {
    await saveYearGoal(goal);
  };

  const handleAchievementChange = async (dateStr: string, a1: string, a2: string, a3: string) => {
    await saveAchievement(dateStr, a1, a2, a3);
  };
  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // First launch failed and there is nothing saved to show yet.
  if (!profile && loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background px-8 text-center">
        <p className="text-sm text-muted-foreground">
          Не удалось загрузить данные. Проверьте интернет и попробуйте ещё раз.
        </p>
        <button
          type="button"
          onClick={() => loadUserData()}
          className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground active:opacity-70"
        >
          Повторить
        </button>
      </div>
    );
  }

  return (
    <div className="app-container min-h-screen overflow-x-hidden flex flex-col">
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {/* Home Tab */}
        {activeTab === 'home' && (
          <div className="pb-32 px-6 pt-10 animate-fade-in">
            <h1 className="text-2xl font-black text-foreground leading-none mb-2 tracking-tight">
              {userFirstName}, привет!
            </h1>
            <RichTextDisplay 
              content={energyText} 
              className="text-muted-foreground text-[10px] font-medium tracking-wide mb-8"
            />
            <FocusCard 
              date={new Date().getDate().toString()} 
              month={new Date().toLocaleDateString('ru', { month: 'short' })} 
              focusTitle={focusTitle} 
              focusDesc={focusDesc} 
            />
          </div>
        )}
        
        {/* Forecast Tab */}
        {activeTab === 'forecast' && (
          <ForecastView 
            yearGoal={yearGoal} 
            setYearGoal={handleSetYearGoal}
            monthGoals={monthGoals}
            saveMonthGoal={saveMonthGoal}
            generalForecast={generalForecast}
            individualForecasts={individualForecasts}
          />
        )}
        
        {/* Calendar Tab */}
        {activeTab === 'calendar' && (
          <CalendarView
            viewDate={viewDate}
            setViewDate={setViewDate}
            tasks={tasks}
            habits={habits}
            toggleTask={handleToggleTask}
            deleteTask={handleDeleteTask}
            toggleHabit={handleToggleHabit}
            deleteHabit={handleDeleteHabit}
            updateTask={handleUpdateTask}
            updateHabit={handleUpdateHabit}
            yearGoal={yearGoal || "Цель года не задана"}
            monthGoal={currentMonthGoal}
            onOpenAddModal={(dateStr) => {
              setNewItemDate(dateStr);
              setShowUnifiedModal(true);
            }}
            hintText={userHint?.hint_text}
            dailyEnergy={dailyEnergy}
            achievements={achievements}
            onAchievementChange={handleAchievementChange}
            getPersonalEmojisForDate={getPersonalEmojisForDate}
            getPersonalEmojisListForDate={getPersonalEmojisListForDate}
            getPersonalFocusForDate={getPersonalFocusForDate}
            hasSubscription={hasActiveSubscription()}
          />
        )}
        
        {/* Success Tab */}
        {activeTab === 'analytics' && (
          <AnalyticsView 
            completionRate={completionRate} 
            tasks={tasks}
            achievements={achievements}
          />
        )}
        
        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <ProfileView 
            userName={userFullName} 
            userFirstName={profile?.first_name || ''}
            userLastName={profile?.last_name || ''}
            userBirthDate={userBirthDate}
            subscriptionUntil={profile?.subscription_until || null}
            onUpdateProfile={updateProfile}
          />
        )}
      </div>

      {/* Navigation */}
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Add Modal */}
      {showUnifiedModal && (
        <Modal title="Запись" onClose={() => setShowUnifiedModal(false)}>
          <div className="space-y-4">
            <div className="tab-switcher mb-2">
              <button 
                onClick={() => setAddType('task')} 
                className={`tab-button ${addType === 'task' ? 'tab-button-active' : 'tab-button-inactive'}`}
              >
                Задача
              </button>
              <button 
                onClick={() => setAddType('habit')} 
                className={`tab-button ${addType === 'habit' ? 'tab-button-active' : 'tab-button-inactive'}`}
              >
                Привычка
              </button>
            </div>
            
            <div className="space-y-4">
              <input 
                type="text" 
                placeholder={addType === 'task' ? "Что нужно сделать?" : "Текст привычки..."} 
                className="input-soft"
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
              />
              
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1">
                  {addType === 'task' ? 'Дата' : 'Дата начала'}
                </label>
                <input 
                  type="date" 
                  className="input-soft"
                  value={newItemDate}
                  onChange={(e) => setNewItemDate(e.target.value)}
                />
              </div>

              {addType === 'task' && (
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1">
                    Повторить
                  </label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[
                      { value: 'none' as const, label: 'Нет' },
                      { value: 'daily' as const, label: 'Каждый день' },
                      { value: 'weekdays' as const, label: 'Будни' },
                      { value: 'monthly' as const, label: 'Каждый мес.' },
                      { value: 'yearly' as const, label: 'Каждый год' }
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setNewTaskRepeat(opt.value)}
                        className={`py-2 px-1.5 rounded-xl text-[9px] font-bold transition-all ${
                          newTaskRepeat === opt.value 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {addType === 'habit' && (
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1">
                    Срок привычки
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { value: 'week' as const, label: 'Неделя' },
                      { value: 'month' as const, label: 'Месяц' },
                      { value: '3months' as const, label: '3 мес.' },
                      { value: 'year' as const, label: 'Год' }
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setNewHabitRepeat(opt.value)}
                        className={`py-2 px-2 rounded-xl text-[10px] font-bold transition-all ${
                          newHabitRepeat === opt.value 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              <button 
                onClick={handleSaveItem} 
                className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-black text-xs uppercase tracking-widest mt-2 active:scale-95 transition-all shadow-elevated"
              >
                Сохранить
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Index;
