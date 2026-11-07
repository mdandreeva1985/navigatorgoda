import React, { useState } from 'react';
import { IndividualForecast, useClients } from '@/hooks/useClients';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Save, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MonthlyForecastsProps {
  clientId: string;
  forecasts: IndividualForecast[];
  onSaved: () => void;
}

const MONTHS = [
  { value: 2, label: 'Фев' },
  { value: 3, label: 'Мар' },
  { value: 4, label: 'Апр' },
  { value: 5, label: 'Май' },
  { value: 6, label: 'Июн' },
  { value: 7, label: 'Июл' },
  { value: 8, label: 'Авг' },
  { value: 9, label: 'Сен' },
  { value: 10, label: 'Окт' },
  { value: 11, label: 'Ноя' },
  { value: 12, label: 'Дек' },
  { value: 1, label: 'Янв' },
];

export const MonthlyForecasts: React.FC<MonthlyForecastsProps> = ({
  clientId,
  forecasts,
  onSaved,
}) => {
  const { saveForecast } = useClients();
  const { toast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [formData, setFormData] = useState({ title: '', content: '' });
  const [saving, setSaving] = useState(false);
  const currentYear = new Date().getFullYear();

  const getForecastForMonth = (month: number) => {
    return forecasts.find(f => f.month === month && f.year === currentYear);
  };

  const handleOpenMonth = (month: number) => {
    const existing = getForecastForMonth(month);
    setFormData({
      title: existing?.title || '',
      content: existing?.content || '',
    });
    setSelectedMonth(month);
  };

  const handleSave = async () => {
    if (selectedMonth === null) return;
    
    setSaving(true);
    const result = await saveForecast(clientId, {
      type: 'month',
      year: currentYear,
      month: selectedMonth,
      title: formData.title,
      content: formData.content,
    });
    setSaving(false);

    if (result) {
      toast({ title: 'Сохранено', description: 'Прогноз на месяц обновлён' });
      setSelectedMonth(null);
      onSaved();
    } else {
      toast({ title: 'Ошибка', description: 'Не удалось сохранить', variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Прогнозы по месяцам</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-2">
          {MONTHS.map(({ value, label }) => {
            const forecast = getForecastForMonth(value);
            const hasContent = !!forecast?.content;
            
            return (
              <Dialog key={value} open={selectedMonth === value} onOpenChange={(open) => {
                if (open) handleOpenMonth(value);
                else setSelectedMonth(null);
              }}>
                <DialogTrigger asChild>
                  <Button
                    variant={hasContent ? 'default' : 'outline'}
                    className="h-12 relative"
                  >
                    {label}
                    {hasContent && (
                      <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-xs">
                        🎯
                      </Badge>
                    )}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Прогноз: {label} {currentYear}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Заголовок</Label>
                      <Input
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="Тема месяца..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Содержание</Label>
                      <RichTextEditor
                        value={formData.content}
                        onChange={(value) => setFormData({ ...formData, content: value })}
                        placeholder="Подробный прогноз на месяц..."
                        rows={8}
                      />
                    </div>
                    <Button onClick={handleSave} disabled={saving} className="w-full">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-2" /> Сохранить</>}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
