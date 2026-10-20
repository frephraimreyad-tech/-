import React, { useEffect, useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  X,
  Camera,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Users,
  QrCode,
  Clock,
  ShieldCheck,
  RefreshCw,
  Zap,
} from "lucide-react";
import type { CustomMember, EventSession, ProcessedMeetingTeam } from "../types";
import { meetingStore } from "../utils/meetingStore";
import { authStore, type SystemUser } from "../utils/authStore";
import { sounds } from "../utils/soundEffects";

interface QRScannerModalProps {
  onClose: () => void;
  defaultTeamId?: string;
  defaultMemberId?: string;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  onClose,
  defaultTeamId,
  defaultMemberId,
}) => {
  const [currentUser, setCurrentUser] = useState<SystemUser>(authStore.getCurrentUser());
  const data = meetingStore.getData();

  const [scanMode, setScanMode] = useState<"camera" | "code_select">("camera");
  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    defaultMemberId || ""
  );
  const [manualCode, setManualCode] = useState<string>("");
  const [isPunctual, setIsPunctual] = useState<boolean>(true);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [scanResult, setScanResult] = useState<{
    type: "success" | "error";
    title: string;
    message: string;
    points?: number;
  } | null>(null);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const unsub = authStore.subscribe(() => {
      setCurrentUser(authStore.getCurrentUser());
    });
    return unsub;
  }, []);

  // Filter members list based on logged-in user
  // If team leader, filter to their team members
  const availableMembers = React.useMemo(() => {
    if (currentUser.role === "leader" && currentUser.teamId) {
      return data.members.filter((m) => m.teamId === currentUser.teamId);
    }
    if (defaultTeamId) {
      return data.members.filter((m) => m.teamId === defaultTeamId);
    }
    return data.members;
  }, [data.members, currentUser, defaultTeamId]);

  // Set default selected member
  useEffect(() => {
    if (!selectedMemberId && availableMembers.length > 0) {
      setSelectedMemberId(availableMembers[0].id);
    }
  }, [availableMembers, selectedMemberId]);

  // Start Camera QR Scanner
  const startScanner = async () => {
    setCameraError(null);
    try {
      if (html5QrCodeRef.current) {
        try {
          await html5QrCodeRef.current.stop();
        } catch {}
      }

      const qr = new Html5Qrcode("qr-camera-stream");
      html5QrCodeRef.current = qr;

      setIsScanning(true);
      await qr.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          handleProcessQRCode(decodedText);
        },
        () => {
          // Frame scan error (ignore standard not found)
        }
      );
    } catch (err: any) {
      console.warn("Camera start error, falling back to selection mode:", err);
      setCameraError("تعذر تشغيل الكاميرا مباشرة. يمكنك اختيار الفعالية أو إدخال الكود أدناه.");
      setIsScanning(false);
      setScanMode("code_select");
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current = null;
      } catch {}
    }
    setIsScanning(false);
  };

  useEffect(() => {
    if (scanMode === "camera") {
      startScanner();
    } else {
      stopScanner();
    }
    return () => {
      stopScanner();
    };
  }, [scanMode]);

  const handleProcessQRCode = async (codeOrId: string) => {
    if (!selectedMemberId) {
      sounds.playClose();
      setScanResult({
        type: "error",
        title: "برجاء اختيار العضو",
        message: "حدد العضو المراد تسجيل حضوره أولاً قبل مسح الرمز.",
      });
      return;
    }

    const res = await meetingStore.recordQRAttendance({
      eventIdOrCode: codeOrId.trim(),
      memberId: selectedMemberId,
      isPunctual,
      executor: currentUser,
    });

    if (res.success) {
      sounds.playVictory();
      setScanResult({
        type: "success",
        title: "تم تسجيل الحضور واحتساب النقاط تلقائياً! 🎉",
        message: `تم تسجيل حضور العضو (${res.member?.name}) في [${res.event?.title}]. تم إضافة +${res.pointsAwarded} XP لرصيده ورصيد فريقه بنجاح!`,
        points: res.pointsAwarded,
      });
    } else {
      sounds.playClose();
      setScanResult({
        type: "error",
        title: "تعذر تسجيل الحضور",
        message: res.error || "تأكد من صلاحية كود الفعالية أو عدم تكرار التسجيل.",
      });
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleProcessQRCode(manualCode.trim());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
      dir="rtl"
    >
      <div className="relative w-full max-w-lg rounded-3xl border border-slate-700 bg-[#0B132B] p-5 sm:p-6 shadow-2xl text-slate-100 space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={() => {
            stopScanner();
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
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
              <Camera className="h-4 w-4" />
            </span>
            <h3 className="text-lg sm:text-xl font-black text-white">
              مسح QR لتسجيل حضور الفعالية 📱
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            المستخدم المنفذ:{" "}
            <span className="text-amber-300 font-bold">
              {currentUser.name} ({currentUser.roleLabel})
            </span>
          </p>
        </div>

        {/* Member Selector */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3.5 space-y-2">
          <label className="text-xs font-black text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-sky-400" />
              <span>اختر العضو المراد تسجيل حضوره:</span>
            </span>
            <span className="text-[11px] text-amber-400 font-mono font-normal">
              ({availableMembers.length} متاح)
            </span>
          </label>

          <select
            value={selectedMemberId}
            onChange={(e) => {
              setSelectedMemberId(e.target.value);
              setScanResult(null);
            }}
            className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs sm:text-sm font-bold text-white focus:outline-none focus:border-amber-400"
          >
            {availableMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} — رصيده: {m.points} XP {m.role === "leader" ? "👑 (قائد)" : ""}
              </option>
            ))}
          </select>

          {/* Punctuality Checkbox */}
          <label className="flex items-center gap-2 pt-1 text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isPunctual}
              onChange={(e) => setIsPunctual(e.target.checked)}
              className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 bg-slate-950 border-slate-700"
            />
            <span className="font-bold text-emerald-300 flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span>حضور مبكر والتزام في الموعد (احتساب بونص إضافي تلقائياً)</span>
            </span>
          </label>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => setScanMode("camera")}
            className={`flex-1 py-1.5 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              scanMode === "camera"
                ? "bg-amber-500 text-slate-950 shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Camera className="h-3.5 w-3.5" />
            <span>كاميرا الهاتف 📷</span>
          </button>
          <button
            type="button"
            onClick={() => setScanMode("code_select")}
            className={`flex-1 py-1.5 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              scanMode === "code_select"
                ? "bg-amber-500 text-slate-950 shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <QrCode className="h-3.5 w-3.5" />
            <span>اختيار الفعالية أو الكود 🎯</span>
          </button>
        </div>

        {/* CAMERA SCANNER AREA */}
        {scanMode === "camera" && (
          <div className="space-y-3">
            <div className="relative rounded-2xl overflow-hidden border-2 border-dashed border-amber-500/50 bg-black min-h-[220px] flex items-center justify-center">
              <div id="qr-camera-stream" className="w-full max-w-[320px]" />
              {!isScanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center text-xs text-slate-400 bg-black/60">
                  <p>اضغط لتشغيل الكاميرا ومسح كود الفعالية</p>
                  <button
                    onClick={startScanner}
                    className="mt-2 px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-black"
                  >
                    تشغيل الكاميرا
                  </button>
                </div>
              )}
            </div>
            <p className="text-[11px] text-center text-slate-400">
              وجّه الكاميرا نحو رمز QR الفعالية المعروض على الشاشة ليتم التسجيل فورياً.
            </p>
          </div>
        )}

        {/* CODE SELECT / ACTIVE EVENTS LIST */}
        {scanMode === "code_select" && (
          <div className="space-y-3">
            {cameraError && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                {cameraError}
              </div>
            )}

            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-300 block">
                الفعاليات النشطة حالياً (تسجيل فوري بضغطة زر):
              </span>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {data.events.map((evt) => (
                  <div
                    key={evt.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 transition-all gap-2"
                  >
                    <div className="overflow-hidden">
                      <div className="text-xs font-black text-white truncate">{evt.title}</div>
                      <div className="text-[10px] text-emerald-400 font-mono">
                        +{evt.attendancePoints} XP {isPunctual ? `(+${evt.punctualityBonusPoints} بونص)` : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleProcessQRCode(evt.qrCode)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black shrink-0 transition-all active:scale-95 cursor-pointer"
                    >
                      تسجيل الحضور ✨
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleManualSubmit} className="pt-2 flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="أو اكتب رمز الفعالية يدويًا..."
                className="flex-1 rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs hover:bg-amber-400 transition-all active:scale-95 cursor-pointer"
              >
                تحقق ورصد
              </button>
            </form>
          </div>
        )}

        {/* FEEDBACK RESULT ALERT */}
        {scanResult && (
          <div
            className={`p-4 rounded-2xl border space-y-1 animate-scaleIn ${
              scanResult.type === "success"
                ? "bg-emerald-950/80 border-emerald-500/60 text-emerald-200"
                : "bg-rose-950/80 border-rose-500/60 text-rose-200"
            }`}
          >
            <div className="flex items-center gap-2 font-black text-sm">
              {scanResult.type === "success" ? (
                <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
              )}
              <span>{scanResult.title}</span>
            </div>
            <p className="text-xs leading-relaxed opacity-90">{scanResult.message}</p>
          </div>
        )}

        {/* Security Rule Notice */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800 text-[10px] text-slate-400">
          <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>
            يتم التحقق تلقائياً من صحة الكود، ومنع تكرار الحضور للعضو في نفس الفعالية، مع توثيق العملية في سجل المراجعة.
          </span>
        </div>
      </div>
    </div>
  );
};
