import React, { useEffect, useState, useRef } from "react";
import QRCode from "qrcode";
import { X, QrCode, Download, Share2, Sparkles, Clock, CheckCircle } from "lucide-react";
import type { EventSession } from "../types";
import { sounds } from "../utils/soundEffects";

interface QRCodeModalProps {
  event: EventSession | null;
  onClose: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ event, onClose }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!event) return;
    QRCode.toDataURL(event.qrCode, {
      width: 320,
      margin: 2,
      color: {
        dark: "#0F172A",
        light: "#FFFFFF",
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error("Error generating QR:", err));
  }, [event]);

  if (!event) return null;

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(event.qrCode);
    sounds.playTap();
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadQR = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `QR_${event.title.replace(/\s+/g, "_")}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    sounds.playTap();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      dir="rtl"
    >
      <div className="relative w-full max-w-md rounded-3xl border border-slate-700 bg-[#0B132B] p-6 shadow-2xl text-slate-100 space-y-5">
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
        <div className="text-center space-y-1 pr-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-black">
            <QrCode className="h-4 w-4" />
            <span>رمز QR الفعالية لتسجيل الحضور</span>
          </div>
          <h3 className="text-lg font-black text-white">{event.title}</h3>
          <p className="text-xs text-slate-400">{event.description || "امسح الرمز لتسجيل الحضور واحتساب النقاط"}</p>
        </div>

        {/* QR Display Card */}
        <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-white shadow-inner">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt={event.title} className="w-56 h-56 rounded-xl object-contain shadow-sm" />
          ) : (
            <div className="w-56 h-56 flex items-center justify-center text-slate-800 font-bold">
              جاري توليد رمز الـ QR...
            </div>
          )}

          <div className="mt-3 text-center">
            <div className="text-xs text-slate-500 font-medium">كود الفعالية المشفّر:</div>
            <div className="font-mono text-slate-900 font-black text-base tracking-widest">{event.qrCode}</div>
          </div>
        </div>

        {/* Points Info Badges */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 text-center">
            <span className="text-[10px] text-slate-400 block">نقاط الحضور التلقائي</span>
            <span className="text-sm font-black text-emerald-400 font-mono">+{event.attendancePoints} XP</span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 text-center">
            <span className="text-[10px] text-slate-400 block">بونص الالتزام بالموعد</span>
            <span className="text-sm font-black text-amber-400 font-mono">+{event.punctualityBonusPoints} XP</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadQR}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>تحميل صورة الـ QR</span>
          </button>
          <button
            onClick={handleCopyCode}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition-all active:scale-95 cursor-pointer"
          >
            {copied ? <CheckCircle className="h-4 w-4 text-emerald-400" /> : <Share2 className="h-4 w-4" />}
            <span>{copied ? "تم النسخ!" : "نسخ كود الفعالية"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
