import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Camera,
  Upload,
  Link,
  Sparkles,
  Check,
  Trash2,
  Image as ImageIcon,
  Shield,
  Crown,
  Flame,
  Award,
  Star,
  Zap,
} from "lucide-react";
import type { ProcessedMeetingTeam } from "../types";
import { meetingStore } from "../utils/meetingStore";
import { authStore } from "../utils/authStore";
import { sounds } from "../utils/soundEffects";

interface TeamPhotoModalProps {
  team: ProcessedMeetingTeam;
  onClose: () => void;
  onSuccess?: (message: string) => void;
}

// Pre-curated high-res graphic badge presets (SVGs / dynamic visual presets)
const PRESET_BADGES = [
  {
    id: "lion",
    title: "أسد مارمرقس الذهبي",
    category: "رموز روحية",
    url: "https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=400&auto=format&fit=crop&q=80",
    gradient: "from-amber-500 to-yellow-600",
  },
  {
    id: "eagle",
    title: "نسر يوحنا الحبيب",
    category: "رموز روحية",
    url: "https://images.unsplash.com/photo-1611689342806-0863700ce1e4?w=400&auto=format&fit=crop&q=80",
    gradient: "from-blue-600 to-indigo-800",
  },
  {
    id: "shield-knight",
    title: "سيف ودرع مارجرجس",
    category: "أبطال وشهداء",
    url: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=400&auto=format&fit=crop&q=80",
    gradient: "from-red-600 to-rose-800",
  },
  {
    id: "fire",
    title: "شعلة النهضة الروحية",
    category: "حماس وطاقة",
    url: "https://images.unsplash.com/photo-1517411032315-54ef2cb783bb?w=400&auto=format&fit=crop&q=80",
    gradient: "from-orange-500 to-amber-600",
  },
  {
    id: "crown",
    title: "تاج الصدارة والظفر",
    category: "بطولة",
    url: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&auto=format&fit=crop&q=80",
    gradient: "from-yellow-400 to-amber-600",
  },
  {
    id: "dove",
    title: "حمامة الروح القدس والسلام",
    category: "سلام ومحبة",
    url: "https://images.unsplash.com/photo-1522858547137-f1dcec554f55?w=400&auto=format&fit=crop&q=80",
    gradient: "from-sky-400 to-cyan-600",
  },
  {
    id: "star",
    title: "نجمة الصباح المنيرة",
    category: "إشراق",
    url: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&auto=format&fit=crop&q=80",
    gradient: "from-purple-500 to-pink-600",
  },
  {
    id: "mountain",
    title: "قمة جبل التحدي",
    category: "عزيمة",
    url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&auto=format&fit=crop&q=80",
    gradient: "from-emerald-500 to-teal-700",
  },
];

export const TeamPhotoModal: React.FC<TeamPhotoModalProps> = ({ team, onClose, onSuccess }) => {
  const [activeTab, setActiveTab] = useState<"upload" | "url" | "presets">("upload");
  const [photoPreview, setPhotoPreview] = useState<string>(team.avatarUrl || "");
  const [customUrl, setCustomUrl] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const currentUser = authStore.getCurrentUser();

  // Handle local file selection and compress image using Canvas
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMessage("يرجى اختيار ملف صورة صالح (JPG, PNG, WebP).");
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          // Compress and scale to max 400x400
          const canvas = document.createElement("canvas");
          const MAX_SIZE = 400;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_SIZE) {
              height = Math.round((height * MAX_SIZE) / width);
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width = Math.round((width * MAX_SIZE) / height);
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            throw new Error("فشل في معالجة أبعاد الصورة");
          }

          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL("image/webp", 0.85);

          setPhotoPreview(compressedDataUrl);
          setIsProcessing(false);
        } catch (err) {
          // Fallback to original data URL if canvas fails
          setPhotoPreview(event.target?.result as string);
          setIsProcessing(false);
        }
      };
      img.onerror = () => {
        setErrorMessage("تعذر قراءة الصورة المحددة. يرجى تجربة صورة أخرى.");
        setIsProcessing(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Handle saving the photo to the team record
  const handleSavePhoto = async () => {
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const res = await meetingStore.updateTeam(
        team.id,
        { avatarUrl: photoPreview.trim() },
        currentUser
      );

      if (res.success) {
        sounds.playSuccess();
        if (onSuccess) {
          onSuccess(
            photoPreview.trim()
              ? `تم تحديث الصورة التعريفية لفريق «${team.name}» بنجاح! 📸✨`
              : `تمت إزالة الصورة التعريفية والعودة للأيقونة الأصلية لفريق «${team.name}».`
          );
        }
        onClose();
      } else {
        setErrorMessage(res.error || "حدث خطأ أثناء حفظ الصورة");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "حدث خطأ غير متوقع");
    } finally {
      setIsProcessing(false);
    }
  };

  // Remove the photo
  const handleRemovePhoto = async () => {
    setPhotoPreview("");
    setIsProcessing(true);
    try {
      await meetingStore.updateTeam(team.id, { avatarUrl: "" }, currentUser);
      sounds.playSuccess();
      if (onSuccess) {
        onSuccess(`تمت إزالة الصورة التعريفية لفريق «${team.name}» بنجاح.`);
      }
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "فشل في إزالة الصورة");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md overflow-y-auto"
      dir="rtl"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-3xl bg-[#0C122C] border border-amber-500/30 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8),0_0_30px_rgba(245,158,11,0.15)] text-slate-100 overflow-hidden font-arabic flex flex-col"
      >
        {/* Top colorful gradient ribbon */}
        <div
          className="h-2 w-full shrink-0"
          style={{
            background: `linear-gradient(90deg, ${team.color}, #F59E0B, #10B981, ${team.color})`,
          }}
        />

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-2xl border shadow-inner text-2xl"
              style={{
                backgroundColor: `${team.color}25`,
                borderColor: `${team.color}60`,
              }}
            >
              {team.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white">
                  تحميل صورة تعريفية للفريق
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[11px] font-black border border-amber-400/30">
                  لوحة الشرف 🏆
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                تخصيص شعار وصورة فريق «<strong className="text-amber-300">{team.name}</strong>» بجانب اسمه ونقاطه
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Live Preview Card - Matches Top10Scoreboard layout */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span>معاينة حية للمظهر في لوحة الشرف الكبرى:</span>
            </label>

            <div
              className="relative flex items-center justify-between p-3.5 rounded-2xl border shadow-lg bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950"
              style={{
                borderRightWidth: "5px",
                borderRightColor: team.color,
                borderColor: `${team.color}44`,
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Team Avatar Preview */}
                <div
                  className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl overflow-hidden border-2 shadow-md"
                  style={{
                    borderColor: team.color || "#F59E0B",
                    boxShadow: `0 0 16px ${team.color}40`,
                  }}
                >
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt={team.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center text-2xl"
                      style={{ backgroundColor: `${team.color}25` }}
                    >
                      {team.icon}
                    </div>
                  )}
                  {photoPreview && (
                    <div className="absolute bottom-0 inset-x-0 bg-slate-950/75 py-0.5 text-center text-[8px] font-black text-amber-300">
                      شعار
                    </div>
                  )}
                </div>

                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 font-bold">
                      المركز #{team.rank}
                    </span>
                    <h4 className="text-base font-black text-white">{team.name}</h4>
                  </div>
                  <p className="text-[11px] text-amber-300/80 truncate max-w-[200px]">
                    {team.slogan ? `"${team.slogan}"` : `${team.membersCount} مشاركاً`}
                  </p>
                </div>
              </div>

              {/* XP display */}
              <div className="flex flex-col items-end" dir="ltr">
                <div className="flex items-baseline gap-1 text-amber-400 font-black text-lg">
                  <span className="text-xs font-bold text-amber-300/90 font-arabic">XP</span>
                  <span>{team.points.toLocaleString()}</span>
                </div>
                <span className="text-[9px] text-slate-400" dir="rtl">
                  مجموع النقاط
                </span>
              </div>
            </div>
          </div>

          {/* Tab Selection */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-950/80 border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab("upload")}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === "upload"
                  ? "bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Upload className="h-3.5 w-3.5" />
              <span>رفع من الجهاز</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("presets")}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === "presets"
                  ? "bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>شارات جاهزة</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("url")}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === "url"
                  ? "bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Link className="h-3.5 w-3.5" />
              <span>رابط صورة</span>
            </button>
          </div>

          {/* Tab 1: Upload from Device / Camera */}
          {activeTab === "upload" && (
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="group border-2 border-dashed border-slate-700 hover:border-amber-400 rounded-2xl p-6 flex flex-col items-center justify-center gap-2.5 bg-slate-900/40 hover:bg-slate-900/80 transition-all cursor-pointer text-center"
              >
                <div className="h-12 w-12 rounded-2xl bg-amber-500/10 group-hover:bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 transition-all">
                  <Camera className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-black text-white group-hover:text-amber-300 transition-colors">
                    انقر هنا لاختيار صورة من الكاميرا أو المعرض
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    يدعم صور JPG و PNG و WebP (يتم ضغط الصورة وتحسين أبعادها تلقائياً)
                  </p>
                </div>
                <button
                  type="button"
                  className="mt-1 px-4 py-1.5 rounded-xl bg-slate-800 group-hover:bg-amber-500 group-hover:text-slate-950 text-slate-300 text-xs font-bold transition-colors"
                >
                  استعراض الملفات 📁
                </button>
              </div>
            </div>
          )}

          {/* Tab 2: Preset Badges */}
          {activeTab === "presets" && (
            <div className="space-y-2">
              <p className="text-xs text-slate-400">
                اختر شارة احترافية عالية الجودة تتناسب مع هوية وروح الفريق:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {PRESET_BADGES.map((preset) => {
                  const isSelected = photoPreview === preset.url;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setPhotoPreview(preset.url)}
                      className={`relative flex flex-col items-center p-2 rounded-2xl border transition-all text-center group cursor-pointer ${
                        isSelected
                          ? "border-amber-400 bg-amber-500/15 ring-2 ring-amber-400/50 shadow-md shadow-amber-500/20"
                          : "border-slate-800 bg-slate-900/60 hover:border-slate-600 hover:bg-slate-900"
                      }`}
                    >
                      <div className="h-14 w-14 rounded-xl overflow-hidden border border-slate-700 mb-1.5 shadow-sm group-hover:scale-105 transition-transform">
                        <img
                          src={preset.url}
                          alt={preset.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="text-[11px] font-bold text-slate-200 group-hover:text-amber-300 leading-tight">
                        {preset.title}
                      </span>
                      <span className="text-[9px] text-slate-400 mt-0.5">{preset.category}</span>

                      {isSelected && (
                        <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow-xs">
                          <Check className="h-3 w-3 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 3: Direct URL */}
          {activeTab === "url" && (
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Link className="h-3.5 w-3.5 text-amber-400" />
                <span>أدخل رابط الصورة المباشر من الإنترنت:</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://example.com/team-logo.png"
                  className="flex-1 h-11 px-3.5 rounded-xl bg-slate-950 border border-slate-700 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (customUrl.trim()) {
                      setPhotoPreview(customUrl.trim());
                    }
                  }}
                  className="px-4 h-11 rounded-xl bg-amber-500 text-slate-950 text-xs font-black hover:bg-amber-400 transition-all cursor-pointer"
                >
                  معاينة
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                يمكنك استخدام روابط من Google Drive أو Imgur أو أي موقع استضافة صور عام.
              </p>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs font-bold">
              ⚠️ {errorMessage}
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800/80 bg-slate-950/80 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Delete Photo Button */}
          {team.avatarUrl ? (
            <button
              type="button"
              onClick={handleRemovePhoto}
              disabled={isProcessing}
              className="px-3.5 py-2.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-600/50 text-rose-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>إزالة الصورة والعودة للأيقونة</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all"
            >
              إلغاء
            </button>
          )}

          {/* Save / Apply Button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="hidden sm:inline-flex px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleSavePhoto}
              disabled={isProcessing || !photoPreview}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 text-xs sm:text-sm font-black shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <span>جاري الحفظ...</span>
              ) : (
                <>
                  <Check className="h-4 w-4 stroke-[3]" />
                  <span>تثبيت الصورة في لوحة الشرف</span>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
