import React, { useState } from "react";
import {
  X,
  KeyRound,
  UserCheck,
  Lock,
  CheckCircle,
  AlertCircle,
  LogOut,
  QrCode,
  Zap,
} from "lucide-react";
import { authStore, SUPER_ADMIN_USER, type SystemUser } from "../utils/authStore";
import { meetingStore } from "../utils/meetingStore";
import { sounds } from "../utils/soundEffects";

interface UserSwitcherModalProps {
  onClose: () => void;
}

export const UserSwitcherModal: React.FC<UserSwitcherModalProps> = ({ onClose }) => {
  const [currentUser, setCurrentUser] = useState<SystemUser>(authStore.getCurrentUser());
  const [inputCode, setInputCode] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const data = meetingStore.getData();

  const handleLoginWithCode = (code: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = authStore.loginWithCode(
      code,
      data.members,
      data.teams.map((t) => ({ id: t.id, name: t.name }))
    );

    if (res.success && res.user) {
      sounds.playVictory();
      setCurrentUser(res.user);
      setSuccessMsg(`تم تسجيل الدخول بنجاح كـ: ${res.user.name} (${res.user.roleLabel})`);
      setTimeout(() => {
        onClose();
      }, 1200);
    } else {
      sounds.playClose();
      setErrorMsg(res.error || "كود الدخول غير صالح");
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;
    handleLoginWithCode(inputCode.trim());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn font-arabic"
      dir="rtl"
    >
      <div className="relative w-full max-w-xl rounded-3xl border border-slate-700 bg-[#0B132B] p-5 sm:p-7 shadow-2xl text-slate-100 space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={() => {
            sounds.playClose();
            onClose();
          }}
          className="absolute top-4 left-4 p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="space-y-1 pr-6">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400">
              <KeyRound className="h-5 w-5" />
            </span>
            <h3 className="text-xl font-black text-white">تسجيل الدخول وإدارة الصلاحيات</h3>
          </div>
          <p className="text-xs text-slate-400">
            أدخل كود الوصول الخاص بك لتفعيل مستوى الأمان والمهام المسموح لك بتنفيذها.
          </p>
        </div>

        {/* Current Active User Status Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 font-black">
                {currentUser.role === "admin" ? "👑" : currentUser.role === "leader" ? "🛡️" : "👤"}
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">المستخدم النشط حالياً:</span>
                <span className="text-sm sm:text-base font-black text-white">{currentUser.name}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-black">
                {currentUser.roleLabel}
              </span>
              {currentUser.accessCode && (
                <span className="px-2 py-1 rounded-lg bg-slate-950 font-mono text-[11px] text-slate-400 border border-slate-800">
                  كود: {currentUser.accessCode}
                </span>
              )}
              {currentUser.role !== "member" && (
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClose();
                    authStore.logout();
                    setCurrentUser(authStore.getCurrentUser());
                    setSuccessMsg("تم تسجيل الخروج والعودة للشاشة العامة للمخدومين.");
                    setTimeout(() => {
                      onClose();
                    }, 800);
                  }}
                  className="px-3 py-1 rounded-xl bg-rose-950/90 hover:bg-rose-900 border border-rose-500/50 text-rose-300 text-xs font-black cursor-pointer transition-all flex items-center gap-1 shrink-0"
                  title="تسجيل الخروج والرجوع للشاشة العامة"
                >
                  <LogOut className="h-3.5 w-3.5 text-rose-400" />
                  <span>خروج للشاشة العامة</span>
                </button>
              )}
            </div>
          </div>

          {/* Active Permissions Badges */}
          <div className="pt-2 border-t border-slate-800/80">
            <div className="text-[11px] text-slate-400 mb-2 font-bold">الصلاحيات الممنوحة لهذا الحساب:</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px]">
              <div
                className={`flex items-center gap-1.5 p-1.5 rounded-lg border ${
                  currentUser.permissions.canAwardPoints
                    ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                    : "bg-slate-950/40 border-slate-800 text-slate-500"
                }`}
              >
                {currentUser.permissions.canAwardPoints ? (
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <Lock className="h-3.5 w-3.5 text-rose-400/60 shrink-0" />
                )}
                <span>رصد وتعديل النقاط</span>
              </div>

              <div
                className={`flex items-center gap-1.5 p-1.5 rounded-lg border ${
                  currentUser.permissions.canScanAttendance
                    ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                    : "bg-slate-950/40 border-slate-800 text-slate-500"
                }`}
              >
                {currentUser.permissions.canScanAttendance ? (
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <Lock className="h-3.5 w-3.5 text-rose-400/60 shrink-0" />
                )}
                <span>مسح QR للحضور</span>
              </div>

              <div
                className={`flex items-center gap-1.5 p-1.5 rounded-lg border ${
                  currentUser.permissions.canEditTeams
                    ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                    : "bg-slate-950/40 border-slate-800 text-slate-500"
                }`}
              >
                {currentUser.permissions.canEditTeams ? (
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <Lock className="h-3.5 w-3.5 text-rose-400/60 shrink-0" />
                )}
                <span>تعديل وحذف الفرق</span>
              </div>

              <div
                className={`flex items-center gap-1.5 p-1.5 rounded-lg border ${
                  currentUser.permissions.canCreateEvents
                    ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                    : "bg-slate-950/40 border-slate-800 text-slate-500"
                }`}
              >
                {currentUser.permissions.canCreateEvents ? (
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <Lock className="h-3.5 w-3.5 text-rose-400/60 shrink-0" />
                )}
                <span>إنشاء وتوليد QR الفعاليات</span>
              </div>

              <div
                className={`flex items-center gap-1.5 p-1.5 rounded-lg border ${
                  currentUser.permissions.canManagePermissions
                    ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                    : "bg-slate-950/40 border-slate-800 text-slate-500"
                }`}
              >
                {currentUser.permissions.canManagePermissions ? (
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <Lock className="h-3.5 w-3.5 text-rose-400/60 shrink-0" />
                )}
                <span>إدارة الصلاحيات والأكواد</span>
              </div>

              <div
                className={`flex items-center gap-1.5 p-1.5 rounded-lg border ${
                  currentUser.permissions.canExportData
                    ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                    : "bg-slate-950/40 border-slate-800 text-slate-500"
                }`}
              >
                {currentUser.permissions.canExportData ? (
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <Lock className="h-3.5 w-3.5 text-rose-400/60 shrink-0" />
                )}
                <span>تصدير تقارير السجل</span>
              </div>
            </div>
          </div>
        </div>

        {/* Enter Code Form */}
        <form onSubmit={handleFormSubmit} className="space-y-3">
          <label className="text-xs font-bold text-slate-300 block">
            أو أدخل كود المرور المخصص لك (Access Code / PIN):
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              placeholder="مثال: 9999 أو 1010 أو كود العضو..."
              className="flex-1 rounded-2xl bg-slate-950 border border-slate-700 px-4 py-3 text-sm text-white font-mono tracking-widest focus:outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm shadow-md active:scale-95 transition-all cursor-pointer"
            >
              تسجيل الدخول
            </button>
          </div>
        </form>

        {/* Feedback messages */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
      </div>
    </div>
  );
};
