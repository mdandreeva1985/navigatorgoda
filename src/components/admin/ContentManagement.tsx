import React, { useState, useEffect } from 'react';
import { useExternalDb } from '@/hooks/useExternalDb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Save, Loader2, Plus, Trash2, Upload, Pencil, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const EVENT_EMOJIS = [
  { value: '💇', label: '💇 стрижка' },
  { value: '💰', label: '💰 деньги' },
  { value: '✂️', label: '✂️ маникюр' },
  { value: '🧹', label: '🧹 уборка' },
  { value: '🏠', label: '🏠 дом' },
  { value: '💍', label: '💍 свадьба' },
  { value: '🌙', label: '🌙 луна' },
  { value: '⭐', label: '⭐ звезда' },
  { value: '🔥', label: '🔥 огонь' },
  { value: '💎', label: '💎 богатство' },
  { value: '🎯', label: '🎯 цель' },
  { value: '🌿', label: '🌿 здоровье' },
  { value: '💼', label: '💼 работа' },
  { value: '✈️', label: '✈️ путешествие' },
  { value: '🎓', label: '🎓 обучение' },
  { value: '💅', label: '💅 красота' },
  { value: '🧘', label: '🧘 медитация' },
  { value: '🌸', label: '🌸 цветение' },
];

// Energy emoji options for checkboxes (without labels for compact display)
const ENERGY_EMOJIS = [
  { key: 'is_lucky_day', emoji: '✅' },
  { key: 'is_money_activation', emoji: '💸' },
  { key: 'is_rest_day', emoji: '🛌' },
  { key: 'is_money_haircut', emoji: '✂️' },
  { key: 'is_solar_eclipse', emoji: '🌑' },
  { key: 'is_lunar_eclipse', emoji: '🌕' },
  { key: 'is_no_wealth_day', emoji: '⛔' },
  { key: 'is_mercury_retrograde', emoji: '🪐' },
];

// Heavenly stems dropdown options
const HEAVENLY_STEMS = [
  'дерево ян', 'дерево инь', 
  'огонь ян', 'огонь инь',
  'земля ян', 'земля инь',
  'металл ян', 'металл инь',
  'вода ян', 'вода инь',
];

// Earthly branches dropdown options
const EARTHLY_BRANCHES = [
  'крыса', 'бык', 'тигр', 'кролик', 
  'дракон', 'змея', 'лошадь', 'коза',
  'обезьяна', 'петух', 'собака', 'свинья',
];

interface GeneralForecast {
  id: string;
  year: number;
  title: string | null;
  content: string | null;
}

interface MonthlyEvent {
  id: string;
  date: string;
  emoji: string;
  label: string | null;
  description: string | null;
}

interface GlobalTask {
  id: string;
  text: string;
  date: string;
}

interface DailyEnergy {
  id: string;
  date: string;
  heavenly_stem: string | null;
  earthly_branch: string | null;
  is_lucky_day: boolean;
  is_money_activation: boolean;
  is_rest_day: boolean;
  is_money_haircut: boolean;
  is_solar_eclipse: boolean;
  is_lunar_eclipse: boolean;
  is_no_wealth_day: boolean;
  is_mercury_retrograde: boolean;
  daily_advice: string | null;
}

interface NewEnergyState {
  date: string;
  heavenly_stem: string;
  earthly_branch: string;
  is_lucky_day: boolean;
  is_money_activation: boolean;
  is_rest_day: boolean;
  is_money_haircut: boolean;
  is_solar_eclipse: boolean;
  is_lunar_eclipse: boolean;
  is_no_wealth_day: boolean;
  is_mercury_retrograde: boolean;
  daily_advice: string;
}

// Focus Rules Import Component
interface FocusRulesImportProps {
  query: <T>(sql: string) => Promise<T[]>;
  toast: ReturnType<typeof useToast>['toast'];
}

interface RuleRow {
  user_key: string;
  current_key: string;
  advice: string;
  emoji: string;
}

const FocusRulesImport: React.FC<FocusRulesImportProps> = ({ query, toast }) => {
  const [importing, setImporting] = useState<string | null>(null);

  const checkTableExists = async (tableName: string): Promise<boolean> => {
    try {
      const res = await query<{ exists: string | null }>(
        `SELECT to_regclass('life_navigator.${tableName}') as exists`,
      );
      return Boolean(res?.[0]?.exists);
    } catch {
      // If even this check fails, treat as missing to prevent spam-import
      return false;
    }
  };

  const parseCSV = (text: string): RuleRow[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    
    // Skip header row
    return lines.slice(1).map(line => {
      // Handle CSV with potential quoted fields containing commas
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      
      // Filter out empty values at the beginning (for CSVs with leading commas/empty columns)
      const filteredValues = values.filter((v, idx) => {
        // Keep if it's not the first value, or if it's not empty
        if (idx === 0 && v === '') return false;
        return true;
      });
      
      // Also handle case where there's an empty column before data (like Excel exports)
      const finalValues = filteredValues.length >= 4 ? filteredValues : values.slice(values.findIndex(v => v !== ''));
      
      return {
        user_key: finalValues[0] || '',
        current_key: finalValues[1] || '',
        advice: finalValues[2] || '',
        emoji: finalValues[3] || '',
      };
    }).filter(row => row.user_key && row.current_key);
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    tableName: string,
    userColumn: string,
    currentColumn: string
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(tableName);
    
    try {
      const exists = await checkTableExists(tableName);
      if (!exists) {
        toast({
          title: 'Таблицы не созданы',
          description: 'Сначала нажмите “Инициализировать схему”, затем повторите импорт CSV.',
          variant: 'destructive',
        });
        return;
      }

      const text = await file.text();
      const rows = parseCSV(text);
      
      if (rows.length === 0) {
        toast({ title: 'Ошибка', description: 'Файл пустой или неверный формат', variant: 'destructive' });
        return;
      }

      let successCount = 0;
      
      for (const row of rows) {
        try {
          await query(`
            INSERT INTO life_navigator.${tableName} (${userColumn}, ${currentColumn}, advice, emoji)
            VALUES (
              '${row.user_key.toLowerCase().replace(/'/g, "''")}',
              '${row.current_key.toLowerCase().replace(/'/g, "''")}',
              ${row.advice ? `'${row.advice.replace(/'/g, "''")}'` : 'NULL'},
              ${row.emoji ? `'${row.emoji}'` : 'NULL'}
            )
            ON CONFLICT (${userColumn}, ${currentColumn}) DO UPDATE SET
              advice = EXCLUDED.advice,
              emoji = EXCLUDED.emoji
          `);
          successCount++;
        } catch (err) {
          console.error(`Error inserting row:`, row, err);
        }
      }

      toast({ 
        title: 'Импорт завершён', 
        description: `Загружено ${successCount} из ${rows.length} правил` 
      });
    } catch (error) {
      console.error('Import error:', error);
      toast({ title: 'Ошибка импорта', description: 'Проверьте формат файла', variant: 'destructive' });
    } finally {
      setImporting(null);
      // Reset the file input
      event.target.value = '';
    }
  };

  const rulesTables = [
    { 
      id: 'stem_to_stem_rules', 
      label: 'Ствол × Ствол', 
      userCol: 'user_day_stem', 
      currentCol: 'current_day_stem',
      count: 100,
      desc: 'user_day_stem, current_day_stem, advice, emoji'
    },
    { 
      id: 'stem_to_branch_rules', 
      label: 'Ствол × Ветвь', 
      userCol: 'user_day_stem', 
      currentCol: 'current_day_branch',
      count: 120,
      desc: 'user_day_stem, current_day_branch, advice, emoji'
    },
    { 
      id: 'day_branch_rules', 
      label: 'Ветвь дня × Ветвь', 
      userCol: 'user_day_branch', 
      currentCol: 'current_day_branch',
      count: 144,
      desc: 'user_day_branch, current_day_branch, advice, emoji'
    },
    { 
      id: 'year_branch_rules', 
      label: 'Ветвь года × Ветвь', 
      userCol: 'user_year_branch', 
      currentCol: 'current_day_branch',
      count: 144,
      desc: 'user_year_branch, current_day_branch, advice, emoji'
    },
    { 
      id: 'month_branch_rules', 
      label: 'Ветвь месяца × Ветвь', 
      userCol: 'user_month_branch', 
      currentCol: 'current_day_branch',
      count: 144,
      desc: 'user_month_branch, current_day_branch, advice, emoji'
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Импорт правил фокуса (CSV)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Формат CSV: 4 колонки без заголовков или с заголовками (первая строка пропускается).
          Все значения должны быть строчными буквами на русском.
        </p>
        
        <div className="grid gap-3">
          {rulesTables.map(table => (
            <div key={table.id} className="flex items-center gap-3 p-3 border rounded-lg">
              <div className="flex-1">
                <div className="font-medium text-sm">{table.label}</div>
                <div className="text-[10px] text-muted-foreground">{table.count} комбинаций: {table.desc}</div>
              </div>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, table.id, table.userCol, table.currentCol)}
                  disabled={importing !== null}
                />
                <Button 
                  variant="outline" 
                  size="sm" 
                  asChild
                  disabled={importing !== null}
                >
                  <span>
                    {importing === table.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <><Upload className="h-4 w-4 mr-1" /> CSV</>
                    )}
                  </span>
                </Button>
              </label>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const initialEnergyState: NewEnergyState = {
  date: '',
  heavenly_stem: '',
  earthly_branch: '',
  is_lucky_day: false,
  is_money_activation: false,
  is_rest_day: false,
  is_money_haircut: false,
  is_solar_eclipse: false,
  is_lunar_eclipse: false,
  is_no_wealth_day: false,
  is_mercury_retrograde: false,
  daily_advice: '',
};

export const ContentManagement: React.FC = () => {
  const { query, initSchema } = useExternalDb();
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // General Forecast
  const [generalForecast, setGeneralForecast] = useState({ title: '', content: '' });
  
  // Monthly Events
  const [monthlyEvents, setMonthlyEvents] = useState<MonthlyEvent[]>([]);
  const [newEvent, setNewEvent] = useState({ date: '', emoji: '', label: '', description: '' });
  
  // Global Tasks
  const [globalTasks, setGlobalTasks] = useState<GlobalTask[]>([]);
  const [newTask, setNewTask] = useState({ text: '', date: '' });

  // Daily Energy
  const [dailyEnergyList, setDailyEnergyList] = useState<DailyEnergy[]>([]);
  const [newEnergy, setNewEnergy] = useState<NewEnergyState>(initialEnergyState);
  const [editingEnergyId, setEditingEnergyId] = useState<string | null>(null);
  const [showAllEnergy, setShowAllEnergy] = useState(false);
  const [searchDate, setSearchDate] = useState('');

  const [schemaInitLoading, setSchemaInitLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load general forecast
      const forecasts = await query<GeneralForecast>(
        `SELECT * FROM life_navigator.general_forecasts WHERE year = ${currentYear}`
      );
      if (forecasts.length > 0) {
        setGeneralForecast({
          title: forecasts[0].title || '',
          content: forecasts[0].content || '',
        });
      }

      // Load monthly events
      const events = await query<MonthlyEvent>(
        `SELECT * FROM life_navigator.monthly_events ORDER BY date`
      );
      setMonthlyEvents(events);

      // Load global tasks
      const tasks = await query<GlobalTask>(
        `SELECT * FROM life_navigator.global_tasks ORDER BY date`
      );
      setGlobalTasks(tasks);

      // Load daily energy
      const energy = await query<DailyEnergy>(
        `SELECT * FROM life_navigator.daily_energy ORDER BY date DESC LIMIT 100`
      );
      setDailyEnergyList(energy);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGeneralForecast = async () => {
    setSaving(true);
    try {
      await query(
        `INSERT INTO life_navigator.general_forecasts (year, title, content)
         VALUES (${currentYear}, '${generalForecast.title.replace(/'/g, "''")}', '${generalForecast.content.replace(/'/g, "''")}')
         ON CONFLICT (year) DO UPDATE SET
           title = EXCLUDED.title,
           content = EXCLUDED.content,
           updated_at = now()`
      );
      toast({ title: 'Сохранено', description: 'Общий прогноз обновлён' });
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось сохранить', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddEvent = async () => {
    if (!newEvent.date || !newEvent.emoji) {
      toast({ title: 'Ошибка', description: 'Укажите дату и эмодзи', variant: 'destructive' });
      return;
    }
    
    try {
      await query(
        `INSERT INTO life_navigator.monthly_events (date, emoji, label, description)
         VALUES ('${newEvent.date}', '${newEvent.emoji}', 
                 ${newEvent.label ? `'${newEvent.label.replace(/'/g, "''")}'` : 'NULL'},
                 ${newEvent.description ? `'${newEvent.description.replace(/'/g, "''")}'` : 'NULL'})`
      );
      setNewEvent({ date: '', emoji: '', label: '', description: '' });
      loadData();
      toast({ title: 'Событие добавлено' });
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось добавить', variant: 'destructive' });
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      await query(`DELETE FROM life_navigator.monthly_events WHERE id = '${id}'`);
      loadData();
      toast({ title: 'Событие удалено' });
    } catch (error) {
      toast({ title: 'Ошибка', variant: 'destructive' });
    }
  };

  const handleAddGlobalTask = async () => {
    if (!newTask.text || !newTask.date) {
      toast({ title: 'Ошибка', description: 'Заполните все поля', variant: 'destructive' });
      return;
    }
    
    try {
      await query(
        `INSERT INTO life_navigator.global_tasks (text, date)
         VALUES ('${newTask.text.replace(/'/g, "''")}', '${newTask.date}')`
      );
      setNewTask({ text: '', date: '' });
      loadData();
      toast({ title: 'Задача добавлена' });
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось добавить', variant: 'destructive' });
    }
  };

  const handleDeleteGlobalTask = async (id: string) => {
    try {
      await query(`DELETE FROM life_navigator.global_tasks WHERE id = '${id}'`);
      loadData();
      toast({ title: 'Задача удалена' });
    } catch (error) {
      toast({ title: 'Ошибка', variant: 'destructive' });
    }
  };

  const handleSaveDailyEnergy = async () => {
    if (!newEnergy.date || !newEnergy.daily_advice) {
      toast({ title: 'Ошибка', description: 'Укажите дату и совет дня', variant: 'destructive' });
      return;
    }
    
    try {
      const sqlQuery = `
        INSERT INTO life_navigator.daily_energy (
          date, heavenly_stem, earthly_branch, 
          is_lucky_day, is_money_activation, is_rest_day, is_money_haircut,
          is_solar_eclipse, is_lunar_eclipse, is_no_wealth_day, is_mercury_retrograde,
          daily_advice
        )
        VALUES (
          '${newEnergy.date}', 
          ${newEnergy.heavenly_stem ? `'${newEnergy.heavenly_stem}'` : 'NULL'},
          ${newEnergy.earthly_branch ? `'${newEnergy.earthly_branch}'` : 'NULL'},
          ${newEnergy.is_lucky_day}, 
          ${newEnergy.is_money_activation},
          ${newEnergy.is_rest_day},
          ${newEnergy.is_money_haircut},
          ${newEnergy.is_solar_eclipse},
          ${newEnergy.is_lunar_eclipse},
          ${newEnergy.is_no_wealth_day},
          ${newEnergy.is_mercury_retrograde},
          '${newEnergy.daily_advice.replace(/'/g, "''")}'
        )
        ON CONFLICT (date) DO UPDATE SET
          heavenly_stem = EXCLUDED.heavenly_stem,
          earthly_branch = EXCLUDED.earthly_branch,
          is_lucky_day = EXCLUDED.is_lucky_day,
          is_money_activation = EXCLUDED.is_money_activation,
          is_rest_day = EXCLUDED.is_rest_day,
          is_money_haircut = EXCLUDED.is_money_haircut,
          is_solar_eclipse = EXCLUDED.is_solar_eclipse,
          is_lunar_eclipse = EXCLUDED.is_lunar_eclipse,
          is_no_wealth_day = EXCLUDED.is_no_wealth_day,
          is_mercury_retrograde = EXCLUDED.is_mercury_retrograde,
          daily_advice = EXCLUDED.daily_advice
      `;
      
      await query(sqlQuery);
      setNewEnergy(initialEnergyState);
      setEditingEnergyId(null);
      loadData();
      toast({ title: editingEnergyId ? 'Энергия дня обновлена' : 'Энергия дня добавлена' });
    } catch (error) {
      console.error('Failed to save daily energy:', error);
      toast({ title: 'Ошибка', description: 'Не удалось сохранить', variant: 'destructive' });
    }
  };

  const handleInitSchema = async () => {
    setSchemaInitLoading(true);
    try {
      const result = await initSchema();
      toast({
        title: 'Схема и таблицы готовы',
        description: result.logs?.slice(-3).join(' • ') || 'Таблицы созданы/обновлены',
      });
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Не удалось инициализировать схему',
        variant: 'destructive',
      });
    } finally {
      setSchemaInitLoading(false);
    }
  };

  const handleEditDailyEnergy = (energy: DailyEnergy) => {
    setEditingEnergyId(energy.id);
    setNewEnergy({
      date: energy.date.split('T')[0],
      heavenly_stem: energy.heavenly_stem || '',
      earthly_branch: energy.earthly_branch || '',
      is_lucky_day: energy.is_lucky_day || false,
      is_money_activation: energy.is_money_activation || false,
      is_rest_day: energy.is_rest_day || false,
      is_money_haircut: energy.is_money_haircut || false,
      is_solar_eclipse: energy.is_solar_eclipse || false,
      is_lunar_eclipse: energy.is_lunar_eclipse || false,
      is_no_wealth_day: energy.is_no_wealth_day || false,
      is_mercury_retrograde: energy.is_mercury_retrograde || false,
      daily_advice: energy.daily_advice || '',
    });
  };

  const handleCancelEdit = () => {
    setEditingEnergyId(null);
    setNewEnergy(initialEnergyState);
  };

  const handleSearchByDate = async () => {
    if (!searchDate) return;
    
    // Search in local list first
    const found = dailyEnergyList.find(e => e.date.split('T')[0] === searchDate);
    if (found) {
      handleEditDailyEnergy(found);
      setShowAllEnergy(true);
      return;
    }
    
    // Query DB directly
    try {
      const results = await query<DailyEnergy>(
        `SELECT * FROM life_navigator.daily_energy WHERE date = '${searchDate}'`
      );
      if (results.length > 0) {
        handleEditDailyEnergy(results[0]);
        // Reload list so the record is visible
        await loadData();
        setShowAllEnergy(true);
      } else {
        // No record — prefill form with this date
        setEditingEnergyId(null);
        setNewEnergy({ ...initialEnergyState, date: searchDate });
        toast({ title: 'Запись не найдена', description: 'Форма заполнена для создания новой записи' });
      }
    } catch (error) {
      toast({ title: 'Ошибка поиска', variant: 'destructive' });
    }
  };

  const handleDeleteDailyEnergy = async (id: string) => {
    try {
      await query(`DELETE FROM life_navigator.daily_energy WHERE id = '${id}'`);
      loadData();
      toast({ title: 'Энергия дня удалена' });
    } catch (error) {
      toast({ title: 'Ошибка', variant: 'destructive' });
    }
  };

  const toggleEnergyFlag = (key: keyof NewEnergyState) => {
    setNewEnergy(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Get emojis for a daily energy record
  const getEnergyEmojis = (energy: DailyEnergy): string => {
    const emojis: string[] = [];
    if (energy.is_lucky_day) emojis.push('✅');
    if (energy.is_money_activation) emojis.push('💸');
    if (energy.is_rest_day) emojis.push('🛌');
    if (energy.is_money_haircut) emojis.push('✂️');
    if (energy.is_solar_eclipse) emojis.push('🌑');
    if (energy.is_lunar_eclipse) emojis.push('🌕');
    if (energy.is_no_wealth_day) emojis.push('⛔');
    if (energy.is_mercury_retrograde) emojis.push('🪐');
    return emojis.join(' ');
  };

  // Display only first 2 records unless expanded
  const displayedEnergyList = showAllEnergy ? dailyEnergyList : dailyEnergyList.slice(0, 2);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* General Forecast */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Общий прогноз на {currentYear} год</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Заголовок</Label>
            <Input
              value={generalForecast.title}
              onChange={(e) => setGeneralForecast({ ...generalForecast, title: e.target.value })}
              placeholder="Год Змеи — год трансформаций..."
            />
          </div>
          <div className="space-y-2">
            <Label>Содержание</Label>
            <RichTextEditor
              value={generalForecast.content}
              onChange={(value) => setGeneralForecast({ ...generalForecast, content: value })}
              placeholder="Подробный общий прогноз..."
              rows={10}
            />
          </div>
          <Button onClick={handleSaveGeneralForecast} disabled={saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-2" /> Сохранить</>}
          </Button>
        </CardContent>
      </Card>

      {/* Daily Energy */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {editingEnergyId ? 'Редактирование энергии дня' : 'Энергия дней (совет дня)'}
          </CardTitle>
          <div className="flex gap-2 items-center mt-2">
            <Input
              type="date"
              value={searchDate}
              onChange={(e) => setSearchDate(e.target.value)}
              className="text-sm flex-1"
              placeholder="Поиск по дате"
            />
            <Button variant="outline" size="sm" onClick={handleSearchByDate} disabled={!searchDate}>
              Найти
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Form */}
          <div className="space-y-4 p-4 border rounded-lg bg-card">
            {/* Date, Heavenly Stem, Earthly Branch in one row */}
            <div className="grid grid-cols-3 gap-2">
              <Input
                type="date"
                value={newEnergy.date}
                onChange={(e) => setNewEnergy({ ...newEnergy, date: e.target.value })}
                className="text-sm"
              />
              <Select
                value={newEnergy.heavenly_stem}
                onValueChange={(value) => setNewEnergy({ ...newEnergy, heavenly_stem: value })}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Ствол" />
                </SelectTrigger>
                <SelectContent className="z-[200] max-h-[200px]">
                  {HEAVENLY_STEMS.map((stem) => (
                    <SelectItem key={stem} value={stem}>{stem}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={newEnergy.earthly_branch}
                onValueChange={(value) => setNewEnergy({ ...newEnergy, earthly_branch: value })}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Ветвь" />
                </SelectTrigger>
                <SelectContent className="z-[200] max-h-[200px]">
                  {EARTHLY_BRANCHES.map((branch) => (
                    <SelectItem key={branch} value={branch}>{branch}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Compact emoji checkboxes */}
            <div className="flex flex-wrap gap-2">
              {ENERGY_EMOJIS.map(({ key, emoji }) => (
                <label 
                  key={key} 
                  className={`flex items-center justify-center w-10 h-10 rounded-lg border cursor-pointer transition-colors ${
                    newEnergy[key as keyof NewEnergyState] ? 'bg-primary/20 border-primary' : 'hover:bg-muted'
                  }`}
                  title={key.replace('is_', '').replace(/_/g, ' ')}
                >
                  <Checkbox
                    checked={newEnergy[key as keyof NewEnergyState] as boolean}
                    onCheckedChange={() => toggleEnergyFlag(key as keyof NewEnergyState)}
                    className="sr-only"
                  />
                  <span className="text-xl">{emoji}</span>
                </label>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Совет дня</Label>
              <RichTextEditor
                value={newEnergy.daily_advice}
                onChange={(value) => setNewEnergy({ ...newEnergy, daily_advice: value })}
                placeholder="Это время очень мощных созидательных энергий..."
                rows={4}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSaveDailyEnergy} variant="outline" className="flex-1">
                {editingEnergyId ? (
                  <><Save className="h-4 w-4 mr-2" /> Сохранить изменения</>
                ) : (
                  <><Plus className="h-4 w-4 mr-2" /> Добавить энергию дня</>
                )}
              </Button>
              {editingEnergyId && (
                <Button onClick={handleCancelEdit} variant="ghost">
                  <X className="h-4 w-4 mr-2" /> Отмена
                </Button>
              )}
            </div>
          </div>

          {/* List of daily energy records */}
          {dailyEnergyList.length > 0 && (
            <div className="border-t pt-4 space-y-2">
              {displayedEnergyList.map(energy => (
                <div 
                  key={energy.id} 
                  className={`flex items-start justify-between p-3 rounded-lg ${
                    editingEnergyId === energy.id ? 'bg-primary/10 border-2 border-primary' : 'bg-muted'
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-bold">
                        {format(new Date(energy.date), 'd MMM yyyy', { locale: ru })}
                      </span>
                      <span className="text-base">{getEnergyEmojis(energy)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{energy.daily_advice}</p>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleEditDailyEnergy(energy)}
                      className="h-8 w-8"
                    >
                      <Pencil className="h-4 w-4 text-primary" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleDeleteDailyEnergy(energy.id)}
                      className="h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}

              {/* Expand/Collapse button */}
              {dailyEnergyList.length > 2 && (
                <Button 
                  variant="ghost" 
                  onClick={() => setShowAllEnergy(!showAllEnergy)}
                  className="w-full text-muted-foreground"
                >
                  {showAllEnergy ? (
                    <><ChevronUp className="h-4 w-4 mr-2" /> Скрыть ({dailyEnergyList.length - 2} записей)</>
                  ) : (
                    <><ChevronDown className="h-4 w-4 mr-2" /> Показать ещё {dailyEnergyList.length - 2} записей</>
                  )}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Инициализация базы</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Нажмите один раз после обновлений, чтобы создать/обновить таблицы (включая 5 таблиц правил фокуса).
          </p>
          <Button onClick={handleInitSchema} disabled={schemaInitLoading} variant="outline">
            {schemaInitLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Инициализировать схему'}
          </Button>
        </CardContent>
      </Card>

      {/* CSV Import for Focus Rules */}
      <FocusRulesImport query={query} toast={toast} />
    </div>
  );
};
