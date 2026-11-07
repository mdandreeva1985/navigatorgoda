import React, { useEffect, useState, useMemo } from "react";
import { TrendingUp } from "lucide-react";
import type { Task } from "@/pages/Index";
import type { DbAchievement } from "@/hooks/useUserData";

interface AnalyticsViewProps {
  completionRate: number;
  tasks: Task[];
  achievements?: DbAchievement[];
}

// Get dates for the last 7 days (including today)
const getWeekDates = (): string[] => {
  const dates: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset to midnight for consistent comparison
  
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    dates.push(`${year}-${month}-${day}`);
  }
  return dates;
};

// Normalize date string to YYYY-MM-DD format
const normalizeDate = (dateStr: string): string => {
  if (!dateStr) return '';
  // Handle both "2026-01-27" and "2026-01-27T00:00:00.000Z" formats
  return dateStr.split('T')[0];
};

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ tasks, achievements = [] }) => {
  const [animatedRate, setAnimatedRate] = useState(0);

  // Weekly stats calculation with proper date normalization
  const weekDates = getWeekDates();
  const weekTasks = tasks.filter((t) => {
    const taskDate = normalizeDate(t.date);
    return weekDates.includes(taskDate);
  });
  const weekTotal = weekTasks.length;
  const weekCompleted = weekTasks.filter((t) => t.completed).length;
  const weekRemaining = weekTotal - weekCompleted;
  const weekRate = weekTotal > 0 ? Math.round((weekCompleted / weekTotal) * 100) : 0;

  // Count achievements from DB data (user-specific)
  const totalAchievementsCount = useMemo(() => {
    // Safety: if duplicates for the same date ever appear in client state,
    // count only the latest record per date.
    const byDate = new Map<string, DbAchievement>();
    achievements.forEach((a) => {
      byDate.set(normalizeDate(a.date), a);
    });

    let count = 0;
    byDate.forEach((a) => {
      if (a.achievement_1 && a.achievement_1.trim() !== "") count++;
      if (a.achievement_2 && a.achievement_2.trim() !== "") count++;
      if (a.achievement_3 && a.achievement_3.trim() !== "") count++;
    });
    return count;
  }, [achievements]);

  // Animate the weekly rate on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedRate(weekRate);
    }, 100);
    return () => clearTimeout(timer);
  }, [weekRate]);

  // Calculate total completed tasks
  const totalCompletedTasks = tasks.filter((t) => t.completed).length;

  // Calculate days of activity (days where >85% tasks completed)
  const tasksByDate = tasks.reduce(
    (acc, task) => {
      const normalizedDate = normalizeDate(task.date);
      if (!acc[normalizedDate]) acc[normalizedDate] = { total: 0, completed: 0 };
      acc[normalizedDate].total++;
      if (task.completed) acc[normalizedDate].completed++;
      return acc;
    },
    {} as Record<string, { total: number; completed: number }>,
  );

  const daysOfActivity = Object.values(tasksByDate).filter(
    (day) => day.total > 0 && day.completed / day.total >= 0.85,
  ).length;

  // Calculate overall success percentage (all completed tasks / all tasks)
  const totalTasks = tasks.length;
  const overallSuccessRate = totalTasks > 0 ? Math.round((totalCompletedTasks / totalTasks) * 100) : 0;

  return (
    <div className="pb-32 px-6 pt-10 animate-fade-in">
      <h4 className="font-bold text-foreground px-1">Аналитика недели</h4>

      <div className="space-y-6">
        {/* Weekly progress ring */}
        <div className="card-soft p-6 flex flex-col items-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <TrendingUp size={80} />
          </div>

          <div className="progress-ring w-24 h-24 mb-4 relative">
            <svg className="w-full h-full -rotate-90">
              <circle cx="48" cy="48" r="42" fill="transparent" stroke="hsl(var(--muted))" strokeWidth="4" />
              <circle
                cx="48"
                cy="48"
                r="42"
                fill="transparent"
                stroke="hsl(var(--primary))"
                strokeWidth="4"
                strokeDasharray={`${(animatedRate * 264) / 100} 264`}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-black text-foreground tracking-tight">{weekRate}%</span>
              <span className="text-[7px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">
                неделя
              </span>
            </div>
          </div>

          {/* Weekly stats line */}
          <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
            <span>
              Всего: <span className="font-bold text-foreground">{weekTotal}</span>
            </span>
            <span className="text-muted">|</span>
            <span>
              Выполнено: <span className="font-bold text-primary">{weekCompleted}</span>
            </span>
            <span className="text-muted">|</span>
            <span>
              Осталось: <span className="font-bold text-foreground">{weekRemaining}</span>
            </span>
          </div>
        </div>

        {/* Overall progress section */}
        <div className="space-y-3">
          <h4 className="font-bold text-foreground px-1">Общий прогресс</h4>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-4 pb-10">
            <div className="stat-card">
              <span className="text-2xl font-black text-foreground">{totalCompletedTasks}</span>
              <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider mt-1 leading-tight">
                Задач
                <br />
                выполнено
              </span>
            </div>

            <div className="stat-card">
              <span className="text-2xl font-black text-foreground">{daysOfActivity}</span>
              <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider mt-1 leading-tight">
                Дни
                <br />
                активности
              </span>
            </div>

            <div className="stat-card">
              <span className="text-2xl font-black text-foreground">{overallSuccessRate}%</span>
              <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider mt-1 leading-tight">
                % успеха
              </span>
            </div>

            <div className="stat-card">
              <span className="text-2xl font-black text-foreground">{totalAchievementsCount}</span>
              <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider mt-1 leading-tight">
                Всего
                <br />
                достижений
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
