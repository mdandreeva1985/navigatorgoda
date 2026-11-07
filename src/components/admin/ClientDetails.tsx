import React, { useState, useEffect } from 'react';
import { ClientProfile, useClients, BaziChart, IndividualForecast, UserHint } from '@/hooks/useClients';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Loader2, Save, User, Star, FileText, Calendar, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { BaziChartEditor } from './BaziChartEditor';
import { MonthlyForecasts } from './MonthlyForecasts';
import { ClientCalendar } from './ClientCalendar';

interface ClientDetailsProps {
  client: ClientProfile;
  onBack: () => void;
  onUpdated: () => void;
}

// Helper to format date from ISO to YYYY-MM-DD for input[type="date"]
const formatDateForInput = (dateStr: string | null): string => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  } catch {
    return '';
  }
};

export const ClientDetails: React.FC<ClientDetailsProps> = ({
  client,
  onBack,
  onUpdated,
}) => {
  const { updateClient, getBaziChart, saveBaziChart, getForecasts, saveForecast, getHint, saveHint, loading } = useClients();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    first_name: client.first_name || '',
    last_name: client.last_name || '',
    birth_date: formatDateForInput(client.birth_date),
    birth_time: client.birth_time || '',
    subscription_until: formatDateForInput(client.subscription_until),
  });
  
  const [baziChart, setBaziChart] = useState<BaziChart | null>(null);
  const [forecasts, setForecasts] = useState<IndividualForecast[]>([]);
  const [yearForecast, setYearForecast] = useState({ title: '', content: '' });
  const [hint, setHint] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadClientData();
  }, [client.id]);

  const loadClientData = async () => {
    const [chart, forecastsList, hintData] = await Promise.all([
      getBaziChart(client.id),
      getForecasts(client.id),
      getHint(client.id),
    ]);
    
    setBaziChart(chart);
    setForecasts(forecastsList);
    setHint(hintData?.hint_text || '');
    
    const yearFc = forecastsList.find(f => f.type === 'year' && f.year === new Date().getFullYear());
    if (yearFc) {
      setYearForecast({ title: yearFc.title || '', content: yearFc.content || '' });
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    const result = await updateClient(client.id, formData);
    setSaving(false);
    
    if (result) {
      toast({ title: 'Сохранено', description: 'Данные клиента обновлены' });
      onUpdated();
    } else {
      toast({ title: 'Ошибка', description: 'Не удалось сохранить', variant: 'destructive' });
    }
  };

  const handleSaveBazi = async (chart: Partial<BaziChart>) => {
    const result = await saveBaziChart(client.id, chart);
    if (result) {
      setBaziChart(result);
      toast({ title: 'Сохранено', description: 'Карта Ба Цзы обновлена' });
    }
  };

  const handleSaveYearForecast = async () => {
    setSaving(true);
    const result = await saveForecast(client.id, {
      type: 'year',
      year: new Date().getFullYear(),
      month: null,
      title: yearForecast.title,
      content: yearForecast.content,
    });
    setSaving(false);
    
    if (result) {
      toast({ title: 'Сохранено', description: 'Прогноз на год обновлён' });
      loadClientData();
    }
  };

  const handleSaveHint = async () => {
    setSaving(true);
    const result = await saveHint(client.id, hint);
    setSaving(false);
    
    if (result) {
      toast({ title: 'Сохранено', description: 'Подсказка обновлена' });
    }
  };

  return (
    <Tabs defaultValue="profile" className="w-full">
      <TabsList className="grid w-full grid-cols-5 mb-6">
        <TabsTrigger value="profile" className="text-xs">
          <User className="h-4 w-4 md:mr-1" />
          <span className="hidden md:inline">Профиль</span>
        </TabsTrigger>
        <TabsTrigger value="bazi" className="text-xs">
          <Star className="h-4 w-4 md:mr-1" />
          <span className="hidden md:inline">Ба Цзы</span>
        </TabsTrigger>
        <TabsTrigger value="forecast" className="text-xs">
          <FileText className="h-4 w-4 md:mr-1" />
          <span className="hidden md:inline">Прогноз</span>
        </TabsTrigger>
        <TabsTrigger value="calendar" className="text-xs">
          <Calendar className="h-4 w-4 md:mr-1" />
          <span className="hidden md:inline">Календарь</span>
        </TabsTrigger>
        <TabsTrigger value="hint" className="text-xs">
          <MessageSquare className="h-4 w-4 md:mr-1" />
          <span className="hidden md:inline">Подсказка</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="profile">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Личные данные</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={client.email} disabled className="bg-muted" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Имя</Label>
                <Input
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Фамилия</Label>
                <Input
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Дата рождения</Label>
                <Input
                  type="date"
                  value={formData.birth_date}
                  onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Время рождения</Label>
                <Input
                  type="time"
                  value={formData.birth_time}
                  onChange={(e) => setFormData({ ...formData, birth_time: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Подписка до</Label>
              <Input
                type="date"
                value={formData.subscription_until}
                onChange={(e) => setFormData({ ...formData, subscription_until: e.target.value })}
              />
            </div>
            <Button onClick={handleSaveProfile} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-2" /> Сохранить</>}
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="bazi">
        <BaziChartEditor
          chart={baziChart}
          birthDate={formData.birth_date}
          birthTime={formData.birth_time}
          onSave={handleSaveBazi}
        />
      </TabsContent>

      <TabsContent value="forecast">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Прогноз на {new Date().getFullYear()} год</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Заголовок</Label>
                <Input
                  value={yearForecast.title}
                  onChange={(e) => setYearForecast({ ...yearForecast, title: e.target.value })}
                  placeholder="Год успеха и новых возможностей..."
                />
              </div>
              <div className="space-y-2">
                <Label>Содержание</Label>
                <RichTextEditor
                  value={yearForecast.content}
                  onChange={(value) => setYearForecast({ ...yearForecast, content: value })}
                  placeholder="Подробный прогноз на год..."
                  rows={10}
                />
              </div>
              <Button onClick={handleSaveYearForecast} disabled={saving} className="w-full">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-2" /> Сохранить</>}
              </Button>
            </CardContent>
          </Card>

          <MonthlyForecasts
            clientId={client.id}
            forecasts={forecasts.filter(f => f.type === 'month')}
            onSaved={loadClientData}
          />
        </div>
      </TabsContent>

      <TabsContent value="calendar">
        <ClientCalendar clientId={client.id} />
      </TabsContent>

      <TabsContent value="hint">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Подсказка для клиента</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="Персональная подсказка, которую клиент увидит в календаре..."
              rows={6}
            />
            <Button onClick={handleSaveHint} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-2" /> Сохранить</>}
            </Button>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};
