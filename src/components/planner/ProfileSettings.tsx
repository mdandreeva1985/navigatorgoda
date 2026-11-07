import React, { useState, useEffect, useCallback } from 'react';
import { Check, Loader2, Type, X, Bell } from 'lucide-react';
import { toast } from 'sonner';

const PUSH_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/push-notifications`;
const TOKEN_KEY = 'auth_token';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)));
}

interface ProfileSettingsProps {
  userFirstName: string;
  userLastName: string;
  userBirthDate: string;
  subscriptionUntil?: string | null;
  onUpdateProfile: (data: { first_name?: string; last_name?: string }) => Promise<void>;
  onClose: () => void;
}

const FONT_SIZE_KEY = 'app_font_size';

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({
  userFirstName, userLastName, userBirthDate, subscriptionUntil, onUpdateProfile, onClose
}) => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState(userFirstName || '');
  const [lastName, setLastName] = useState(userLastName || '');
  const [nameChanged, setNameChanged] = useState(false);
  const [fontSize, setFontSize] = useState<number>(() => {
    const saved = localStorage.getItem(FONT_SIZE_KEY);
    return saved ? Number(saved) : 100;
  });
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(true);

  // Check current push subscription status
  useEffect(() => {
    (async () => {
      try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
          setPushLoading(false);
          return;
        }
        const reg = await navigator.serviceWorker.getRegistration(`${import.meta.env.BASE_URL}sw.js`);
        const sub = reg ? await (reg as any).pushManager.getSubscription() : null;
        setPushEnabled(!!sub);
      } catch {
        // ignore
      } finally {
        setPushLoading(false);
      }
    })();
  }, []);

  const handleTogglePush = useCallback(async () => {
    if (pushLoading) return;
    setPushLoading(true);
    const token = localStorage.getItem(TOKEN_KEY);

    try {
      if (pushEnabled) {
        // Unsubscribe
        const reg = await navigator.serviceWorker.getRegistration(`${import.meta.env.BASE_URL}sw.js`);
        const sub = reg ? await (reg as any).pushManager.getSubscription() : null;
        if (sub) await sub.unsubscribe();

        if (token) {
          await fetch(`${PUSH_FUNCTION_URL}?action=unsubscribe`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          });
        }
        setPushEnabled(false);
        toast.success('Уведомления отключены');
      } else {
        // Subscribe
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          toast.error('Разрешите уведомления в настройках браузера');
          setPushLoading(false);
          return;
        }

        // Register SW
        const reg = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
        await navigator.serviceWorker.ready;

        // Get VAPID public key
        const vapidRes = await fetch(`${PUSH_FUNCTION_URL}?action=get-vapid-key`);
        const { publicKey } = await vapidRes.json();

        const sub = await (reg as any).pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        });

        // Send subscription to server
        const timezoneOffset = -new Date().getTimezoneOffset();
        await fetch(`${PUSH_FUNCTION_URL}?action=subscribe`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: sub.toJSON(), timezoneOffset }),
        });

        setPushEnabled(true);
        toast.success('Уведомления включены!');
      }
    } catch (err) {
      console.error('Push toggle error:', err);
      toast.error('Не удалось изменить настройки уведомлений');
    } finally {
      setPushLoading(false);
    }
  }, [pushEnabled, pushLoading]);

  useEffect(() => {
    setFirstName(userFirstName || '');
    setLastName(userLastName || '');
  }, [userFirstName, userLastName]);

  useEffect(() => {
    setNameChanged(firstName !== (userFirstName || '') || lastName !== (userLastName || ''));
  }, [firstName, lastName, userFirstName, userLastName]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}%`;
    localStorage.setItem(FONT_SIZE_KEY, String(fontSize));
  }, [fontSize]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  const handleSaveName = async () => {
    setSaving(true);
    try {
      await onUpdateProfile({ first_name: firstName.trim(), last_name: lastName.trim() });
      toast.success('Данные сохранены');
    } catch {
      toast.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      <div className="px-6 pt-6 pb-32 max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-black text-foreground tracking-tight">Настройки</h2>
          <button
            onClick={onClose}
            className="p-2 bg-muted rounded-full text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Personal data */}
        <div className="mb-8">
          <h3 className="text-sm font-black text-muted-foreground uppercase tracking-widest mb-3">Личные данные</h3>
          <div className="space-y-3">
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1">Фамилия</label>
              <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Фамилия" className="input-soft" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1">Имя</label>
              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Имя" className="input-soft" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1">Дата рождения</label>
              <div className="card-soft">
                <span className="text-sm font-bold text-foreground">{userBirthDate || 'Не указана'}</span>
              </div>
            </div>
            {nameChanged && (
              <button onClick={handleSaveName} disabled={saving} className="w-full py-3 bg-primary text-primary-foreground rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all shadow-elevated flex items-center justify-center gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Сохранить
              </button>
            )}
          </div>
        </div>

        {/* Appearance & preferences */}
        <div className="mb-8">
          <h3 className="text-sm font-black text-muted-foreground uppercase tracking-widest mb-3">Оформление</h3>
          <div className="space-y-3">
            <button onClick={toggleTheme} className="card-interactive w-full flex justify-between items-center cursor-pointer">
              <span className="text-sm font-bold text-foreground">Выбор темы</span>
              <span className="text-xs font-black text-primary uppercase tracking-widest">{theme === 'light' ? 'Светлая' : 'Тёмная'}</span>
            </button>

            <div className="card-soft space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Type className="h-4 w-4 text-primary" />
                  Размер шрифта
                </span>
                <span className="text-xs font-black text-primary uppercase tracking-widest">{fontSize}%</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-muted-foreground font-bold">A</span>
                <input type="range" min={80} max={130} step={5} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="flex-1 accent-primary h-1.5" />
                <span className="text-base text-muted-foreground font-bold">A</span>
              </div>
            </div>

            {!('serviceWorker' in navigator) || !('PushManager' in window) ? (
              <div className="card-soft w-full">
                <span className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  Уведомления
                </span>
                <p className="text-xs text-muted-foreground mt-1">
                  Ваш браузер не поддерживает push-уведомления. На iPhone добавьте приложение на домашний экран (Поделиться → На экран «Домой»), затем откройте его оттуда.
                </p>
              </div>
            ) : (
              <div
                role="button"
                tabIndex={0}
                onClick={handleTogglePush}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTogglePush(); } }}
                className="card-soft w-full flex justify-between items-center cursor-pointer select-none active:opacity-70 transition-opacity"
              >
                <span className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Bell className="h-4 w-4 text-primary" />
                  Уведомления
                </span>
                {pushLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <div className={`w-11 h-6 rounded-full flex items-center px-0.5 transition-colors duration-200 ${pushEnabled ? 'bg-primary' : 'bg-muted'}`}>
                    <div className={`w-5 h-5 bg-card rounded-full shadow-md transition-transform duration-200 ${pushEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                )}
              </div>
            )}

            <div className="card-soft flex justify-between items-center">
              <span className="text-sm font-bold text-foreground">Ваша подписка до</span>
              <span className="text-xs font-black text-primary uppercase tracking-widest">
                {subscriptionUntil
                  ? new Date(subscriptionUntil).toLocaleDateString('ru', { day: '2-digit', month: '2-digit', year: 'numeric' })
                  : 'Не указана'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
