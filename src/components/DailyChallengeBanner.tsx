import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Flame, Clock, Award, Sparkles, CheckCircle, Plus, Zap, Edit2, X, Save } from "lucide-react";
import type { DailyChallenge } from "../types";
import { sounds } from "../utils/soundEffects";
import { meetingStore } from "../utils/meetingStore";
import { authStore } from "../utils/authStore";

interface DailyChallengeBannerProps {
  challenge: DailyChallenge;
  onAwardChallengePoints?: () => void;
  canAwardPoints?: boolean;
}

const PRESET_ICONS = ["🔥", "📖", "🎯", "💡", "🏆", "⚔️", "✝️", "🎵", "🌟", "🏓", "⚡", "🚀", "👑"];

export const DailyChallengeBanner: React.FC<DailyChallengeBannerProps> = ({
  challenge,
  onAwardChallengePoints,
  canAwardPoints = false,
}) => {
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState(challenge.title);
  const [editDesc, setEditDesc] = useState(challenge.description);
  const [editPoints, setEditPoints] = useState(challenge.pointsReward);
  const [editIcon, setEditIcon] = useState(challenge.icon || "🔥");
  const [editCategory, setEditCategory] = useState(challenge.category || "تحدي اليوم المميز");
  const [durationHours, setDurationHours] = useState(4);
  const [isSaving, setIsSaving] = useState(false);

  const [timeLeft, setTimeLeft] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
  }>({
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false,
  });

  useEffect(() => {
    setEditTitle(challenge.title);
    setEditDesc(challenge.description);
    setEditPoints(challenge.pointsReward);
    setEditIcon(challenge.icon || "🔥");
    setEditCategory(challenge.category || "تحدي اليوم المميز");
  }, [challenge]);

  useEffect(() => {
    const calculateTimeLeft = () => {
      if (!challenge.endsAt) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, isExpired: false });
        return;
      }

      const target = new Date(challenge.endsAt).getTime();
      const now = new Date().getTime();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, isExpired: true });
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ hours, minutes, seconds, isExpired: false });
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [challenge.endsAt]);

  const handleSaveChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim()) return;

    setIsSaving(true);
    sounds.playTap();

    const newEndsAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();

    const currentUser = authStore.getCurrentUser();
    const res = await meetingStore.updateDailyChallenge(
      {
        title: editTitle.trim(),
        description: editDesc.trim(),
        pointsReward: editPoints,
        icon: editIcon,
        category: editCategory.trim(),
        endsAt: newEndsAt,
        isActive: true,
      },
      currentUser
    );

    setIsSaving(false);
    if (res.success) {
      sounds.playVictory();
      setShowEditModal(false);
    } else {
      sounds.playClose();
      alert(res.error || "تعذر حفظ التعديلات");
    }
  };

  if (!challenge.isActive) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -15, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 350, damping: 22 }}
        className="relative mb-5 overflow-hidden rounded-3xl border-2 border-amber-400/80 bg-gradient-to-r from-amber-950/90 via-[#1A1230] to-purple-950/90 p-4 sm:p-5 text-white shadow-[0_15px_35px_rgba(245,158,11,0.25)] ring-1 ring-amber-400/30"
        dir="rtl"
      >
        {/* Background ambient shine */}
        <div className="pointer-events-none absolute -top-12 -left-12 h-40 w-40 rounded-full bg-amber-500/20 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 -right-12 h-40 w-40 rounded-full bg-purple-500/20 blur-2xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Left side: Header, icon, details */}
          <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
            <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-2xl shadow-lg shadow-amber-500/30 border border-white/20">
              <span>{challenge.icon || "🔥"}</span>
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/50 text-[10px] sm:text-xs font-black text-amber-300">
                  <Flame className="h-3 w-3 text-amber-400 animate-pulse" />
                  <span>{challenge.category || "تحدي اليوم المميز"}</span>
                </span>

                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-[10px] sm:text-xs font-black text-emerald-300 font-mono">
                  <Sparkles className="h-3 w-3 text-emerald-400" />
                  <span>+{challenge.pointsReward} XP مكافأة</span>
                </span>

                {canAwardPoints && (
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playTap();
                      setShowEditModal(true);
                    }}
                    className="p-1 px-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-amber-300 border border-amber-500/40 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                    title="تعديل تحدي اليوم"
                  >
                    <Edit2 className="h-3 w-3" />
                    <span>تعديل التحدي ✏️</span>
                  </button>
                )}
              </div>

              <h2 className="text-base sm:text-lg lg:text-xl font-black text-white tracking-tight leading-snug">
                {challenge.title}
              </h2>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
                {challenge.description}
              </p>
            </div>
          </div>

          {/* Right side: Countdown Timer & Action Button */}
          <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-white/10">
            {/* Countdown Clock Box */}
            <div className="flex flex-col items-center justify-center px-4 py-2 rounded-2xl bg-slate-950/80 border border-amber-400/40 shadow-inner">
              <div className="flex items-center gap-1 text-[10px] sm:text-xs text-amber-300 font-bold mb-0.5">
                <Clock className="h-3 w-3 text-amber-400 animate-spin" style={{ animationDuration: "6s" }} />
                <span>{timeLeft.isExpired ? "المهلة المحددة:" : "الوقت المتبقي:"}</span>
              </div>

              {timeLeft.isExpired ? (
                <span className="text-xs font-black text-rose-400">انتهى وقت التحدي ⌛</span>
              ) : (
                <div className="flex items-center gap-1 text-sm sm:text-base font-black font-mono text-amber-300" dir="ltr">
                  <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-amber-500/30">
                    {String(timeLeft.hours).padStart(2, "0")}
                  </span>
                  <span>:</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-amber-500/30">
                    {String(timeLeft.minutes).padStart(2, "0")}
                  </span>
                  <span>:</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-amber-500/30 text-emerald-400">
                    {String(timeLeft.seconds).padStart(2, "0")}
                  </span>
                </div>
              )}
            </div>

            {/* Quick Action Trigger */}
            {canAwardPoints && onAwardChallengePoints && (
              <button
                type="button"
                onClick={() => {
                  sounds.playTap();
                  onAwardChallengePoints();
                }}
                className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 text-xs sm:text-sm font-black shadow-lg shadow-amber-500/30 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
                title="رصد نقاط التحدي للفريق الإنجازي"
              >
                <Zap className="h-4 w-4 fill-slate-950" />
                <span>رصد التحدي (+{challenge.pointsReward} XP) ⚡</span>
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Edit Challenge Modal */}
      <AnimatePresence>
        {showEditModal && (
          <div
            className="fixed inset-0 z-[250] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md font-arabic"
            dir="rtl"
            onClick={() => setShowEditModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-xl rounded-3xl bg-slate-900 border border-amber-500/40 p-5 sm:p-6 shadow-2xl text-white space-y-4"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xl">
                    ✏️
                  </span>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-white">
                      تعديل وتحديث تحدي اليوم
                    </h3>
                    <p className="text-xs text-slate-400">
                      يمكنك كتابة تحدي اليوم وتحديد الوقت والـ XP والمكافأة
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSaveChallenge} className="space-y-4">
                {/* Title Input */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 block">
                    عنوان تحدي اليوم:
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="مثال: تحدي حفظ آية اللقاء والاشتراك الجماعي..."
                    className="w-full h-11 px-4 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>

                {/* Description Input */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 block">
                    تفاصيل ونشاط التحدي:
                  </label>
                  <textarea
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    rows={2}
                    placeholder="اكتب الأسلوب أو المطلوب لإنجاز التحدي هنا..."
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                {/* Icon Selection */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 block">
                    أيقونة / شعار التحدي:
                  </label>
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {PRESET_ICONS.map((ico) => (
                      <button
                        key={ico}
                        type="button"
                        onClick={() => setEditIcon(ico)}
                        className={`h-9 w-9 rounded-xl text-lg flex items-center justify-center border transition-all cursor-pointer ${
                          editIcon === ico
                            ? "bg-amber-500/30 border-amber-400 scale-110 shadow-md"
                            : "bg-slate-950 border-slate-800 hover:bg-slate-800"
                        }`}
                      >
                        {ico}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Points & Duration Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Reward Points */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300 block">
                      نقاط المكافأة (XP):
                    </label>
                    <div className="flex items-center gap-1.5">
                      {[50, 100, 150, 200].map((pts) => (
                        <button
                          key={pts}
                          type="button"
                          onClick={() => setEditPoints(pts)}
                          className={`flex-1 h-9 rounded-xl text-xs font-mono font-bold border cursor-pointer ${
                            editPoints === pts
                              ? "bg-amber-500 text-slate-950 border-amber-400 font-black"
                              : "bg-slate-950 text-slate-300 border-slate-800"
                          }`}
                        >
                          +{pts}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Countdown Duration */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300 block">
                      المهلة الزمنية للتحدي:
                    </label>
                    <select
                      value={durationHours}
                      onChange={(e) => setDurationHours(Number(e.target.value))}
                      className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400"
                    >
                      <option value={1}>1 ساعة فقط ⏱️</option>
                      <option value={2}>2 ساعة ⏱️</option>
                      <option value={4}>4 ساعات ⏱️</option>
                      <option value={6}>6 ساعات ⏱️</option>
                      <option value={12}>12 ساعة ⏱️</option>
                      <option value={24}>24 ساعة (يوم كامل) ⏱️</option>
                    </select>
                  </div>
                </div>

                {/* Submit button */}
                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-4 h-11 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 h-11 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/25 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Save className="h-4 w-4" />
                    <span>{isSaving ? "جاري الحفظ..." : "حفظ وتعميم التحدي ✅"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
