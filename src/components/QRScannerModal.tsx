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
  Search,
  Upload,
  UserCheck,
  Check,
  Zap,
  Award,
} from "lucide-react";
import type { CustomMember, EventSession, ProcessedMeetingTeam } from "../types";
import { meetingStore } from "../utils/meetingStore";
import { authStore, type SystemUser } from "../utils/authStore";
import { sounds } from "../utils/soundEffects";
import { BonusGuideModal } from "./BonusGuideModal";

interface QRScannerModalProps {
  onClose: () => void;
  defaultTeamId?: string;
  defaultMemberId?: string;
  defaultEventId?: string;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  onClose,
  defaultTeamId,
  defaultMemberId,
  defaultEventId,
}) => {
  const [currentUser, setCurrentUser] = useState<SystemUser>(authStore.getCurrentUser());
  const data = meetingStore.getData();

  const [scanMode, setScanMode] = useState<"camera" | "code_select">("camera");
  const [selectedEventId, setSelectedEventId] = useState<string>(defaultEventId || "");
  const [selectedMemberId, setSelectedMemberId] = useState<string>(defaultMemberId || "");
  const [manualCode, setManualCode] = useState<string>("");
  const [memberSearchQuery, setMemberSearchQuery] = useState<string>("");
  const [isPunctual, setIsPunctual] = useState<boolean>(true);
  const [isScanningLive, setIsScanningLive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);
  const [manualBonusPoints, setManualBonusPoints] = useState<number | string>("");
  const [manualBonusReason, setManualBonusReason] = useState<string>("");
  const [showBonusGuide, setShowBonusGuide] = useState<boolean>(false);

  const [scanResult, setScanResult] = useState<{
    type: "success" | "error";
    title: string;
    message: string;
    points?: number;
  } | null>(null);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const fileInputCameraRef = useRef<HTMLInputElement | null>(null);
  const fileInputGalleryRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const unsub = authStore.subscribe(() => {
      setCurrentUser(authStore.getCurrentUser());
    });
    return unsub;
  }, []);

  // Filter members list based on logged-in user
  const availableMembers = React.useMemo(() => {
    if (currentUser.role === "leader" && currentUser.teamId) {
      return data.members.filter((m) => m.teamId === currentUser.teamId);
    }
    if (defaultTeamId) {
      return data.members.filter((m) => m.teamId === defaultTeamId);
    }
    return data.members;
  }, [data.members, currentUser, defaultTeamId]);

  // Auto-select the most recent active event if none provided
  useEffect(() => {
    if (!selectedEventId && data.events.length > 0) {
      const activeEvents = data.events.filter((e) => e.isActive);
      if (activeEvents.length > 0) {
        const latest = [...activeEvents].sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        )[0];
        setSelectedEventId(latest.id);
      } else {
        setSelectedEventId(data.events[0].id);
      }
    }
  }, [data.events, selectedEventId]);

  // Set default selected member if available and none selected yet
  useEffect(() => {
    if (!selectedMemberId && availableMembers.length > 0) {
      setSelectedMemberId(availableMembers[0].id);
    }
  }, [availableMembers, selectedMemberId]);

  // Currently selected Event object
  const currentEvent = React.useMemo(() => {
    return data.events.find((e) => e.id === selectedEventId) || data.events[0];
  }, [data.events, selectedEventId]);

  // Currently selected Member object
  const currentMember = React.useMemo(() => {
    return data.members.find((m) => m.id === selectedMemberId);
  }, [data.members, selectedMemberId]);

  // Attendance map for the currently selected event
  const attendedMemberIdsSet = React.useMemo(() => {
    if (!currentEvent || !data.attendance) return new Set<string>();
    return new Set(
      data.attendance
        .filter((a) => a.eventId === currentEvent.id)
        .map((a) => a.memberId)
    );
  }, [data.attendance, currentEvent]);

  // Filtered members list for quick check-in checklist
  const filteredChecklistMembers = React.useMemo(() => {
    const q = memberSearchQuery.trim().toLowerCase();
    if (!q) return availableMembers;
    return availableMembers.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.accessCode && m.accessCode.toLowerCase().includes(q)) ||
        (m.roleLabel && m.roleLabel.toLowerCase().includes(q))
    );
  }, [availableMembers, memberSearchQuery]);

  // Clean up Html5Qrcode instance
  const stopLiveScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn("Error stopping QR scanner:", e);
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

  useEffect(() => {
    if (scanMode === "camera") {
      const timer = setTimeout(() => {
        startLiveScanner();
      }, 300);
      return () => clearTimeout(timer);
    } else {
      stopLiveScanner();
    }
  }, [scanMode]);

  // Start Live Camera QR Stream
  const startLiveScanner = async () => {
    setCameraError(null);
    await stopLiveScanner();

    try {
      const qrRegion = document.getElementById("qr-camera-stream");
      if (!qrRegion) {
        setCameraError("عنصر الكاميرا غير جاهز بعد، يرجى المحاولة مرة أخرى.");
        return;
      }

      const qr = new Html5Qrcode("qr-camera-stream");
      html5QrCodeRef.current = qr;

      // Try environment facing camera first
      try {
        await qr.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 240, height: 240 },
          },
          (decodedText) => {
            handleProcessQRCode(decodedText);
          },
          () => {}
        );
        setIsScanningLive(true);
      } catch (envErr) {
        // Fallback to any available camera device
        console.warn("FacingMode environment failed, trying available cameras:", envErr);
        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 0) {
          const selectedCam = cameras[cameras.length - 1]; // usually rear camera
          await qr.start(
            selectedCam.id,
            {
              fps: 10,
              qrbox: { width: 240, height: 240 },
            },
            (decodedText) => {
              handleProcessQRCode(decodedText);
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
        "البث المباشر للكاميرا محظور بواسطة متصفح الهاتف أو سياسة الأمان. استخدم زر «التقاط صورة الكود بالكاميرا» أدناه، فهو يعمل بنسبة 100% على كافة الهواتف دون أذونات معقدة."
      );
    }
  };

  // Scan QR from File (Photo from camera or gallery)
  const handleScanImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setScanResult(null);
    setCameraError(null);

    try {
      // Ensure we have an Html5Qrcode instance
      let qr = html5QrCodeRef.current;
      if (!qr) {
        qr = new Html5Qrcode("qr-file-scan-hidden");
        html5QrCodeRef.current = qr;
      }

      const decodedText = await qr.scanFile(file, false);
      if (decodedText) {
        handleProcessQRCode(decodedText);
      } else {
        throw new Error("لم يتم العثور على رمز QR في الصورة");
      }
    } catch (err: any) {
      console.warn("File QR scan error:", err);
      sounds.playClose();
      setScanResult({
        type: "error",
        title: "تعذر قراءة الرمز من الصورة",
        message: "تأكد من وضوح رمز QR في الصورة الملتقطة وقربه الكافي من العدسة.",
      });
    } finally {
      setIsProcessingFile(false);
      // Reset input so same file can be captured again
      e.target.value = "";
    }
  };

  // Core Attendance Recording Processor
  const handleProcessQRCode = async (codeOrId: string) => {
    let processedCode = (codeOrId || "").trim();

    // If scanned code is a full URL, extract ?code= or &code=
    if (processedCode.includes("?code=") || processedCode.includes("&code=")) {
      try {
        const match = processedCode.match(/[?&]code=([^&#]+)/);
        if (match && match[1]) {
          processedCode = decodeURIComponent(match[1]).trim();
        }
      } catch {}
    }

    const targetEventId = selectedEventId || (currentEvent ? currentEvent.id : "");
    if (!targetEventId) {
      sounds.playClose();
      setScanResult({
        type: "error",
        title: "لم يتم اختيار الفعالية",
        message: "برجاء اختيار الفعالية من القائمة المنسدلة أولاً.",
      });
      return;
    }

    // Call meetingStore with optional manual bonus
    const parsedBonus = Number(manualBonusPoints) || 0;
    const res = await meetingStore.recordQRAttendance({
      eventIdOrCode: targetEventId,
      memberId: processedCode,
      isPunctual,
      executor: currentUser,
      manualBonusPoints: parsedBonus > 0 ? parsedBonus : undefined,
      manualBonusReason: parsedBonus > 0 ? (manualBonusReason.trim() || undefined) : undefined,
    });

    if (res.success) {
      sounds.playVictory();
      setScanResult({
        type: "success",
        title: "تم تسجيل الحضور بنجاح! 🎉",
        message: `العضو: ${res.member?.name} | الفعالية: ${res.event?.title}. تم إضافة +${res.pointsAwarded} XP لرصيده وللفريق.`,
        points: res.pointsAwarded,
      });

      // Clear input
      setManualCode("");
    } else {
      sounds.playClose();
      setScanResult({
        type: "error",
        title: "تعذر تسجيل الحضور",
        message: res.error || "تأكد من صحة كود العضو أو عدم تكرار تسجيله مسبقاً.",
      });
    }
  };

  // Direct 1-tap Attendance for a specific member
  const handleDirectRegisterMember = async (member: CustomMember) => {
    sounds.playTap();
    setScanResult(null);

    const targetEventId = selectedEventId || (currentEvent ? currentEvent.id : "");
    if (!targetEventId) {
      setScanResult({
        type: "error",
        title: "لم يتم تحديد الفعالية",
        message: "يرجى اختيار الفعالية أولاً.",
      });
      return;
    }

    const parsedBonus = Number(manualBonusPoints) || 0;
    const res = await meetingStore.recordQRAttendance({
      eventIdOrCode: targetEventId,
      memberId: member.id,
      isPunctual,
      executor: currentUser,
      manualBonusPoints: parsedBonus > 0 ? parsedBonus : undefined,
      manualBonusReason: parsedBonus > 0 ? (manualBonusReason.trim() || undefined) : undefined,
    });

    if (res.success) {
      sounds.playVictory();
      setScanResult({
        type: "success",
        title: "تم تسجيل الحضور بنجاح! 🎉",
        message: `العضو: ${res.member?.name} | الفعالية: ${res.event?.title}. تم رصد +${res.pointsAwarded} XP فوراً!`,
        points: res.pointsAwarded,
      });
    } else {
      sounds.playClose();
      setScanResult({
        type: "error",
        title: "فشل في التسجيل",
        message: res.error || "حدث خطأ أثناء رصد النقاط.",
      });
    }
  };

  const handleManualCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleProcessQRCode(manualCode.trim());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
      dir="rtl"
    >
      {/* Hidden container for file-based QR decoding */}
      <div id="qr-file-scan-hidden" className="hidden" />

      {/* Hidden native camera capture input (100% reliable on Android & iOS) */}
      <input
        ref={fileInputCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleScanImageFile}
      />

      {/* Hidden gallery file input */}
      <input
        ref={fileInputGalleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleScanImageFile}
      />

      <div className="relative w-full max-w-lg rounded-3xl border border-slate-700 bg-[#0B132B] p-4 sm:p-6 shadow-2xl text-slate-100 space-y-4 max-h-[92vh] overflow-y-auto">
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

        {/* Header */}
        <div className="space-y-1 pr-6">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400">
              <QrCode className="h-5 w-5" />
            </span>
            <h3 className="text-lg sm:text-xl font-black text-white">
              رصد الحضور وبونص الموعد 📱
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            المنفذ:{" "}
            <span className="text-amber-300 font-bold">
              {currentUser.name} ({currentUser.roleLabel})
            </span>
          </p>
        </div>

        {/* 1. Global Event Selector Card */}
        <div className="rounded-2xl border border-teal-500/30 bg-slate-900/90 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-teal-300 flex items-center gap-1.5">
              <QrCode className="h-4 w-4 text-teal-400" />
              <span>الفعالية المستهدفة لتسجيل الحضور:</span>
            </label>
            {currentEvent?.isActive ? (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[10px] font-black text-emerald-400">
                نشطة وتقبل الحضور
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-[10px] font-black text-rose-400">
                مغلقة
              </span>
            )}
          </div>

          <select
            value={selectedEventId}
            onChange={(e) => {
              sounds.playTap();
              setSelectedEventId(e.target.value);
              setScanResult(null);
            }}
            className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs sm:text-sm font-bold text-white focus:outline-none focus:border-teal-400 cursor-pointer"
          >
            {data.events.map((evt) => (
              <option key={evt.id} value={evt.id}>
                {evt.title} ({evt.isActive ? "نشطة" : "مغلقة"})
              </option>
            ))}
          </select>

          {/* Event Metadata & Automatic Punctuality Bonus Details */}
          {currentEvent && (
            <div className="flex items-center justify-between text-[11px] text-slate-300 pt-1 border-t border-slate-800/80 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-emerald-400 font-bold">
                  +{currentEvent.attendancePoints} XP حضور
                </span>
                {currentEvent.punctualityBonusPoints > 0 && (
                  <span className="font-mono text-amber-400 font-bold flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {currentEvent.startTime || "غير محدد"} (+{currentEvent.punctualityBonusPoints} XP بونص مبكر)
                  </span>
                )}
              </div>
              <span className="text-[10px] text-emerald-400/90 font-medium">
                ⚡ بونص الحضور المبكر يحتسب تلقائياً
              </span>
            </div>
          )}
        </div>

        {/* Optional Manual Bonus Card for Servants / Admins */}
        <div className="rounded-2xl border border-amber-500/30 bg-slate-900/80 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              <span>إضافة بونص يدوي فوري مع الحضور (اختياري للخادم):</span>
            </span>
            <button
              type="button"
              onClick={() => {
                sounds.playOpen();
                setShowBonusGuide(true);
              }}
              className="px-2.5 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500 hover:text-slate-950 text-amber-300 text-[11px] font-bold border border-amber-500/40 transition-all cursor-pointer flex items-center gap-1"
            >
              <Award className="h-3 w-3" />
              <span>دليل الدرجات 🎯</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { label: "بدون بونص (0)", val: 0, reason: "" },
              { label: "+15 (حفظ آية 📖)", val: 15, reason: "حفظ وتسميع آية الأسبوع" },
              { label: "+20 (إحضار إنجيل ✝️)", val: 20, reason: "إحضار الكتاب المقدس" },
              { label: "+30 (نشاط وتفاعل ⚡)", val: 30, reason: "مشاركة وتفاعل متميز" },
              { label: "+50 (إنجاز فائق 🌟)", val: 50, reason: "إنجاز روحي وخدمي استثنائي" },
            ].map((b) => {
              const isSelected =
                b.val === 0
                  ? !manualBonusPoints || Number(manualBonusPoints) === 0
                  : Number(manualBonusPoints) === b.val;
              return (
                <button
                  key={b.val}
                  type="button"
                  onClick={() => {
                    sounds.playTap();
                    if (b.val === 0) {
                      setManualBonusPoints("");
                      setManualBonusReason("");
                    } else {
                      setManualBonusPoints(b.val);
                      setManualBonusReason(b.reason);
                    }
                  }}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-amber-500 text-slate-950 border-amber-400 font-black shadow-sm"
                      : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                  }`}
                >
                  {b.label}
                </button>
              );
            })}
          </div>

          {Number(manualBonusPoints) > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="number"
                value={manualBonusPoints}
                onChange={(e) => setManualBonusPoints(e.target.value)}
                placeholder="XP"
                className="w-16 h-8 px-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono font-bold text-amber-300 text-center"
              />
              <input
                type="text"
                value={manualBonusReason}
                onChange={(e) => setManualBonusReason(e.target.value)}
                placeholder="سبب البونص (مثال: حفظ الآية، إحضار الإنجيل...)"
                className="flex-1 h-8 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
              />
              <button
                type="button"
                onClick={() => {
                  sounds.playTap();
                  setManualBonusPoints("");
                  setManualBonusReason("");
                }}
                className="px-2 py-1 rounded-lg text-[10px] text-slate-400 hover:text-rose-400 hover:bg-slate-800"
              >
                إلغاء
              </button>
            </div>
          )}
        </div>

        {/* FEEDBACK RESULT ALERT */}
        {scanResult && (
          <div
            className={`p-3.5 rounded-2xl border space-y-1 animate-scaleIn ${
              scanResult.type === "success"
                ? "bg-emerald-950/85 border-emerald-500/70 text-emerald-200"
                : "bg-rose-950/85 border-rose-500/70 text-rose-200"
            }`}
          >
            <div className="flex items-center gap-2 font-black text-xs sm:text-sm">
              {scanResult.type === "success" ? (
                <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
              )}
              <span>{scanResult.title}</span>
            </div>
            <p className="text-xs leading-relaxed opacity-95 pr-7">{scanResult.message}</p>
          </div>
        )}

        {/* Mode Switcher Tabs */}
        <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => {
              sounds.playTap();
              stopLiveScanner();
              setScanMode("code_select");
            }}
            className={`flex-1 py-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              scanMode === "code_select"
                ? "bg-amber-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Zap className="h-4 w-4" />
            <span>اختيار العضو أو الكود 🎯</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sounds.playTap();
              setScanMode("camera");
            }}
            className={`flex-1 py-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              scanMode === "camera"
                ? "bg-amber-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Camera className="h-4 w-4" />
            <span>كاميرا الهاتف 📷</span>
          </button>
        </div>

        {/* ---------------- SECTION 1: CODE & DIRECT SELECT TAB ---------------- */}
        {scanMode === "code_select" && (
          <div className="space-y-4">
            {/* Quick 1: Direct Button for Selected Member */}
            <div className="p-3.5 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-2.5">
              <label className="text-xs font-black text-sky-400 flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                <span>اختر عضواً وسجل حضوره فوراً:</span>
              </label>

              <div className="flex gap-2">
                <select
                  value={selectedMemberId}
                  onChange={(e) => {
                    sounds.playTap();
                    setSelectedMemberId(e.target.value);
                  }}
                  className="flex-1 rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs sm:text-sm font-bold text-white focus:outline-none focus:border-sky-400"
                >
                  <option value="">-- اختر العضو من القائمة --</option>
                  {availableMembers.map((m) => {
                    const isAttended = attendedMemberIdsSet.has(m.id);
                    return (
                      <option key={m.id} value={m.id}>
                        {isAttended ? "✅ " : "○ "}
                        {m.name} ({m.points} XP) {isAttended ? "- حاضر مسبقاً" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>

              {currentMember && (
                <div className="pt-1">
                  {attendedMemberIdsSet.has(currentMember.id) ? (
                    <div className="w-full py-2.5 px-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-black text-center flex items-center justify-center gap-1.5">
                      <Check className="h-4 w-4 text-emerald-400" />
                      <span>{currentMember.name} مسجل حضوره في هذه الفعالية مسبقاً ✅</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleDirectRegisterMember(currentMember)}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Sparkles className="h-4 w-4" />
                      <span>
                        تسجيل حضور «{currentMember.name}» الآن (+
                        {currentEvent?.attendancePoints || 30} XP)
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Quick 2: Manual Code Input (Card Code / TET6DD / URL) */}
            <div className="p-3.5 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-2">
              <label className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                <QrCode className="h-4 w-4" />
                <span>أو أدخل كود الكارنيه (المكتوب تحت QR) أو الصق الرابط:</span>
              </label>

              <form onSubmit={handleManualCodeSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="مثال: TET6DD أو 1234 أو كود العضو..."
                  className="flex-1 rounded-xl bg-slate-950 border border-slate-700 px-3 py-2.5 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400 font-mono tracking-wider"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all active:scale-95 cursor-pointer shadow-md shadow-amber-500/20 shrink-0"
                >
                  رصد بالكود 🎯
                </button>
              </form>
            </div>

            {/* Quick 3: Fast Member Checklist (Single-tap attendance for each person) */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">
                  قائمة تسجيل الحضور السريع بلمسة واحدة:
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {attendedMemberIdsSet.size} / {availableMembers.length} حاضرين
                </span>
              </div>

              {/* Search box */}
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={memberSearchQuery}
                  onChange={(e) => setMemberSearchQuery(e.target.value)}
                  placeholder="ابحث بالاسم لتسجيله سريعاً..."
                  className="w-full h-9 pr-9 pl-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-400"
                />
              </div>

              {/* Members List */}
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                {filteredChecklistMembers.map((member) => {
                  const isAttended = attendedMemberIdsSet.has(member.id);
                  const team = data.teams.find((t) => t.id === member.teamId);

                  return (
                    <div
                      key={member.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-all gap-2 ${
                        isAttended
                          ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-200"
                          : "bg-slate-900 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-white truncate">
                            {member.name}
                          </span>
                          {member.accessCode && (
                            <span className="px-1.5 py-0.5 rounded-md bg-slate-800 text-[10px] text-amber-300 font-mono">
                              {member.accessCode}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <span>{team?.name || "عام"}</span>
                          <span>•</span>
                          <span className="text-amber-400/90 font-mono">{member.points} XP</span>
                        </div>
                      </div>

                      {isAttended ? (
                        <span className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-black flex items-center gap-1 shrink-0">
                          <Check className="h-3.5 w-3.5" />
                          <span>حاضر ✅</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleDirectRegisterMember(member)}
                          className="px-3 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-black shrink-0 transition-all active:scale-95 cursor-pointer shadow-sm"
                        >
                          رصد الحضور ✨
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ---------------- SECTION 2: CAMERA TAB ---------------- */}
        {scanMode === "camera" && (
          <div className="space-y-4">
            {/* Live Camera Stream Container */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-amber-300">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>البث المباشر لكاميرا الهاتف:</span>
                </span>
                {isScanningLive && (
                  <span className="text-[10px] text-emerald-400 font-mono">
                    جاري المسح الفوري ⚡
                  </span>
                )}
              </div>

              <div className="relative rounded-2xl overflow-hidden border-2 border-amber-400/60 bg-black min-h-[220px] flex items-center justify-center shadow-xl">
                <div id="qr-camera-stream" className="w-full max-w-[320px]" />
                
                {/* Laser Scanning Finder Line when scanning live */}
                {isScanningLive && (
                  <div className="pointer-events-none absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_15px_#f59e0b] animate-pulse" />
                )}

                {!isScanningLive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center text-xs text-slate-300 bg-slate-950/90 space-y-3">
                    <Camera className="h-8 w-8 text-amber-400 animate-bounce" />
                    <p className="font-bold">البث المباشر للكاميرا جاهز للمسح</p>
                    <button
                      type="button"
                      onClick={startLiveScanner}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs active:scale-95 transition-all cursor-pointer shadow-md"
                    >
                      تشغيل البث المباشر للكاميرا 🎥
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
                  إيقاف البث المباشر ⏹️
                </button>
              )}
            </div>

            {/* Guaranteed 1-Tap Camera Capture & Gallery Upload Buttons */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 block">
                أو التقط صورة للرمز مباشرة من الكاميرا / المعرض:
              </span>

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
                  {isProcessingFile
                    ? "جاري قراءة الصورة..."
                    : "📸 التقاط صورة للكود بالكاميرا (Camera Snapshot)"}
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

        {/* Security Rule Notice */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800 text-[10px] text-slate-400">
          <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>
            يتم التحقق تلقائياً من منع تكرار الحضور للعضو في نفس الفعالية، واحتساب النقاط فورياً.
          </span>
        </div>

        {/* Bonus Guide Modal */}
        {showBonusGuide && (
          <BonusGuideModal
            onClose={() => setShowBonusGuide(false)}
            onSelectReason={(reason, points) => {
              setManualBonusPoints(points);
              setManualBonusReason(reason);
              setShowBonusGuide(false);
            }}
          />
        )}
      </div>
    </div>
  );
};
