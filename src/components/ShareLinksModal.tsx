import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import {
  X,
  Copy,
  Check,
  Tv,
  ShieldCheck,
  ExternalLink,
  QrCode,
  Eye,
  EyeOff,
  Sparkles,
  Lock,
  Share2,
} from "lucide-react";
import { sounds } from "../utils/soundEffects";
import { meetingStore } from "../utils/meetingStore";

interface ShareLinksModalProps {
  onClose: () => void;
}

export const ShareLinksModal: React.FC<ShareLinksModalProps> = ({ onClose }) => {
  const [config, setConfig] = useState(meetingStore.getConfig());
  const [copiedType, setCopiedType] = useState<"public" | "admin" | null>(null);
  const [activeQrView, setActiveQrView] = useState<"public" | "admin" | null>(null);
  const [publicQrDataUrl, setPublicQrDataUrl] = useState<string>("");
  const [adminQrDataUrl, setAdminQrDataUrl] = useState<string>("");

  const baseUrl = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "";
  const publicUrl = `${baseUrl}?mode=public`;
  const adminUrl = `${baseUrl}?mode=admin`;

  useEffect(() => {
    QRCode.toDataURL(publicUrl, {
      width: 320,
      margin: 1,
      color: {
        dark: "#0F172A",
        light: "#FFFFFF",
      },
    })
      .then((url) => setPublicQrDataUrl(url))
      .catch((err) => console.error("Error generating public QR:", err));

    QRCode.toDataURL(adminUrl, {
      width: 320,
      margin: 1,
      color: {
        dark: "#78350F", // Amber dark
        light: "#FFFFFF",
      },
    })
      .then((url) => setAdminQrDataUrl(url))
      .catch((err) => console.error("Error generating admin QR:", err));
  }, [publicUrl, adminUrl]);

  const handleCopy = async (text: string, type: "public" | "admin") => {
    try {
      await navigator.clipboard.writeText(text);
      sounds.playVictory();
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2500);
    } catch {
      // Fallback
      const input = document.createElement("input");
      input.value = text;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      sounds.playVictory();
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2500);
    }
  };

  const handleToggleHideAdmin = async () => {
    sounds.playTap();
    const nextVal = !config.hideAdminButtonFromPublic;
    setConfig((prev) => ({ ...prev, hideAdminButtonFromPublic: nextVal }));
    await meetingStore.updateConfig({ hideAdminButtonFromPublic: nextVal });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200"
      dir="rtl"
    >
      <div className="relative w-full max-w-2xl rounded-3xl bg-[#0B132B] border border-slate-700/80 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-gradient-to-l from-slate-900 to-[#0B132B]">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/20">
              <Share2 className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white">
                فصل الروابط: شاشة الجمهور vs لوحة الخدام
              </h3>
              <p className="text-xs text-slate-400">
                خصص رابطاً مستقلاً لشاشة العرض والبروجيكتور ورابطاً خاصاً للخدام
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              sounds.playClose();
              onClose();
            }}
            className="h-9 w-9 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto">
          {/* LINK 1: Public Scoreboard (Projector / Screen / Attendees) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 to-sky-950/40 border border-sky-500/30 space-y-3 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
                  <Tv className="h-4 w-4" />
                </span>
                <div>
                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                    <span>1. رابط شاشة الجمهور والبروجيكتور</span>
                    <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[10px] font-bold border border-sky-500/30">
                      للعرض العام فقط
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    رابط نظيف ومثالي للعرض على الشاشات الكبيرة والبروجيكتور وللمشاركين لمتابعة النقاط لحظياً دون أزرار إدارية
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveQrView(activeQrView === "public" ? null : "public")}
                className="p-2 rounded-xl bg-slate-800 hover:bg-sky-600/80 text-sky-300 hover:text-white border border-sky-500/30 transition-all cursor-pointer text-xs flex items-center gap-1 font-bold"
                title="عرض QR Code لشاشة الجمهور"
              >
                <QrCode className="h-4 w-4" />
                <span className="hidden sm:inline">باركود QR</span>
              </button>
            </div>

            {/* URL Input Box + Action Buttons */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={publicUrl}
                className="flex-1 h-10 px-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-sky-200 font-mono select-all focus:outline-none"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => handleCopy(publicUrl, "public")}
                className={`h-10 px-4 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  copiedType === "public"
                    ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/25"
                    : "bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-md shadow-sky-500/20"
                }`}
              >
                {copiedType === "public" ? (
                  <>
                    <Check className="h-4 w-4 stroke-[3]" />
                    <span>تم النسخ!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>نسخ الرابط</span>
                  </>
                )}
              </button>

              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className="h-10 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center shrink-0 transition-all"
                title="فتح شاشة الجمهور في تبويب جديد للتجربة"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>

            {/* QR View if toggled */}
            {activeQrView === "public" && publicQrDataUrl && (
              <div className="p-4 rounded-xl bg-slate-950 border border-sky-500/30 flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in duration-200">
                <div className="p-2 bg-white rounded-xl shadow-lg shrink-0">
                  <img src={publicQrDataUrl} alt="Public Scoreboard QR" className="h-32 w-32 object-contain" />
                </div>
                <div className="text-center sm:text-right space-y-1">
                  <h5 className="text-xs font-black text-white">باركود شاشة العرض والجمهور 📱</h5>
                  <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed">
                    يمكن للمشاركين والشباب مسح هذا الرمز بكاميرا الهاتف لمتابعة لوحة الشرف ونقاط الفرق مباشرة من مقاعدهم!
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* LINK 2: Admin / Servants Dashboard */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 to-amber-950/40 border border-amber-500/30 space-y-3 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <div>
                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                    <span>2. رابط لوحة تحكم الخدام والإدارة</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                      خاص بالمسؤولين 🔒
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    رابط مباشر خاص بالخدام لرصد النقاط وتعديل التحدي اليومي وإدارة الفرق والفعاليات ومسح QR
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveQrView(activeQrView === "admin" ? null : "admin")}
                className="p-2 rounded-xl bg-slate-800 hover:bg-amber-600/80 text-amber-300 hover:text-white border border-amber-500/30 transition-all cursor-pointer text-xs flex items-center gap-1 font-bold"
                title="عرض QR Code للوحة الخدام"
              >
                <QrCode className="h-4 w-4" />
                <span className="hidden sm:inline">باركود QR</span>
              </button>
            </div>

            {/* URL Input Box + Action Buttons */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={adminUrl}
                className="flex-1 h-10 px-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-amber-200 font-mono select-all focus:outline-none"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => handleCopy(adminUrl, "admin")}
                className={`h-10 px-4 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  copiedType === "admin"
                    ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/25"
                    : "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20"
                }`}
              >
                {copiedType === "admin" ? (
                  <>
                    <Check className="h-4 w-4 stroke-[3]" />
                    <span>تم النسخ!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>نسخ الرابط</span>
                  </>
                )}
              </button>

              <a
                href={adminUrl}
                target="_blank"
                rel="noreferrer"
                className="h-10 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center shrink-0 transition-all"
                title="فتح لوحة الخدام في تبويب جديد"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>

            {/* QR View if toggled */}
            {activeQrView === "admin" && adminQrDataUrl && (
              <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in duration-200">
                <div className="p-2 bg-white rounded-xl shadow-lg shrink-0">
                  <img src={adminQrDataUrl} alt="Admin Dashboard QR" className="h-32 w-32 object-contain" />
                </div>
                <div className="text-center sm:text-right space-y-1">
                  <h5 className="text-xs font-black text-amber-300">باركود لوحة تحكم الخدام 🔐</h5>
                  <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed">
                    يقوم الخادم بمسح هذا الكود بهاتفه المحمول ليفتح لوحة التحكم فوراً ويرصد النقاط أثناء تحركه في القاعة!
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* TOGGLE: HIDE ADMIN BUTTON FROM PUBLIC SCOREBOARD */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                {config.hideAdminButtonFromPublic ? (
                  <EyeOff className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Eye className="h-4 w-4 text-slate-400" />
                )}
                <h4 className="text-xs sm:text-sm font-black text-white">
                  إخفاء زر لوحة التحكم من الشاشة العامة
                </h4>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {config.hideAdminButtonFromPublic
                  ? "✅ مفعّل: الزر مخفي تماماً عن الجمهور. لا يمكن الدخول للوحة التحكم إلا عبر رابط الخدام المباشر (?mode=admin)."
                  : "معطّل: يظهر زر «لوحة تحكم الخادم ⚙️» في رأس الصفحة للشاشات العامة."}
              </p>
            </div>

            <button
              type="button"
              onClick={handleToggleHideAdmin}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                config.hideAdminButtonFromPublic ? "bg-emerald-500" : "bg-slate-700"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  config.hideAdminButtonFromPublic ? "-translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Practical guide tips */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950/40 via-purple-950/30 to-indigo-950/40 border border-indigo-500/30 space-y-1.5 text-xs text-slate-300">
            <div className="font-bold text-indigo-300 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              <span>كيف تعمل منظومة الفصل في المؤتمرات والاجتماعات؟</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-400 pr-1">
              <li>
                <strong className="text-white">على جهاز العرض (البروجيكتور):</strong> افتح رابط الجمهور واضغط زر ملء الشاشة أو نمط البروجكتور.
              </li>
              <li>
                <strong className="text-white">على هواتف ولابتوبات الخدام:</strong> افتحوا رابط الخدام وسجلوا الدخول لرصد النقاط وتعديل التحديات.
              </li>
              <li>
                <strong className="text-white">المزامنة التلقائية:</strong> أي نقطة يرصدها الخادم من هاتفه تنعكس فوراً وفي نفس الثانية على شاشة البروجيكتور مع الصوت والاحتفال!
              </li>
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-900/60 flex items-center justify-end">
          <button
            type="button"
            onClick={() => {
              sounds.playClose();
              onClose();
            }}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
