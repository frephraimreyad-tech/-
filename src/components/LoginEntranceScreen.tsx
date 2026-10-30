import React, { useState, useEffect } from "react";
import {
  Trophy,
  Shield,
  KeyRound,
  Camera,
  Users,
  CheckCircle,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Crown,
  Lock,
  QrCode,
  Tv,
} from "lucide-react";
import { meetingStore } from "../utils/meetingStore";
import { authStore, SUPER_ADMIN_USER, PUBLIC_MAKHDOUUM_USER, type SystemUser } from "../utils/authStore";
import { sounds } from "../utils/soundEffects";
import { LoginQRScannerModal } from "./LoginQRScannerModal";
import { WelcomeUserModal } from "./WelcomeUserModal";

interface LoginEntranceScreenProps {
  onEnterPublic: () => void;
  onEnterAdmin: () => void;
}

export const LoginEntranceScreen: React.FC<LoginEntranceScreenProps> = ({
  onEnterPublic,
  onEnterAdmin,
}) => {
  const [data, setData] = useState(meetingStore.getData());
  const [inputCode, setInputCode] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [welcomeUser, setWelcomeUser] = useState<SystemUser | null>(null);

  useEffect(() => {
    const unsub = meetingStore.subscribe(() => {
      setData({ ...meetingStore.getData() });
    });
    return unsub;
  }, []);

  // Detect code from URL query parameter (when redirected from QR code scanner)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlCode = params.get("code");
    if (urlCode) {
      const clean = urlCode.trim();
      setInputCode(clean);
      setErrorMsg(null);
      setSuccessMsg(`تم استلام الكود من الماسح / الرابط: [${clean}] 🔑 اضغط «دخول النظام ⚡» للمتابعة`);
      sounds.playOpen();
    }
  }, []);

  const handleCodeSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const clean = inputCode.trim();
    if (!clean) {
      setErrorMsg("يرجى إدخال كود المرور المخصص لك");
      sounds.playClose();
      return;
    }

    const res = authStore.loginWithCode(clean, data.members, data.teams);

    if (res.success && res.user) {
      // Clear code query parameter from URL so it doesn't persist after login
      if (window.location.search.includes("code=")) {
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      }
      setWelcomeUser(res.user);
    } else {
      sounds.playClose();
      setErrorMsg(res.error || "كود الدخول غير صحيح، يرجى التأكد وإعادة المحاولة");
    }
  };

  const handleProceedAfterWelcome = () => {
    if (!welcomeUser) return;
    const r = welcomeUser.role;
    setWelcomeUser(null);
    if (r === "admin" || r === "priest" || r === "leader" || r === "servant") {
      onEnterAdmin();
    } else {
      onEnterPublic();
    }
  };


  return (
    <div
      className="relative min-h-[100dvh] w-full bg-[#070A1E] text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 overflow-x-hidden font-arabic select-none"
      dir="rtl"
    >
      {/* Ambient background Orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-gradient-to-b from-indigo-600/30 via-purple-600/20 to-transparent blur-3xl rounded-full opacity-80" />
        <div className="absolute top-10 right-10 w-[400px] h-[400px] bg-amber-500/15 blur-[140px] rounded-full" />
        <div className="absolute bottom-10 left-10 w-[450px] h-[450px] bg-emerald-500/15 blur-[140px] rounded-full" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px] opacity-40" />
      </div>

      <div className="relative z-10 w-full max-w-lg space-y-6">
        {/* Main Card Container */}
        <div className="rounded-3xl border border-slate-700/80 bg-slate-900/90 backdrop-blur-2xl p-6 sm:p-8 shadow-[0_25px_60px_rgba(0,0,0,0.7)] text-center space-y-6">
          
          {/* Meeting Logo / Emblem Header */}
          <div className="flex flex-col items-center space-y-3">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-400 to-amber-600 rounded-3xl blur-2xl opacity-50 animate-pulse" />
              <div className="relative flex h-32 w-32 sm:h-40 sm:w-40 items-center justify-center rounded-3xl bg-white/95 shadow-2xl border-2 border-amber-400/80 p-2 overflow-hidden ring-4 ring-amber-500/20">
                <img
                  src={data.config.meetingLogoUrl || "/assets/aistudio/_______________________55ad5e73.png"}
                  alt="لوجو أسرة الشهيد العظيم أبي سيفين وتماف إيريني"
                  className="w-full h-full object-contain rounded-2xl"
                />
              </div>
            </div>

            <div className="space-y-1">
              <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-xs font-black text-emerald-400 shadow-xs">
                {data.config.churchName || "الكنيسة القبطية الأرثوذكسية"}
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                {data.config.meetingName || "اجتماع الشباب والخدّام"}
              </h1>
              <p className="text-xs text-slate-400 font-medium">
                {data.config.subTitle || "منظومة لوحة الشرف والسكور بورد التفاعلية"}
              </p>
            </div>
          </div>

          <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-700 to-transparent" />

          {/* Form / Code Entry Section */}
          <div className="space-y-4 text-right">
            <div className="space-y-1 text-center">
              <h2 className="text-base sm:text-lg font-black text-amber-300 flex items-center justify-center gap-2">
                <KeyRound className="h-5 w-5 text-amber-400" />
                <span>تسجيل الدخول بكود المرور</span>
              </h2>
              <p className="text-xs text-slate-400">
                أدخل الكود المخصص لك للدخول إلى شاشتك المخصصة (خادم / أدمن / مخدوم)
              </p>
            </div>

            <form onSubmit={handleCodeSubmit} className="space-y-3">
              <div className="relative">
                <input
                  type="text"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value)}
                  placeholder="أدخل الكود هنا..."
                  className="w-full h-13 px-4 text-center font-mono text-lg font-black tracking-widest rounded-2xl bg-slate-950 border-2 border-slate-700/80 text-white placeholder:text-slate-600 placeholder:font-arabic placeholder:text-xs focus:outline-none focus:border-amber-400 transition-all shadow-inner"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="w-full h-12 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 text-sm font-black shadow-lg shadow-amber-500/25 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2 border border-amber-300/40"
              >
                <span>دخول النظام ⚡</span>
              </button>
            </form>

            {/* Error or Success Alert Messages */}
            {errorMsg && (
              <div className="p-3 rounded-2xl bg-rose-950/90 border border-rose-500/60 text-rose-200 text-xs font-bold flex items-center gap-2 shadow-md animate-shake">
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 rounded-2xl bg-emerald-950/90 border border-emerald-500/60 text-emerald-200 text-xs font-bold flex items-center gap-2 shadow-md">
                <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* OR Divider */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-slate-900 px-3 text-slate-500 font-bold">أو اختر طريقة الدخول</span>
              </div>
            </div>

            {/* Scan QR Button */}
            <button
              type="button"
              onClick={() => {
                sounds.playTap();
                setShowScanner(true);
              }}
              className="w-full h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40 text-xs sm:text-sm font-black shadow-md active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Camera className="h-5 w-5 text-emerald-400" />
              <span>📱 مسح رمز الباركود / QR بالماسح</span>
            </button>
          </div>
        </div>
      </div>

      {/* Login QR / Barcode Scanner Modal */}
      {showScanner && (
        <LoginQRScannerModal
          onClose={() => setShowScanner(false)}
          onCodeScanned={(scannedCode) => {
            setShowScanner(false);
            setInputCode(scannedCode);
            setErrorMsg(null);
            setSuccessMsg(`تم قراءة الكود بنجاح من الماسح: [${scannedCode}] 🔑 اضغط «دخول النظام ⚡» للمتابعة`);
            sounds.playSuccess();
          }}
        />
      )}

      {/* Welcome User Modal Overlay */}
      {welcomeUser && (
        <WelcomeUserModal
          user={welcomeUser}
          onContinue={handleProceedAfterWelcome}
        />
      )}
    </div>
  );
};
