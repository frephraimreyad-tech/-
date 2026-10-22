import React, { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Trophy, Crown, Shield, User, CheckCircle2, ArrowLeft } from "lucide-react";
import type { SystemUser } from "../utils/authStore";
import { sounds } from "../utils/soundEffects";

interface WelcomeUserModalProps {
  user: SystemUser;
  onContinue: () => void;
}

export const WelcomeUserModal: React.FC<WelcomeUserModalProps> = ({ user, onContinue }) => {
  useEffect(() => {
    sounds.playVictory();
    const timer = setTimeout(() => {
      onContinue();
    }, 2200);
    return () => clearTimeout(timer);
  }, [onContinue]);

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "admin":
      case "priest":
        return <Crown className="h-5 w-5 text-amber-400" />;
      case "leader":
        return <Shield className="h-5 w-5 text-sky-400" />;
      case "servant":
        return <Sparkles className="h-5 w-5 text-purple-400" />;
      default:
        return <User className="h-5 w-5 text-teal-400" />;
    }
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case "admin":
      case "priest":
        return "bg-amber-500/20 text-amber-300 border-amber-500/50";
      case "leader":
        return "bg-sky-500/20 text-sky-300 border-sky-500/50";
      case "servant":
        return "bg-purple-500/20 text-purple-300 border-purple-500/50";
      default:
        return "bg-teal-500/20 text-teal-300 border-teal-500/50";
    }
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xl font-arabic select-none"
        dir="rtl"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -20 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="relative w-full max-w-md rounded-3xl border-2 border-amber-400/80 bg-gradient-to-b from-[#0F172A] via-[#0B132B] to-[#070A1E] p-6 sm:p-8 shadow-[0_25px_70px_rgba(245,158,11,0.3)] text-center space-y-6 text-white"
        >
          {/* Top Ambient Glow */}
          <div className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 h-40 w-40 rounded-full bg-amber-500/25 blur-3xl" />

          {/* User Photo / Avatar Container */}
          <div className="relative flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-amber-400 to-amber-600 rounded-full blur-xl opacity-70 animate-pulse" />
              <div className="relative h-28 w-28 sm:h-32 sm:w-32 rounded-full border-4 border-amber-400/90 bg-slate-900 p-1 shadow-2xl overflow-hidden flex items-center justify-center ring-4 ring-amber-500/20">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="h-full w-full object-cover rounded-full"
                  />
                ) : (
                  <div className="h-full w-full rounded-full bg-gradient-to-tr from-amber-500 via-amber-400 to-orange-500 flex items-center justify-center text-slate-950 font-black text-3xl sm:text-4xl shadow-inner">
                    {user.name.charAt(0)}
                  </div>
                )}
              </div>

              {/* Verified check badge */}
              <div className="absolute -bottom-1 -left-1 bg-emerald-500 text-slate-950 rounded-full p-1.5 border-2 border-slate-950 shadow-lg">
                <CheckCircle2 className="h-5 w-5 text-slate-950 stroke-[3]" />
              </div>
            </div>
          </div>

          {/* Welcome Text Details */}
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-black border flex items-center gap-1.5 shadow-sm ${getRoleBadgeStyle(
                  user.role
                )}`}
              >
                {getRoleIcon(user.role)}
                <span>{user.roleLabel || "عضو مسجل"}</span>
              </span>

              {user.teamName && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-amber-300 border border-amber-500/30">
                  فريق {user.teamName}
                </span>
              )}
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-snug">
              أهلاً بك، {user.name}! 🌟
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 font-medium">
              تم التحقق من كود المرور بنجاح. نتمنى لك خدمة مباركة ولقاء ممتعاً!
            </p>
          </div>

          {/* User Stats Bar */}
          {user.points !== undefined && (
            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-around text-xs">
              <div className="text-center">
                <span className="text-[10px] text-slate-400 font-bold block">رصيد النقاط الفردي</span>
                <span className="text-base font-black text-amber-400 font-mono">
                  {user.points.toLocaleString("en-US")} XP
                </span>
              </div>

              <div className="h-8 w-px bg-slate-800" />

              <div className="text-center">
                <span className="text-[10px] text-slate-400 font-bold block">حالة الحساب</span>
                <span className="text-xs font-black text-emerald-400 flex items-center justify-center gap-1">
                  <span>نشط ومصرح 🟢</span>
                </span>
              </div>
            </div>
          )}

          {/* Continue Button */}
          <button
            type="button"
            onClick={onContinue}
            className="w-full h-12 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/25 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 border border-amber-300/40"
          >
            <span>متابعة للدخول للنظام</span>
            <ArrowLeft className="h-4 w-4" />
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
