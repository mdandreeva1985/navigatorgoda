import React, { useState, useEffect } from 'react';
import { MessageCircle, Settings, LogOut, Loader2, BookOpen, ExternalLink, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useAuth } from '@/hooks/useAuth';
import { ProfileSettings } from './ProfileSettings';

interface ProfileViewProps {
  userName: string;
  userFirstName: string;
  userLastName: string;
  userBirthDate: string;
  subscriptionUntil?: string | null;
  onUpdateProfile: (data: { first_name?: string; last_name?: string }) => Promise<void>;
}

const FONT_SIZE_KEY = 'app_font_size';

export const ProfileView: React.FC<ProfileViewProps> = ({
  userName, userFirstName, userLastName, userBirthDate, subscriptionUntil, onUpdateProfile
}) => {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const { signOut } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Apply saved font size on mount
  useEffect(() => {
    const saved = localStorage.getItem(FONT_SIZE_KEY);
    if (saved) document.documentElement.style.fontSize = `${saved}%`;
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    await signOut();
    navigate('/auth', { replace: true });
  };

  if (showSettings) {
    return (
      <ProfileSettings
        userFirstName={userFirstName}
        userLastName={userLastName}
        userBirthDate={userBirthDate}
        subscriptionUntil={subscriptionUntil}
        onUpdateProfile={onUpdateProfile}
        onClose={() => setShowSettings(false)}
      />
    );
  }

  return (
    <div className="pb-32 px-6 pt-14">
      {/* User info */}
      <div className="mb-6 text-center">
        <h2 className="text-lg font-black text-foreground tracking-tight">
          {userFirstName ? `${userFirstName} ${userLastName || ''}`.trim() : userName}
        </h2>
        {userBirthDate && (
          <p className="text-xs text-muted-foreground mt-0.5">{userBirthDate}</p>
        )}
      </div>

      {/* Main actions */}
      <div className="space-y-3">
        {/* Admin Panel */}
        {!adminLoading && isAdmin && (
          <button
            onClick={() => navigate('/admin')}
            className="card-interactive w-full flex justify-between items-center cursor-pointer bg-primary/5 border-primary/20"
          >
            <span className="text-sm font-bold text-foreground flex items-center gap-2">
              <Settings className="h-4 w-4 text-primary" />
              Админ-панель
            </span>
            <span className="text-xs font-black text-primary uppercase tracking-widest">Открыть</span>
          </button>
        )}

        {/* Navigator Instruction */}
        <a
          href="https://teletype.in/@marya_andreeva/editor/AOI5sS9S1q9"
          target="_blank"
          rel="noopener noreferrer"
          className="card-interactive w-full flex justify-between items-center cursor-pointer"
        >
          <span className="text-sm font-bold text-foreground flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            Инструкция к навигатору
          </span>
          <ExternalLink className="h-4 w-4 text-muted-foreground" />
        </a>

        {/* Buy Subscription */}
        <a
          href="https://navigator2026.lovable.app"
          target="_blank"
          rel="noopener noreferrer"
          className="card-interactive w-full flex justify-between items-center cursor-pointer bg-primary/10 border-primary/30"
        >
          <span className="text-sm font-bold text-foreground flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Купить подписку
          </span>
          <ExternalLink className="h-4 w-4 text-primary" />
        </a>

        {/* Settings */}
        <button
          onClick={() => setShowSettings(true)}
          className="card-interactive w-full flex justify-between items-center cursor-pointer"
        >
          <span className="text-sm font-bold text-foreground flex items-center gap-2">
            <Settings className="h-4 w-4 text-primary" />
            Настройки
          </span>
          <span className="text-xs font-black text-primary uppercase tracking-widest">Открыть</span>
        </button>

        {/* Logout */}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="card-interactive w-full flex justify-between items-center cursor-pointer"
        >
          <span className="text-sm font-bold text-foreground flex items-center gap-2">
            {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            Выйти
          </span>
        </button>
      </div>

      {/* Footer */}
      <div className="mt-16 text-center space-y-4">
        <div className="text-xs text-muted-foreground">
          <span>Ваш консультант </span>
          <span className="font-bold text-foreground">Мария Андреева</span>
        </div>
        <a
          href="https://t.me/marya_andreeva"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
        >
          Связаться <MessageCircle size={14} className="fill-current" />
        </a>
        <div className="flex justify-center gap-4 text-[10px] text-muted-foreground">
          <a href="#" className="hover:text-foreground transition-colors">Политика конфиденциальности</a>
          <a href="#" className="hover:text-foreground transition-colors">Пользовательское соглашение</a>
        </div>
      </div>
    </div>
  );
};
