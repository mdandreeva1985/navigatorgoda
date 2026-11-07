import React, { useState, useEffect } from 'react';
import { useExternalDb } from '@/hooks/useExternalDb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronLeft, ChevronRight, Plus, Trash2, Loader2, Pencil, X, Check } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface Task {
  id: string;
  text: string;
  date: string;
  completed: boolean;
}

interface ClientCalendarProps {
  clientId: string;
}

export const ClientCalendar: React.FC<ClientCalendarProps> = ({ clientId }) => {
  const { query } = useExternalDb();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  useEffect(() => {
    loadTasks();
  }, [currentDate, clientId]);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const start = format(monthStart, 'yyyy-MM-dd');
      const end = format(monthEnd, 'yyyy-MM-dd');
      const result = await query<Task>(
        `SELECT * FROM life_navigator.tasks 
         WHERE user_id = '${clientId}' 
         AND date >= '${start}' AND date <= '${end}'
         ORDER BY date, created_at`
      );
      setTasks(result);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTasksForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return tasks.filter(t => t.date.split('T')[0] === dateStr);
  };

  const handleAddTask = async () => {
    if (!selectedDate || !newTaskText.trim()) return;

    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      await query(
        `INSERT INTO life_navigator.tasks (user_id, text, date, completed)
         VALUES ('${clientId}', '${newTaskText.replace(/'/g, "''")}', '${dateStr}', false)`
      );
      setNewTaskText('');
      await loadTasks();
      toast({ title: 'Задача добавлена' });
    } catch (error) {
      console.error('Failed to add task:', error);
      toast({ title: 'Ошибка', description: 'Не удалось добавить задачу', variant: 'destructive' });
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await query(`DELETE FROM life_navigator.tasks WHERE id = '${taskId}'`);
      await loadTasks();
      toast({ title: 'Задача удалена' });
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось удалить задачу', variant: 'destructive' });
    }
  };

  const handleToggleTask = async (taskId: string, completed: boolean) => {
    try {
      await query(`UPDATE life_navigator.tasks SET completed = ${completed} WHERE id = '${taskId}'`);
      await loadTasks();
    } catch (error) {
      console.error('Failed to toggle task:', error);
    }
  };

  const handleStartEdit = (task: Task) => {
    setEditingTaskId(task.id);
    setEditingText(task.text);
  };

  const handleCancelEdit = () => {
    setEditingTaskId(null);
    setEditingText('');
  };

  const handleSaveEdit = async (taskId: string) => {
    if (!editingText.trim()) return;
    try {
      await query(`UPDATE life_navigator.tasks SET text = '${editingText.replace(/'/g, "''")}' WHERE id = '${taskId}'`);
      await loadTasks();
      setEditingTaskId(null);
      setEditingText('');
      toast({ title: 'Задача обновлена' });
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось обновить задачу', variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Календарь клиента</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium min-w-[140px] text-center">
              {format(currentDate, 'LLLL yyyy', { locale: ru })}
            </span>
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 mb-4">
          {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
            <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
          
          {/* Empty cells for days before month starts */}
          {Array.from({ length: (monthStart.getDay() + 6) % 7 }).map((_, i) => (
            <div key={`empty-${i}`} className="h-10" />
          ))}
          
          {days.map(day => {
            const dayTasks = getTasksForDate(day);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            
            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDate(day)}
                className={`h-10 rounded-lg text-sm relative transition-colors
                  ${isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}
                  ${!isSameMonth(day, currentDate) ? 'text-muted-foreground' : ''}
                `}
              >
                {format(day, 'd')}
                {dayTasks.length > 0 && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Date Tasks */}
        {selectedDate && (
          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">
                {format(selectedDate, 'd MMMM', { locale: ru })}
              </h4>
            </div>

            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {getTasksForDate(selectedDate).map(task => (
                    <div key={task.id} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                      <Checkbox
                        checked={task.completed}
                        onCheckedChange={(checked) => handleToggleTask(task.id, !!checked)}
                      />
                      {editingTaskId === task.id ? (
                        <div className="flex-1 flex items-center gap-1">
                          <Input
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            className="h-7 text-sm"
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(task.id)}
                          />
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleSaveEdit(task.id)}>
                            <Check className="h-3 w-3 text-green-600" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCancelEdit}>
                            <X className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <span className={`flex-1 text-sm ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                            {task.text}
                          </span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleStartEdit(task)}>
                            <Pencil className="h-3 w-3 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeleteTask(task.id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="Новая задача..."
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                  />
                  <Button onClick={handleAddTask} disabled={!newTaskText.trim()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
