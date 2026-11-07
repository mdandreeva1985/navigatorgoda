import React from 'react';
import { Home, Calendar, TrendingUp, User, Zap } from 'lucide-react';

type TabId = 'home' | 'forecast' | 'calendar' | 'analytics' | 'profile';

interface NavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const tabs = [
  { id: 'home' as TabId, icon: Home, label: 'Главная' },
  { id: 'forecast' as TabId, icon: Zap, label: 'Прогноз' },
  { id: 'calendar' as TabId, icon: Calendar, label: 'Календарь' },
  { id: 'analytics' as TabId, icon: TrendingUp, label: 'Успех' },
  { id: 'profile' as TabId, icon: User, label: 'Профиль' },
];

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => (
  <nav className="nav-bar">
    {tabs.map(tab => (
      <button 
        key={tab.id} 
        onClick={() => onTabChange(tab.id)} 
        className={`nav-item ${activeTab === tab.id ? 'nav-item-active' : 'nav-item-inactive'}`}
      >
        <tab.icon size={18} />
        <span className="text-[8px] font-bold uppercase tracking-wider leading-none">
          {tab.label}
        </span>
      </button>
    ))}
  </nav>
);

export type { TabId };
