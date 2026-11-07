import React from 'react';
import { Modal } from './Modal';
import { ScrollArea } from '@/components/ui/scroll-area';

interface EmojiGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EmojiGuideModal: React.FC<EmojiGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <Modal title="Гид по эмодзи" onClose={onClose}>
      <ScrollArea className="h-[60vh] pr-2">
        <div className="space-y-4">
          {/* Активные действия */}
          <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 p-4 space-y-3">
            <h3 className="text-sm font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">Активные действия</h3>
            
            <div className="flex items-start gap-3">
              <span className="text-2xl">✅</span>
              <p className="text-sm text-foreground"><strong>Удачные дни</strong> — твой «зеленый свет» для рывка в делах и масштабных продаж.</p>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="text-2xl">🙌</span>
              <p className="text-sm text-foreground"><strong>Дни благородного человека</strong> — мир готов тебе помогать. Просто озвучь свою просьбу — люди тебя поддержат.</p>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="text-2xl">🏆</span>
              <p className="text-sm text-foreground"><strong>Дни смелости</strong> — время для инноваций, агрессивного продвижения и захвата новых территорий. Будь решительной!</p>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="text-2xl">🚀</span>
              <p className="text-sm text-foreground"><strong>Время движения</strong> — удачный момент для поездок, командировок и смены обстановки. Будь мобильной</p>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="text-2xl">🤝</span>
              <p className="text-sm text-foreground"><strong>Нетворкинг</strong> — день для расширения связей, общения и роста твоих социальных сетей.</p>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="text-2xl">🎨</span>
              <p className="text-sm text-foreground"><strong>Дни креатива</strong> — твой выход на сцену: создавай контент, развивай личный бренд и проявляй творчество.</p>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="text-2xl">💡</span>
              <p className="text-sm text-foreground"><strong>День интеллекта</strong> — твой мозг работает на максимум: обучение и усвоение новой информации проходят легко. Покажи свои таланты миру.</p>
            </div>
          </div>

          {/* Финансы */}
          <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/30 p-4 space-y-3">
            <h3 className="text-sm font-black text-amber-700 dark:text-amber-400 uppercase tracking-wide">Финансы</h3>
            
            <div className="flex items-start gap-3">
              <span className="text-2xl">💰</span>
              <p className="text-sm text-foreground"><strong>Инвестиции</strong> — идеальный момент для покупки акций, вложений и запуска новых прибыльных проектов.</p>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="text-2xl">💵</span>
              <p className="text-sm text-foreground"><strong>Работа и заработок</strong> — время для стабильного дохода, решения карьерных вопросов и премий.</p>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="text-2xl">💸</span>
              <p className="text-sm text-foreground"><strong>Активация денег</strong> — запуск энергии богатства через ритуалы и обязательные действия (пост, звонок клиенту).</p>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="text-2xl">🛍️</span>
              <p className="text-sm text-foreground"><strong>Дни покупок</strong> — «грабитель богатства» активен. Потрать деньги на себя, чтобы не потерять их впустую</p>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="text-2xl">✂️</span>
              <p className="text-sm text-foreground"><strong>Денежная стрижка</strong> — маленький ритуал для активации твоего финансового потока.</p>
            </div>
          </div>

          {/* Забота и мудрость */}
          <div className="rounded-2xl bg-violet-50 dark:bg-violet-950/30 p-4 space-y-3">
            <h3 className="text-sm font-black text-violet-700 dark:text-violet-400 uppercase tracking-wide">Забота и мудрость</h3>
            
            <div className="flex items-start gap-3">
              <span className="text-2xl">📝</span>
              <p className="text-sm text-foreground"><strong>Планирование</strong> — наведи порядок в целях, проверь планы и пропиши стратегию. Время дисциплины</p>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="text-2xl">🧘‍♀️</span>
              <p className="text-sm text-foreground"><strong>Дни практик</strong> — время тишины, развития интуиции, медитаций и общения с наставниками.</p>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="text-2xl">❤️</span>
              <p className="text-sm text-foreground"><strong>Забота о себе</strong> — забота о теле, поход к косметологу и восполнение твоей внутренней энергии.</p>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="text-2xl">🛌</span>
              <p className="text-sm text-foreground"><strong>Дни отдыха</strong> — полная перезагрузка. Замедлись и восстанови силы, не планируй важных дел.</p>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="text-2xl">👩‍⚕️</span>
              <p className="text-sm text-foreground"><strong>Дни доктора</strong> — займись здоровьем: лучшее время для визита к врачу, обследований и начала лечения</p>
            </div>
          </div>

          {/* Осторожность и контроль */}
          <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/30 p-4 space-y-3">
            <h3 className="text-sm font-black text-rose-700 dark:text-rose-400 uppercase tracking-wide">Осторожность и контроль</h3>
            
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚖️</span>
              <p className="text-sm text-foreground"><strong>Дни кризиса</strong> — время внимательности к документам и налоговым проверкам. Наводи порядок в делах.</p>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="text-2xl">🌑🌕</span>
              <p className="text-sm text-foreground"><strong>Затмения (Солнечное и Лунное)</strong> — время стоп. Исключи важные старты, очищай пространство и будь дома.</p>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="text-2xl">⛔</span>
              <p className="text-sm text-foreground"><strong>Дни без богатства</strong> — пауза в финансовых делах. Не подписывай важные контракты сегодня.</p>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="text-2xl">🪐</span>
              <p className="text-sm text-foreground"><strong>Ретроградный Меркурий</strong> — проверяй документы, не покупай технику и завершай старые дела.</p>
            </div>
          </div>
        </div>
      </ScrollArea>
    </Modal>
  );
};
