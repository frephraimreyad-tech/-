import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Clock,
  Zap,
  X,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Shield,
  User,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import type { ScoreTransaction, CustomTeam } from "../types";
import { formatArabicTimestamp } from "../utils/dateFormatter";
import { sounds } from "../utils/soundEffects";

interface AdminSideActivityWidgetProps {
  transactions: ScoreTransaction[];
  teams: CustomTeam[];
  isLight: boolean;
  onViewAllHistory?: () => void;
  onUndoTransaction?: (txId: string) => Promise<boolean>;
}

export const AdminSideActivityWidget: React.FC<AdminSideActivityWidgetProps> = ({
  transactions,
  teams,
  isLight,
  onViewAllHistory,
  onUndoTransaction,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isUndoingId, setIsUndoingId] = useState<string | null>(null);
  const [undoSuccessId, setUndoSuccessId] = useState<string | null>(null);

  // Take the last 5 transactions
  const recentTransactions = transactions.slice(0, 5);

  const getAffectedTeam = (tx: ScoreTransaction) => {
    if (tx.teamId) {
      const found = teams.find((t) => t.id === tx.teamId);
      if (found) return found;
    }
    if (tx.teamName) {
      const found = teams.find((t) => t.name === tx.teamName);
      if (found) return found;
    }
    if (tx.targetType === "team") {
      const found = teams.find((t) => t.id === tx.targetId);
      if (found) return found;
    }
    return {
      id: tx.teamId || "unknown",
      name: tx.teamName || (tx.targetType === "team" ? tx.targetName : "فريق عام"),
      icon: "🦁",
      color: "#EAB308",
      points: 0,
    };
  };

  const handleUndo = async (txId: string) => {
    if (!onUndoTransaction) return;
    setIsUndoingId(txId);
    sounds.playTap();
    try {
      const success = await onUndoTransaction(txId);
      if (success) {
        sounds.playVictory();
        setUndoSuccessId(txId);
        setTimeout(() => setUndoSuccessId(null), 3000);
      } else {
        sounds.playClose();
      }
    } catch {
      sounds.playClose();
    } finally {
      setIsUndoingId(null);
    }
  };

  return (
    <>
      {/* Floating Toggle Button when Collapsed */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, x: -20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8, x: -20 }}
            className="fixed bottom-6 left-6 z-[90]"
          >
            <button
              type="button"
              onClick={() => {
                sounds.playTap();
                setIsOpen(true);
              }}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl border-2 shadow-2xl transition-all cursor-pointer hover:scale-105 active:scale-95 group ${
                isLight
                  ? "bg-white/95 border-amber-500 text-slate-900 shadow-amber-500/15"
                  : "bg-slate-900/95 border-amber-500/60 text-white shadow-black/60"
              }`}
              title="فتح نافذة آخر 5 عمليات إضافة وتعديل للنقاط"
            >
              <div className="relative">
                <span className="flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-black">
                <Zap className="h-4 w-4 text-amber-500" />
                <span>آخر 5 عمليات (Activity Log)</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                isLight ? "bg-amber-100 text-amber-950" : "bg-amber-500/20 text-amber-300"
              }`}>
                {recentTransactions.length}
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Side Window (نافذة جانبية عائمة لآخر 5 عمليات) */}
      <AnimatePresence>
        {isOpen && (
          <motion.aside
            initial={{ opacity: 0, x: -50, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -50, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            className={`fixed bottom-5 left-5 z-[90] w-80 sm:w-96 max-h-[85vh] rounded-3xl border-2 shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden transition-colors ${
              isLight
                ? "bg-white/95 border-amber-400 text-slate-900 shadow-slate-900/15"
                : "bg-slate-950/95 border-amber-500/40 text-slate-100 shadow-black/80"
            }`}
            style={{ direction: "rtl" }}
          >
            {/* Window Header */}
            <div className={`p-3.5 sm:p-4 border-b-2 flex items-center justify-between shrink-0 ${
              isLight
                ? "bg-amber-50/90 border-amber-200"
                : "bg-slate-900/90 border-slate-800"
            }`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/25 shrink-0">
                  <Zap className="h-4 w-4 fill-slate-950" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs sm:text-sm font-black truncate">
                      سجل العمليات الأخير
                    </h3>
                    <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-300 font-mono text-[10px] font-bold">
                      آخر 5
                    </span>
                  </div>
                  <p className={`text-[10px] truncate ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                    إضافة وتعديل النقاط اللحظي
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClose();
                    setIsOpen(false);
                  }}
                  className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                    isLight
                      ? "hover:bg-slate-100 border-slate-300 text-slate-700 hover:text-slate-950"
                      : "hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                  title="تصغير النافذة الجانبية"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClose();
                    setIsOpen(false);
                  }}
                  className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                    isLight
                      ? "hover:bg-rose-50 border-slate-300 text-rose-600"
                      : "hover:bg-rose-950/40 border-slate-800 text-rose-400"
                  }`}
                  title="إغلاق النافذة"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Window Body: Last 5 Transactions List */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-3.5 space-y-2.5 no-scrollbar max-h-[calc(85vh-140px)]">
              {recentTransactions.length === 0 ? (
                <div className={`text-center py-10 px-4 space-y-2 rounded-2xl border-2 border-dashed ${
                  isLight ? "border-slate-300 text-slate-500 bg-slate-50/50" : "border-slate-800 text-slate-400 bg-slate-900/30"
                }`}>
                  <Clock className="h-8 w-8 mx-auto opacity-40 text-amber-500 animate-pulse" />
                  <p className="text-xs font-bold">لا توجد عمليات مسجلة بعد</p>
                  <p className="text-[11px] opacity-75">
                    عند رصد أي بونص أو تعديل لنقاط الفرق سيظهر اسم الفريق المتأثر والوقت هنا فوراً.
                  </p>
                </div>
              ) : (
                recentTransactions.map((tx, idx) => {
                  const affectedTeam = getAffectedTeam(tx);
                  const ts = formatArabicTimestamp(tx.timestamp);
                  const isPositive = tx.points >= 0;
                  const isMemberTarget = tx.targetType === "member";
                  const isUndoing = isUndoingId === tx.id;
                  const isUndone = undoSuccessId === tx.id;

                  return (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className={`p-3 rounded-2xl border-2 space-y-2 transition-all relative overflow-hidden ${
                        isUndone
                          ? "bg-emerald-500/10 border-emerald-500/50"
                          : isLight
                          ? "bg-slate-50/80 hover:bg-white border-slate-200 hover:border-amber-300 shadow-xs"
                          : "bg-slate-900/60 hover:bg-slate-900 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      {/* Top Row: Affected Team Name & Points Delta */}
                      <div className="flex items-center justify-between gap-2">
                        {/* Affected Team info */}
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="h-7 w-7 rounded-lg flex items-center justify-center text-sm shadow-xs shrink-0 border"
                            style={{
                              backgroundColor: `${affectedTeam.color}25`,
                              borderColor: affectedTeam.color,
                            }}
                          >
                            {affectedTeam.icon || "🏆"}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-xs font-black truncate ${isLight ? "text-slate-900" : "text-white"}`}>
                                {affectedTeam.name}
                              </span>
                              {isMemberTarget && (
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold truncate ${
                                  isLight ? "bg-blue-100 text-blue-900" : "bg-blue-500/20 text-blue-300"
                                }`}>
                                  👤 {tx.targetName}
                                </span>
                              )}
                            </div>
                            <span className={`text-[10px] block font-medium ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                              الفريق المتأثر بالرصد
                            </span>
                          </div>
                        </div>

                        {/* Points badge */}
                        <div className="shrink-0 text-left">
                          <span
                            className={`inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-xl text-xs font-mono font-black border shadow-xs ${
                              isPositive
                                ? isLight
                                  ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                                  : "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                                : isLight
                                ? "bg-rose-100 text-rose-900 border-rose-300"
                                : "bg-rose-500/20 text-rose-400 border-rose-500/40"
                            }`}
                          >
                            {isPositive ? `+${tx.points}` : tx.points} XP
                          </span>
                        </div>
                      </div>

                      {/* Middle: Reason */}
                      <div className={`text-[11px] font-bold line-clamp-2 px-2.5 py-1 rounded-xl border ${
                        isLight ? "bg-white border-slate-200 text-slate-800" : "bg-slate-950/60 border-slate-800/80 text-slate-200"
                      }`}>
                        🎯 {tx.reason || "رصد نقاط مباشر"}
                      </div>

                      {/* Bottom Row: Timestamp + Executor + Undo Button */}
                      <div className={`flex items-center justify-between gap-1 pt-1 text-[10px] ${
                        isLight ? "text-slate-600" : "text-slate-400"
                      }`}>
                        {/* Time details */}
                        <div className="flex items-center gap-1 font-mono">
                          <Clock className="h-3 w-3 text-amber-500 shrink-0" />
                          <span className="font-bold">{ts.timeStr}</span>
                          <span className="opacity-75">({ts.relative})</span>
                        </div>

                        {/* Executor or Undo Action */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {tx.executorName && (
                            <span className="text-[9px] opacity-75 truncate max-w-[80px]">
                              {tx.executorName.split(" ")[0]}
                            </span>
                          )}

                          {onUndoTransaction && !isUndone && (
                            <button
                              type="button"
                              onClick={() => handleUndo(tx.id)}
                              disabled={isUndoing}
                              className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95 disabled:opacity-50 ${
                                isLight
                                  ? "bg-slate-100 hover:bg-rose-100 hover:text-rose-900 border-slate-300 text-slate-700"
                                  : "bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 border-slate-700 text-slate-300"
                              }`}
                              title="تراجع عن هذه العملية وإلغاء نقاطها"
                            >
                              <RotateCcw className={`h-2.5 w-2.5 ${isUndoing ? "animate-spin" : ""}`} />
                              <span>{isUndoing ? "جاري..." : "تراجع"}</span>
                            </button>
                          )}

                          {isUndone && (
                            <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-0.5">
                              <CheckCircle2 className="h-3 w-3" /> تم الإلغاء
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Window Footer: View full history & Live counter */}
            <div className={`p-3 border-t-2 flex items-center justify-between gap-2 shrink-0 ${
              isLight ? "bg-slate-50 border-slate-200" : "bg-slate-900 border-slate-800"
            }`}>
              <div className={`text-[10px] font-mono font-bold flex items-center gap-1 ${
                isLight ? "text-slate-600" : "text-slate-400"
              }`}>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>المجموع: {transactions.length} معاملة</span>
              </div>

              {onViewAllHistory && (
                <button
                  type="button"
                  onClick={() => {
                    sounds.playTap();
                    onViewAllHistory();
                  }}
                  className="px-3 py-1 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-black transition-all cursor-pointer flex items-center gap-1 shadow-xs active:scale-95"
                  title="عرض السجل التاريخي الكامل لجميع المعاملات"
                >
                  <span>عرض السجل الشامل 📜</span>
                  <ExternalLink className="h-3 w-3" />
                </button>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
};
