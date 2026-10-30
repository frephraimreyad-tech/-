import React, { useEffect, useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  X,
  Camera,
  AlertCircle,
  KeyRound,
  Upload,
  CheckCircle,
  Sparkles,
} from "lucide-react";
import { meetingStore } from "../utils/meetingStore";
import { authStore, type SystemUser } from "../utils/authStore";
import { sounds } from "../utils/soundEffects";

interface LoginQRScannerModalProps {
  onClose: () => void;
  onCodeScanned?: (code: string) => void;
  onLoginSuccess?: (user: SystemUser) => void;
}

export const LoginQRScannerModal: React.FC<LoginQRScannerModalProps> = ({
  onClose,
  onCodeScanned,
  onLoginSuccess,
}) => {
  const data = meetingStore.getData();

  const [activeTab, setActiveTab] = useState<"camera" | "code">("camera");
  const [manualCode, setManualCode] = useState("");
  const [isScanningLive, setIsScanningLive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const fileInputCameraRef = useRef<HTMLInputElement | null>(null);
  const fileInputGalleryRef = useRef<HTMLInputElement | null>(null);

  const stopLiveScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn("Error stopping scanner:", e);
      }
      html5QrCodeRef.current = null;
    }
    setIsScanningLive(false);
  };

  useEffect(() => {
    return () => {
      stopLiveScanner();
    };
  }, []);

  const handleProcessCode = (rawCode: string) => {
    let clean = (rawCode || "").trim();
    if (!clean) return;

    // Support URLs containing ?code= or &code=
    if (clean.includes("?code=") || clean.includes("&code=")) {
      try {
        const url = new URL(clean.startsWith("http") ? clean : `https://example.com/${clean}`);
        const c = url.searchParams.get("code");
        if (c) clean = c.trim();
      } catch {
        const match = clean.match(/[?&]code=([^&#]+)/);
        if (match && match[1]) clean = match[1].trim();
      }
    }

    // If onCodeScanned is provided, redirect to login page with code prefilled instead of immediately entering the system
    if (onCodeScanned) {
      stopLiveScanner();
      sounds.playTap();
      onCodeScanned(clean);
      return;
    }

    const res = authStore.loginWithCode(clean, data.members, data.teams);

    if (res.success && res.user) {
      stopLiveScanner();
      sounds.playVictory();
      onLoginSuccess?.(res.user);
    } else {
      sounds.playClose();
      setErrorMsg(res.error || "رمز الباركود أو الكود غير صحيح، يرجى إعادة المحاولة.");
    }
  };

  const startLiveScanner = async () => {
    setCameraError(null);
    setErrorMsg(null);
    await stopLiveScanner();

    try {
      const qrRegion = document.getElementById("login-camera-stream");
      if (!qrRegion) {
        setCameraError("عنصر الكاميرا غير جاهز بعد.");
        return;
      }

      const qr = new Html5Qrcode("login-camera-stream");
      html5QrCodeRef.current = qr;

      try {
        await qr.start(
          { facingMode: "environment" },
          {
            fps: 12,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            handleProcessCode(decodedText);
          },
          () => {}
        );
        setIsScanningLive(true);
      } catch (envErr) {
        console.warn("FacingMode environment failed, trying available cameras:", envErr);
        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 0) {
          const selectedCam = cameras[cameras.length - 1];
          await qr.start(
            selectedCam.id,
            {
              fps: 12,
              qrbox: { width: 250, height: 250 },
            },
            (decodedText) => {
              handleProcessCode(decodedText);
            },
            () => {}
          );
          setIsScanningLive(true);
        } else {
          throw envErr;
        }
      }
    } catch (err: any) {
      console.warn("Live camera start failed:", err);
      setIsScanningLive(false);
      setCameraError(
        "البث المباشر للكاميرا محظور بواسطة متصفح الهاتف أو سياسة الأمان. استخدم زر «التقاط صورة الكود بالكاميرا» أدناه، فهو يعمل بنسبة 100% على كافة الهواتف."
      );
    }
  };

  useEffect(() => {
    if (activeTab === "camera") {
      const timer = setTimeout(() => {
        startLiveScanner();
      }, 250);
      return () => clearTimeout(timer);
    } else {
      stopLiveScanner();
    }
  }, [activeTab]);

  const handleScanImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setErrorMsg(null);
    setCameraError(null);
    sounds.playTap();

    try {
      const tempScanner = new Html5Qrcode("login-camera-file-reader");
      const decodedText = await tempScanner.scanFile(file, true);
      await tempScanner.clear();
      setIsProcessingFile(false);
      handleProcessCode(decodedText);
    } catch (err) {
      console.warn("Scan image file error:", err);
      setIsProcessingFile(false);
      sounds.playClose();
      setErrorMsg("لم يتم التعرف على رمز باركود أو QR واضح في الصورة. يرجى إعادة المحاولة.");
    } finally {
      if (fileInputCameraRef.current) fileInputCameraRef.current.value = "";
      if (fileInputGalleryRef.current) fileInputGalleryRef.current.value = "";
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleProcessCode(manualCode);
  };

  return (
    <div
      className="fixed inset-0 z-[350] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn font-arabic select-none"
      dir="rtl"
    >
      {/* Hidden file inputs for direct camera capture and gallery upload */}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={fileInputCameraRef}
        onChange={handleScanImageFile}
        className="hidden"
      />
      <input
        type="file"
        accept="image/*"
        ref={fileInputGalleryRef}
        onChange={handleScanImageFile}
        className="hidden"
      />
      <div id="login-camera-file-reader" className="hidden" />

      <div className="relative w-full max-w-md rounded-3xl border border-slate-700 bg-[#0B132B] p-5 sm:p-6 shadow-2xl text-slate-100 space-y-4">
        {/* Close Button */}
        <button
          onClick={() => {
            stopLiveScanner();
            sounds.playClose();
            onClose();
          }}
          className="absolute top-4 left-4 p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer z-10"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="space-y-1 pr-4">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400">
              <Camera className="h-5 w-5" />
            </span>
            <h3 className="text-lg sm:text-xl font-black text-white">
              مسح الباركود أو الكود للدخول 📱
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            امسح باركود بطاقتك بالكاميرا أو أدخل الكود للدخول المباشر
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => {
              sounds.playTap();
              setActiveTab("camera");
            }}
            className={`flex-1 py-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === "camera"
                ? "bg-amber-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Camera className="h-4 w-4" />
            <span>كاميرا الهاتف 📷</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sounds.playTap();
              setActiveTab("code");
            }}
            className={`flex-1 py-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === "code"
                ? "bg-amber-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <KeyRound className="h-4 w-4" />
            <span>رصد بالكود 🔢</span>
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3 rounded-2xl bg-rose-950/85 border border-rose-500/70 text-rose-200 text-xs font-bold flex items-center gap-2 animate-shake">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ---------------- OPTION 1: CAMERA LIVE STREAM & SNAPSHOT ---------------- */}
        {activeTab === "camera" && (
          <div className="space-y-3.5">
            {/* Live Camera Stream */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-amber-300">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>بث الكاميرا المباشر:</span>
                </span>
                {isScanningLive && (
                  <span className="text-[10px] text-emerald-400 font-mono">
                    جاري المسح المباشر ⚡
                  </span>
                )}
              </div>

              <div className="relative rounded-2xl overflow-hidden border-2 border-amber-400/60 bg-black min-h-[220px] flex items-center justify-center shadow-xl">
                <div id="login-camera-stream" className="w-full max-w-[320px]" />

                {isScanningLive && (
                  <div className="pointer-events-none absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_15px_#f59e0b] animate-pulse" />
                )}

                {!isScanningLive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center text-xs text-slate-300 bg-slate-950/90 space-y-3">
                    <Camera className="h-8 w-8 text-amber-400 animate-bounce" />
                    <p className="font-bold">الكاميرا جاهزة لبدء المسح</p>
                    <button
                      type="button"
                      onClick={startLiveScanner}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs active:scale-95 transition-all cursor-pointer shadow-md"
                    >
                      تشغيل الكاميرا 🎥
                    </button>
                  </div>
                )}
              </div>

              {isScanningLive && (
                <button
                  type="button"
                  onClick={stopLiveScanner}
                  className="w-full py-1.5 text-xs text-rose-400 hover:text-rose-300 font-bold bg-rose-950/40 rounded-xl cursor-pointer border border-rose-500/30"
                >
                  إيقاف الكاميرا ⏹️
                </button>
              )}
            </div>

            {/* Direct Snapshot and Gallery Buttons */}
            <div className="space-y-2 pt-1 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  sounds.playTap();
                  fileInputCameraRef.current?.click();
                }}
                disabled={isProcessingFile}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Camera className="h-5 w-5" />
                <span>
                  {isProcessingFile ? "جاري قراءة الرمز..." : "📸 التقاط صورة للكود بالكاميرا"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sounds.playTap();
                  fileInputGalleryRef.current?.click();
                }}
                disabled={isProcessingFile}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Upload className="h-4 w-4 text-sky-400" />
                <span>اختيار صورة كود من ألبوم الصور 🖼️</span>
              </button>
            </div>

            {cameraError && (
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs leading-relaxed space-y-1">
                <div className="font-bold flex items-center gap-1 text-amber-300">
                  <AlertCircle className="h-4 w-4" />
                  <span>تنبيه أمان المتصفح:</span>
                </div>
                <p>{cameraError}</p>
              </div>
            )}
          </div>
        )}

        {/* ---------------- OPTION 2: CODE ENTRY TAB ---------------- */}
        {activeTab === "code" && (
          <form onSubmit={handleManualSubmit} className="space-y-3 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300">
                أدخل كود الوصول المخصص لك:
              </label>
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="اكتب الكود هنا..."
                className="w-full h-12 px-4 text-center font-mono text-base font-black tracking-widest rounded-2xl bg-slate-950 border-2 border-slate-700 text-white placeholder:text-slate-600 placeholder:font-arabic placeholder:text-xs focus:outline-none focus:border-amber-400"
                autoFocus
              />
            </div>

            <button
              type="submit"
              className="w-full h-12 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 text-sm font-black shadow-lg shadow-amber-500/25 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 border border-amber-300/40"
            >
              <span>دخول النظام ⚡</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
