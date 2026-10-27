import React, { useState, useEffect, useMemo } from "react";
import {
  Clock,
  Hourglass,
  Sparkles,
  Trophy,
  Plus,
  Play,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  PartyPopper,
  Edit2,
  ChevronDown,
  ChevronUp,
  Flame,
} from "lucide-react";
import { sounds } from "../utils/soundEffects";
import { meetingStore } from "../utils/meetingStore";
import type { SystemUser } from "../utils/authStore";

interface MeetingCountdownTimerProps {
  endTime?: string;
  startTime?: string;
  currentUser?: SystemUser;
  isLight?: boolean;
  onExpire?: () => void;
  onCelebrateWinner?: () => void;
}

export const MeetingCountdownTimer: React.FC<MeetingCountdownTimerProps> = ({
  endTime,
  startTime,
  currentUser,
  isLight = false,
  onExpire,
  onCelebrateWinner,
}) => {
  // Determine effective target end time
  const [targetDateStr, setTargetDateStr] = useState<string>(() => {
    if (endTime) return endTime;
    // Default fallback: 2 hours and 30 minutes from now
    return new Date(Date.now() + 2 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString();
  });

  // Start date for progress calculation
  const [startDateStr] = useState<string>(() => {
    if (startTime) return startTime;
    return new Date().toISOString();
  });

  const [timeLeft, setTimeLeft] = useState<{
    totalMs: number;
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
  }>({
    totalMs: 0,
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false,
  });

  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [showCustomPicker, setShowCustomPicker] = useState<boolean>(false);
  const [customTimeInput, setCustomTimeInput] = useState<string>("21:30");
  const [hasFiredExpire, setHasFiredExpire] = useState<boolean>(false);

  // Sync if prop endTime changes
  useEffect(() => {
    if (endTime) {
      setTargetDateStr(endTime);
      setHasFiredExpire(false);
    }
  }, [endTime]);

  // Main 1-second interval timer
  useEffect(() => {
    const calculate = () => {
      const now = Date.now();
      const target = new Date(targetDateStr).getTime();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft({
          totalMs: 0,
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isExpired: true,
        });

        if (!hasFiredExpire) {
          setHasFiredExpire(true);
          sounds.playFanfare();
          onExpire?.();
        }
      } else {
        const totalSeconds = Math.floor(diff / 1000);
        const days = Math.floor(totalSeconds / (3600 * 24));
        const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        setTimeLeft({
          totalMs: diff,
          days,
          hours,
          minutes,
          seconds,
          isExpired: false,
        });
      }
    };

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [targetDateStr, hasFiredExpire, onExpire]);

  // Can current user adjust time?
  const canEditTime = useMemo(() => {
    if (!currentUser) return false;
    return (
      currentUser.role === "admin" ||
      currentUser.role === "priest" ||
      currentUser.role === "servant" ||
      currentUser.permissions.canEditTeams
    );
  }, [currentUser]);

  // Quick adjust handlers
  const handleAddMinutes = async (mins: number) => {
    sounds.playTap();
    const currentTarget = new Date(targetDateStr).getTime();
    const baseTime = currentTarget > Date.now() ? currentTarget : Date.now();
    const newTarget = new Date(baseTime + mins * 60 * 1000).toISOString();
    setTargetDateStr(newTarget);
    setHasFiredExpire(false);
    await meetingStore.updateConfig({ meetingEndTime: newTarget });
  };

  const handleSetCustomTime = async (e: React.FormEvent) => {
    e.preventDefault();
    sounds.playVictory();
    const [hh, mm] = customTimeInput.split(":").map(Number);
    const d = new Date();
    d.setHours(hh || 21, mm || 30, 0, 0);

    // If time has already passed today, assume it's next day or same evening
    if (d.getTime() < Date.now()) {
      d.setDate(d.getDate() + 1);
    }

    const iso = d.toISOString();
    setTargetDateStr(iso);
    setHasFiredExpire(false);
    setShowCustomPicker(false);
    await meetingStore.updateConfig({ meetingEndTime: iso });
  };

  // Meeting duration progress calculation
  const progressPercent = useMemo(() => {
    const start = new Date(startDateStr).getTime();
    const end = new Date(targetDateStr).getTime();
    const now = Date.now();
    if (end <= start) return 100;
    const total = end - start;
    const elapsed = now - start;
    const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
    return Math.round(pct);
  }, [startDateStr, targetDateStr]);

  // Urgency indicator
  const isUrgent = !timeLeft.isExpired && timeLeft.totalMs < 10 * 60 * 1000; // < 10 mins

  return (
    <div
      className={`relative w-full rounded-3xl border transition-all duration-300 shadow-xl overflow-hidden ${
        isLight
          ? "bg-white/95 border-amber-300/80 text-slate-800 shadow-[0_10px_30px_rgba(245,158,11,0.12)]"
          : "bg-slate-900/90 border-amber-500/40 text-slate-100 shadow-[0_15px_40px_rgba(0,0,0,0.4)]"
      }`}
      dir="rtl"
    >
      {/* Top Banner Stripe */}
      <div
        className={`h-1.5 w-full transition-all duration-500 ${
          timeLeft.isExpired
            ? "bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500"
            : isUrgent
            ? "bg-gradient-to-r from-rose-500 via-amber-400 to-rose-500 animate-pulse"
            : "bg-gradient-to-r from-amber-500 via-orange-400 to-amber-500"
        }`}
      />

      <div className="p-3.5 sm:p-5 space-y-3.5">
        {/* Header Row */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div
              className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 border shadow-md transition-all ${
                timeLeft.isExpired
                  ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 animate-bounce"
                  : isUrgent
                  ? "bg-rose-500/20 border-rose-500 text-rose-400 animate-pulse"
                  : "bg-amber-500/20 border-amber-400 text-amber-400"
              }`}
            >
              {timeLeft.isExpired ? (
                <Trophy className="h-5 w-5" />
              ) : isUrgent ? (
                <Flame className="h-5 w-5" />
              ) : (
                <Clock className="h-5 w-5 animate-spin-slow" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-black tracking-tight flex items-center gap-1.5">
                  <span>الوقت المتبقي على انتهاء اجتماع الشباب 2026</span>
                  <span className="text-amber-400">⏳</span>
                </h3>

                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black border flex items-center gap-1 ${
                    timeLeft.isExpired
                      ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400 animate-pulse"
                      : isUrgent
                      ? "bg-rose-500/20 border-rose-500/40 text-rose-400 animate-ping"
                      : "bg-amber-500/15 border-amber-500/30 text-amber-300"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      timeLeft.isExpired
                        ? "bg-emerald-400"
                        : isUrgent
                        ? "bg-rose-400"
                        : "bg-amber-400 animate-ping"
                    }`}
                  />
                  <span>
                    {timeLeft.isExpired
                      ? "انتهى وقت الاجتماع! 🏆"
                      : isUrgent
                      ? "الدقائق الحاسمة الأخيرة! ⚡"
                      : "العد التنازلي مباشر ⏱️"}
                  </span>
                </span>
              </div>

              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                {timeLeft.isExpired
                  ? "اكتمل وقت المسابقات والأنشطة، حان موعد تتويج الفريق البطل وإعلان النتائج النهائية!"
                  : "مؤقت تفاعلي مباشر يُحسب بالثانية، تسابق الفرق لإحراز النقاط قبل صافرة النهاية!"}
              </p>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Quick Extension Pills for Servants & Admins */}
            {canEditTime && !timeLeft.isExpired && (
              <div className="hidden sm:flex items-center gap-1.5 bg-slate-950/70 p-1 rounded-2xl border border-slate-700/60 shadow-inner">
                <span className="text-[10px] text-slate-400 font-bold px-1.5">
                  تمديد:
                </span>
                <button
                  type="button"
                  onClick={() => handleAddMinutes(15)}
                  className="px-2 py-0.5 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-amber-300 text-[11px] font-mono font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                  title="إضافة 15 دقيقة لموعد ختام الاجتماع"
                >
                  +15د
                </button>
                <button
                  type="button"
                  onClick={() => handleAddMinutes(30)}
                  className="px-2 py-0.5 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-amber-300 text-[11px] font-mono font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                  title="إضافة 30 دقيقة لموعد ختام الاجتماع"
                >
                  +30د
                </button>
                <button
                  type="button"
                  onClick={() => setShowCustomPicker(!showCustomPicker)}
                  className="px-2 py-0.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                  title="تعديل وقت الختام بدقة"
                >
                  <Edit2 className="h-3 w-3" />
                  <span>تعديل</span>
                </button>
              </div>
            )}

            {/* Expired Celebration Action */}
            {timeLeft.isExpired && onCelebrateWinner && (
              <button
                type="button"
                onClick={onCelebrateWinner}
                className="px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/30 animate-bounce cursor-pointer flex items-center gap-1.5"
              >
                <PartyPopper className="h-4 w-4" />
                <span>احتفال بالبطل وتتويج الفائزين 🏆</span>
              </button>
            )}

            {/* Toggle Full/Compact */}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer border border-slate-700"
              title={isExpanded ? "طي المؤقت" : "توسيع المؤقت"}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Custom Time Picker Modal / Row */}
        {showCustomPicker && canEditTime && (
          <form
            onSubmit={handleSetCustomTime}
            className="p-3 rounded-2xl bg-slate-950/90 border border-amber-500/40 flex items-center gap-3 flex-wrap animate-fadeIn"
          >
            <span className="text-xs text-amber-300 font-bold">
              حدد موعد ختام اجتماع الشباب اليوم:
            </span>
            <input
              type="time"
              value={customTimeInput}
              onChange={(e) => setCustomTimeInput(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-sm font-mono text-white focus:outline-none focus:border-amber-400"
              required
            />
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-md transition-all cursor-pointer"
            >
              حفظ واعتماد التوقيت ⚡
            </button>
            <button
              type="button"
              onClick={() => setShowCustomPicker(false)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white text-xs cursor-pointer"
            >
              إلغاء
            </button>
          </form>
        )}

        {/* Detailed Digit Cards (When Expanded) */}
        {isExpanded && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-4 gap-2 sm:gap-3.5 max-w-xl mx-auto">
              {/* Days (if any) or Hours */}
              {timeLeft.days > 0 ? (
                <div
                  className={`p-2.5 sm:p-3.5 rounded-2xl border text-center transition-all ${
                    isLight
                      ? "bg-slate-50 border-slate-200"
                      : "bg-slate-950/80 border-slate-800"
                  }`}
                >
                  <div className="text-xl sm:text-3xl font-black font-mono tracking-tight text-amber-400">
                    {String(timeLeft.days).padStart(2, "0")}
                  </div>
                  <div className="text-[10px] sm:text-xs text-slate-400 font-bold mt-1">
                    أيام
                  </div>
                </div>
              ) : null}

              {/* Hours */}
              <div
                className={`p-2.5 sm:p-3.5 rounded-2xl border text-center transition-all ${
                  isLight
                    ? "bg-slate-50 border-slate-200 shadow-xs"
                    : "bg-slate-950/80 border-slate-800 shadow-inner"
                }`}
              >
                <div
                  className={`text-2xl sm:text-4xl font-black font-mono tracking-tight ${
                    timeLeft.isExpired
                      ? "text-emerald-400"
                      : isUrgent
                      ? "text-rose-400 animate-pulse"
                      : "text-amber-400"
                  }`}
                >
                  {String(timeLeft.hours).padStart(2, "0")}
                </div>
                <div className="text-[10px] sm:text-xs text-slate-400 font-bold mt-1">
                  ساعة
                </div>
              </div>

              {/* Minutes */}
              <div
                className={`p-2.5 sm:p-3.5 rounded-2xl border text-center transition-all ${
                  isLight
                    ? "bg-slate-50 border-slate-200 shadow-xs"
                    : "bg-slate-950/80 border-slate-800 shadow-inner"
                }`}
              >
                <div
                  className={`text-2xl sm:text-4xl font-black font-mono tracking-tight ${
                    timeLeft.isExpired
                      ? "text-emerald-400"
                      : isUrgent
                      ? "text-rose-400 animate-pulse"
                      : isLight
                      ? "text-slate-900"
                      : "text-white"
                  }`}
                >
                  {String(timeLeft.minutes).padStart(2, "0")}
                </div>
                <div className="text-[10px] sm:text-xs text-slate-400 font-bold mt-1">
                  دقيقة
                </div>
              </div>

              {/* Seconds */}
              <div
                className={`p-2.5 sm:p-3.5 rounded-2xl border text-center relative overflow-hidden transition-all ${
                  isLight
                    ? "bg-amber-50/70 border-amber-300 shadow-xs"
                    : "bg-slate-950/90 border-amber-500/50 shadow-inner ring-1 ring-amber-500/30"
                }`}
              >
                <div
                  className={`text-2xl sm:text-4xl font-black font-mono tracking-tight ${
                    timeLeft.isExpired
                      ? "text-emerald-400"
                      : isUrgent
                      ? "text-rose-400 animate-ping"
                      : "text-amber-400"
                  }`}
                >
                  {String(timeLeft.seconds).padStart(2, "0")}
                </div>
                <div className="text-[10px] sm:text-xs text-amber-500 font-bold mt-1">
                  ثانية
                </div>
              </div>

              {/* Status Badge */}
              <div
                className={`p-2.5 sm:p-3.5 rounded-2xl border flex flex-col items-center justify-center text-center transition-all ${
                  isLight
                    ? "bg-slate-50 border-slate-200 shadow-xs"
                    : "bg-slate-950/80 border-slate-800 shadow-inner"
                }`}
              >
                <div className="text-xl sm:text-2xl">
                  {timeLeft.isExpired ? "🏆" : isUrgent ? "⚡" : "🎯"}
                </div>
                <div className="text-[9px] sm:text-[10px] font-black text-amber-400 leading-tight mt-1">
                  {timeLeft.isExpired ? "النهاية" : `${progressPercent}% انقضى`}
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1 max-w-xl mx-auto pt-1">
              <div className="w-full h-2 rounded-full bg-slate-800/80 overflow-hidden p-0.5 border border-slate-700/60">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${
                    timeLeft.isExpired
                      ? "bg-emerald-400 w-full"
                      : isUrgent
                      ? "bg-gradient-to-r from-amber-400 to-rose-500 animate-pulse"
                      : "bg-gradient-to-r from-amber-500 to-orange-400"
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-400 px-1 font-mono">
                <span>انطلاق الاجتماع 🏁</span>
                <span>{progressPercent}% من وقت اللقاء</span>
                <span>صافرة الختام 🏆</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
