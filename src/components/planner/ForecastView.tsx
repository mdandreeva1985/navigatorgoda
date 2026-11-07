import React, { useState, useEffect } from "react";
import { ChevronLeft, X, Edit3 } from "lucide-react";
import yearEnergyImage from "@/assets/year-energy-2026.webp";
import yearStrategyImage from "@/assets/year-strategy-2026.webp";
import { RichTextDisplay } from "@/components/ui/rich-text-editor";
import type { DbGeneralForecast, DbIndividualForecast } from "@/hooks/useUserData";

interface ForecastViewProps {
  yearGoal: string;
  setYearGoal: (goal: string) => Promise<void>;
  monthGoals: Record<number, string>;
  saveMonthGoal: (monthIndex: number, goal: string) => Promise<void>;
  generalForecast: DbGeneralForecast | null;
  individualForecasts: DbIndividualForecast[];
}

interface MonthData {
  name: string;
  monthIndex: number; // 0-11 for calendar mapping (0 = Jan)
  dbMonth: number; // 1-12 for database (1 = Jan)
}

// Months starting from February, ending with January (Chinese calendar order)
const monthsData: MonthData[] = [
  { name: "Февраль", monthIndex: 1, dbMonth: 2 },
  { name: "Март", monthIndex: 2, dbMonth: 3 },
  { name: "Апрель", monthIndex: 3, dbMonth: 4 },
  { name: "Май", monthIndex: 4, dbMonth: 5 },
  { name: "Июнь", monthIndex: 5, dbMonth: 6 },
  { name: "Июль", monthIndex: 6, dbMonth: 7 },
  { name: "Август", monthIndex: 7, dbMonth: 8 },
  { name: "Сентябрь", monthIndex: 8, dbMonth: 9 },
  { name: "Октябрь", monthIndex: 9, dbMonth: 10 },
  { name: "Ноябрь", monthIndex: 10, dbMonth: 11 },
  { name: "Декабрь", monthIndex: 11, dbMonth: 12 },
  { name: "Январь", monthIndex: 0, dbMonth: 1 },
];

// Full-screen page component for forecasts
interface ForecastPageProps {
  title: string;
  content: string;
  onBack: () => void;
}

const ForecastPage: React.FC<ForecastPageProps> = ({ title, content, onBack }) => {
  // Handle browser back button
  useEffect(() => {
    window.history.pushState({ forecastPage: true }, "");

    const handlePopState = () => {
      onBack();
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [onBack]);

  return (
    <div className="fixed inset-0 bg-background z-[250] overflow-y-auto animate-in slide-in-from-right duration-300">
      <div className="max-w-md mx-auto">
        <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 px-6 py-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft size={18} />
            назад
          </button>
        </div>
        <div className="px-6 pb-10">
          <h1 className="text-xl font-black text-foreground mb-6">{title}</h1>
          <RichTextDisplay content={content} className="text-sm text-foreground/80" />
        </div>
      </div>
    </div>
  );
};

export const ForecastView: React.FC<ForecastViewProps> = ({ 
  yearGoal, 
  setYearGoal, 
  monthGoals, 
  saveMonthGoal,
  generalForecast,
  individualForecasts
}) => {
  const [showYearPage, setShowYearPage] = useState(false);
  const [showStrategyPage, setShowStrategyPage] = useState(false);
  const [showMonthModal, setShowMonthModal] = useState<number | null>(null);
  const [isEditingYearGoal, setIsEditingYearGoal] = useState(false);
  const [tempYearGoal, setTempYearGoal] = useState(yearGoal);
  const [tempMonthGoal, setTempMonthGoal] = useState("");

  // Sync tempYearGoal when yearGoal changes from DB
  useEffect(() => {
    setTempYearGoal(yearGoal);
  }, [yearGoal]);

  const currentYear = new Date().getFullYear();

  // Get individual year forecast (strategy) from admin
  const getIndividualYearForecast = () => {
    return individualForecasts.find(f => f.type === 'year' && f.year === currentYear && f.month === null);
  };

  // Get monthly forecast from admin
  const getMonthForecast = (dbMonth: number) => {
    return individualForecasts.find(f => f.type === 'month' && f.year === currentYear && f.month === dbMonth);
  };

  useEffect(() => {
    if (showMonthModal !== null) {
      const month = monthsData[showMonthModal];
      setTempMonthGoal(monthGoals[month.monthIndex] || "");
    }
  }, [showMonthModal, monthGoals]);

  const handleSaveYearGoal = async () => {
    await setYearGoal(tempYearGoal);
    setIsEditingYearGoal(false);
  };

  const handleSaveMonthGoal = async () => {
    if (showMonthModal !== null) {
      const monthIndex = monthsData[showMonthModal].monthIndex;
      await saveMonthGoal(monthIndex, tempMonthGoal);
      setShowMonthModal(null);
    }
  };

  const individualYearForecast = getIndividualYearForecast();
  const generalForecastContent = generalForecast?.content || '';
  const individualForecastContent = individualYearForecast?.content || '';

  return (
    <div className="pb-32 px-6 pt-10 animate-fade-in">
      <h1 className="text-2xl font-black text-foreground mb-1 tracking-tight">Прогноз</h1>
      <p className="text-xs text-muted-foreground mb-6">Ваша навигация на {currentYear} год</p>

      <div className="space-y-4">
        {/* Blocks 1 & 2 - Side by side 1:1 */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setShowYearPage(true)}
            className="aspect-square rounded-[20px] overflow-hidden bg-muted transition-all active:scale-[0.98] shadow-md hover:shadow-lg"
          >
            <img 
              src={yearEnergyImage} 
              alt="Энергия года" 
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
            />
          </button>

          <button
            onClick={() => setShowStrategyPage(true)}
            className="aspect-square rounded-[20px] overflow-hidden bg-muted transition-all active:scale-[0.98] shadow-md hover:shadow-lg"
          >
            <img 
              src={yearStrategyImage} 
              alt="Ваша стратегия" 
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
            />
          </button>
        </div>

        {/* Year Goal Input - User writes their own goal */}
        <div className={`card-soft p-5 transition-all ${yearGoal.trim() ? "bg-primary text-primary-foreground" : ""}`}>
          <div className={`text-sm font-bold mb-3 ${yearGoal.trim() ? "text-primary-foreground" : "text-foreground"}`}>
            Моя главная цель на {currentYear}
          </div>

          {isEditingYearGoal ? (
            <div className="space-y-3">
              <textarea
                value={tempYearGoal}
                onChange={(e) => setTempYearGoal(e.target.value)}
                className="input-soft min-h-[80px] resize-none bg-primary/10 text-foreground placeholder:text-muted-foreground"
                placeholder="Опишите вашу главную цель..."
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveYearGoal}
                  className="flex-1 py-2.5 bg-foreground text-background rounded-xl font-bold text-xs uppercase tracking-wider active:scale-95 transition-all"
                >
                  Сохранить
                </button>
                <button
                  onClick={() => {
                    setIsEditingYearGoal(false);
                    setTempYearGoal(yearGoal);
                  }}
                  className="py-2.5 px-4 bg-background text-foreground rounded-xl font-bold text-xs uppercase tracking-wider active:scale-95 transition-all"
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <div>
              {yearGoal.trim() ? (
                <>
                  <div className="p-4 rounded-2xl mb-2 min-h-[50px] bg-primary-foreground/20">
                    <p className="text-sm leading-relaxed text-primary-foreground font-medium">{yearGoal}</p>
                  </div>
                  <button
                    onClick={() => {
                      setIsEditingYearGoal(true);
                      setTempYearGoal(yearGoal);
                    }}
                    className="flex items-center gap-1 ml-auto text-[10px] text-primary-foreground/70 hover:text-primary-foreground font-medium transition-colors"
                  >
                    <Edit3 size={12} />
                    Изменить
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setIsEditingYearGoal(true);
                    setTempYearGoal("");
                  }}
                  className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold text-xs uppercase tracking-wider active:scale-95 transition-all"
                >
                  + Добавить цель
                </button>
              )}
            </div>
          )}
        </div>

        {/* Monthly Tactics Grid - 3 columns x 4 rows */}
        <div>
          <h3 className="font-bold text-foreground mb-3 text-sm">Тактика по месяцам</h3>

          <div className="grid grid-cols-3 gap-2">
            {monthsData.map((month, index) => {
              const hasGoal = !!monthGoals[month.monthIndex]?.trim();
              const forecast = getMonthForecast(month.dbMonth);
              
                return (
                <button
                  key={month.name}
                  onClick={() => setShowMonthModal(index)}
                  className="p-2.5 rounded-xl text-left transition-all bg-card shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
                >
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-bold text-foreground">{month.name}</span>
                    {hasGoal && <span className="text-[10px]">🎯</span>}
                  </div>
                  {forecast?.title && (
                    <div className="text-[8px] mt-0.5 leading-snug text-muted-foreground break-words">
                      {forecast.title}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Year Forecast Page - General forecast from admin */}
      {showYearPage && (
        <ForecastPage 
          title={generalForecast?.title || `Прогноз на ${currentYear} год`}
          content={generalForecastContent || ''} 
          onBack={() => setShowYearPage(false)} 
        />
      )}

      {/* Strategy Page - Individual forecast from admin */}
      {showStrategyPage && (
        individualForecastContent ? (
          <ForecastPage
            title={individualYearForecast?.title || "Ваша личная стратегия"}
            content={individualForecastContent}
            onBack={() => setShowStrategyPage(false)}
          />
        ) : (
          <div className="fixed inset-0 bg-background z-[250] overflow-y-auto animate-in slide-in-from-right duration-300">
            <div className="max-w-md mx-auto">
              <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 px-6 py-4">
                <button
                  onClick={() => setShowStrategyPage(false)}
                  className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronLeft size={18} />
                  назад
                </button>
              </div>
              <div className="px-6 pb-10">
                <h1 className="text-xl font-black text-foreground mb-6">Ваша личная стратегия</h1>
                <p className="text-sm text-muted-foreground/70 italic">
                  Индивидуальный прогноз доступен при подписке на год
                </p>
              </div>
            </div>
          </div>
        )
      )}

      {/* Month Modal */}
      {showMonthModal !== null && (
        <div className="modal-overlay" onClick={() => setShowMonthModal(null)}>
          <div className="modal-content max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-black text-foreground">{monthsData[showMonthModal].name}</h3>
                {getMonthForecast(monthsData[showMonthModal].dbMonth)?.title && (
                  <span className="text-xs text-muted-foreground">
                    {getMonthForecast(monthsData[showMonthModal].dbMonth)?.title}
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowMonthModal(null)}
                className="p-2 bg-muted rounded-full text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Admin's forecast content - show placeholder if empty */}
            <div className="mb-6">
              {getMonthForecast(monthsData[showMonthModal].dbMonth)?.content ? (
                <RichTextDisplay 
                  content={getMonthForecast(monthsData[showMonthModal].dbMonth)?.content || ''} 
                  className="text-sm text-foreground/80"
                />
              ) : (
                <p className="text-xs text-muted-foreground/70 italic">
                  Прогноз на этот месяц еще не добавлен, доступен при подписке на месяц/год
                </p>
              )}
            </div>

            {/* User's goal input */}
            <div className="space-y-3 border-t pt-4">
              <label className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.15em]">
                Моя цель на {monthsData[showMonthModal].name.toLowerCase()}
              </label>
              <textarea
                value={tempMonthGoal}
                onChange={(e) => setTempMonthGoal(e.target.value)}
                className="input-soft min-h-[80px] resize-none"
                placeholder="Что вы хотите достичь в этом месяце?"
              />
              <button
                onClick={handleSaveMonthGoal}
                className="w-full py-3 bg-primary text-primary-foreground rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all shadow-elevated"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
