import React, { useState, useEffect } from 'react';
import { BaziChart } from '@/hooks/useClients';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface BaziChartEditorProps {
  chart: BaziChart | null;
  birthDate: string;
  birthTime: string;
  onSave: (chart: Partial<BaziChart>) => void;
}

const HEAVENLY_STEMS = [
  { value: 'дерево ян', label: 'дерево ян' },
  { value: 'дерево инь', label: 'дерево инь' },
  { value: 'огонь ян', label: 'огонь ян' },
  { value: 'огонь инь', label: 'огонь инь' },
  { value: 'земля ян', label: 'земля ян' },
  { value: 'земля инь', label: 'земля инь' },
  { value: 'металл ян', label: 'металл ян' },
  { value: 'металл инь', label: 'металл инь' },
  { value: 'вода ян', label: 'вода ян' },
  { value: 'вода инь', label: 'вода инь' },
];

const EARTHLY_BRANCHES = [
  { value: 'крыса', label: 'крыса' },
  { value: 'бык', label: 'бык' },
  { value: 'тигр', label: 'тигр' },
  { value: 'кролик', label: 'кролик' },
  { value: 'дракон', label: 'дракон' },
  { value: 'змея', label: 'змея' },
  { value: 'лошадь', label: 'лошадь' },
  { value: 'коза', label: 'коза' },
  { value: 'обезьяна', label: 'обезьяна' },
  { value: 'петух', label: 'петух' },
  { value: 'собака', label: 'собака' },
  { value: 'свинья', label: 'свинья' },
];

export const BaziChartEditor: React.FC<BaziChartEditorProps> = ({
  chart,
  onSave,
}) => {
  const [formData, setFormData] = useState({
    year_stem: chart?.year_stem || '',
    year_branch: chart?.year_branch || '',
    month_stem: chart?.month_stem || '',
    month_branch: chart?.month_branch || '',
    day_stem: chart?.day_stem || '',
    day_branch: chart?.day_branch || '',
    hour_stem: chart?.hour_stem || '',
    hour_branch: chart?.hour_branch || '',
    is_auto_calculated: false,
  });

  useEffect(() => {
    if (chart) {
      setFormData({
        year_stem: chart.year_stem || '',
        year_branch: chart.year_branch || '',
        month_stem: chart.month_stem || '',
        month_branch: chart.month_branch || '',
        day_stem: chart.day_stem || '',
        day_branch: chart.day_branch || '',
        hour_stem: chart.hour_stem || '',
        hour_branch: chart.hour_branch || '',
        is_auto_calculated: false,
      });
    }
  }, [chart]);

  const handleSave = () => {
    onSave(formData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Карта Ба Цзы</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-4 mb-6">
          {/* Hour Pillar */}
          <div className="space-y-2">
            <Label className="text-center block text-xs text-muted-foreground">Час</Label>
            <div className="space-y-2">
              <Select
                value={formData.hour_stem}
                onValueChange={(value) => setFormData({ ...formData, hour_stem: value })}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="ствол" />
                </SelectTrigger>
                <SelectContent className="z-[100] max-h-60">
                  {HEAVENLY_STEMS.map((stem) => (
                    <SelectItem key={stem.value} value={stem.value}>
                      {stem.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={formData.hour_branch}
                onValueChange={(value) => setFormData({ ...formData, hour_branch: value })}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="ветвь" />
                </SelectTrigger>
                <SelectContent className="z-[100] max-h-60">
                  {EARTHLY_BRANCHES.map((branch) => (
                    <SelectItem key={branch.value} value={branch.value}>
                      {branch.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Day Pillar */}
          <div className="space-y-2">
            <Label className="text-center block text-xs text-muted-foreground">День</Label>
            <div className="space-y-2">
              <Select
                value={formData.day_stem}
                onValueChange={(value) => setFormData({ ...formData, day_stem: value })}
              >
                <SelectTrigger className="text-sm bg-primary/5 border-primary">
                  <SelectValue placeholder="ствол" />
                </SelectTrigger>
                <SelectContent className="z-[100] max-h-60">
                  {HEAVENLY_STEMS.map((stem) => (
                    <SelectItem key={stem.value} value={stem.value}>
                      {stem.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={formData.day_branch}
                onValueChange={(value) => setFormData({ ...formData, day_branch: value })}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="ветвь" />
                </SelectTrigger>
                <SelectContent className="z-[100] max-h-60">
                  {EARTHLY_BRANCHES.map((branch) => (
                    <SelectItem key={branch.value} value={branch.value}>
                      {branch.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Month Pillar */}
          <div className="space-y-2">
            <Label className="text-center block text-xs text-muted-foreground">Месяц</Label>
            <div className="space-y-2">
              <Select
                value={formData.month_stem}
                onValueChange={(value) => setFormData({ ...formData, month_stem: value })}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="ствол" />
                </SelectTrigger>
                <SelectContent className="z-[100] max-h-60">
                  {HEAVENLY_STEMS.map((stem) => (
                    <SelectItem key={stem.value} value={stem.value}>
                      {stem.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={formData.month_branch}
                onValueChange={(value) => setFormData({ ...formData, month_branch: value })}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="ветвь" />
                </SelectTrigger>
                <SelectContent className="z-[100] max-h-60">
                  {EARTHLY_BRANCHES.map((branch) => (
                    <SelectItem key={branch.value} value={branch.value}>
                      {branch.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Year Pillar */}
          <div className="space-y-2">
            <Label className="text-center block text-xs text-muted-foreground">Год</Label>
            <div className="space-y-2">
              <Select
                value={formData.year_stem}
                onValueChange={(value) => setFormData({ ...formData, year_stem: value })}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="ствол" />
                </SelectTrigger>
                <SelectContent className="z-[100] max-h-60">
                  {HEAVENLY_STEMS.map((stem) => (
                    <SelectItem key={stem.value} value={stem.value}>
                      {stem.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={formData.year_branch}
                onValueChange={(value) => setFormData({ ...formData, year_branch: value })}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="ветвь" />
                </SelectTrigger>
                <SelectContent className="z-[100] max-h-60">
                  {EARTHLY_BRANCHES.map((branch) => (
                    <SelectItem key={branch.value} value={branch.value}>
                      {branch.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Button onClick={handleSave} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          Сохранить карту
        </Button>
      </CardContent>
    </Card>
  );
};
