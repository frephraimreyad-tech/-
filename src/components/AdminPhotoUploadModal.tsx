import React, { useState, useRef } from "react";
import {
  X,
  Camera,
  Upload,
  CheckCircle,
  Crown,
  Trash2,
  Sparkles,
  Link as LinkIcon,
  HardDrive,
  Image as ImageIcon,
  Smartphone,
  AlertCircle,
  RefreshCw,
  Star,
} from "lucide-react";
import { authStore } from "../utils/authStore";
import { meetingStore } from "../utils/meetingStore";
import { sounds } from "../utils/soundEffects";
import { compressImageFile } from "../utils/imageCompressor";

interface AdminPhotoUploadModalProps {
  onClose: () => void;
  targetUser?: {
    id: string;
    name: string;
    roleLabel?: string;
    avatarUrl?: string;
  };
  onSaved?: (newUrl: string) => void;
}

// 8 Ready-to-use youth and spiritual preset avatars
const PRESET_MEMBER_AVATARS = [
  {
    id: "st-mark",
    name: "مارمرقس الرسول",
    icon: "🦁",
    url: "https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=300&auto=format&fit=crop&q=80",
  },
  {
    id: "st-george",
    name: "مارجرجس البطل",
    icon: "⚔️",
    url: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=300&auto=format&fit=crop&q=80",
  },
  {
    id: "dove-spirit",
    name: "حمامة السلام",
    icon: "🕊️",
    url: "https://images.unsplash.com/photo-1522858547137-f1dcec554f55?w=300&auto=format&fit=crop&q=80",
  },
  {
    id: "holy-crown",
    name: "إكليل الظفر",
    icon: "👑",
    url: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300&auto=format&fit=crop&q=80",
  },
  {
    id: "eagle-john",
    name: "نسر يوحنا الحبيب",
    icon: "🦅",
    url: "https://images.unsplash.com/photo-1611689342806-0863700ce1e4?w=300&auto=format&fit=crop&q=80",
  },
  {
    id: "bright-star",
    name: "نجمة الصباح",
    icon: "🌟",
    url: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80",
  },
  {
    id: "divine-fire",
    name: "شعلة الخدمة",
    icon: "🔥",
    url: "https://images.unsplash.com/photo-1517411032315-54ef2cb783bb?w=300&auto=format&fit=crop&q=80",
  },
  {
    id: "holy-shield",
    name: "ترس الإيمان",
    icon: "🛡️",
    url: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300&auto=format&fit=crop&q=80",
  },
];

export const AdminPhotoUploadModal: React.FC<AdminPhotoUploadModalProps> = ({
  onClose,
  targetUser,
  onSaved,
}) => {
  const currentUser = authStore.getCurrentUser();
  const userToEdit = targetUser || {
    id: currentUser.id,
    name: currentUser.name,
    roleLabel: currentUser.roleLabel || "مدير النظام",
    avatarUrl: currentUser.avatarUrl,
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const [uploadMode, setUploadMode] = useState<"file" | "presets" | "url">("file");
  const [previewUrl, setPreviewUrl] = useState<string>(userToEdit.avatarUrl || "");
  const [urlInput, setUrlInput] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [compressedSizeBytes, setCompressedSizeBytes] = useState<number | null>(null);

  const processSelectedFile = async (file: File) => {
    setIsProcessing(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    sounds.playTap();

    try {
      // Compress with our universal image compressor (max 300x300, JPEG 0.8)
      const res = await compressImageFile(file, 300, 0.8);
      setPreviewUrl(res.dataUrl);
      setCompressedSizeBytes(res.sizeBytes);
      sounds.playVictory();
    } catch (err: any) {
      console.error("Compression error:", err);
      setErrorMsg(err?.message || "حدث خطأ أثناء معالجة الصورة. يرجى تجربة صورة أخرى.");
      sounds.playClose();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
    // Reset file input value so selecting the same file again still fires onChange
    e.target.value = "";
  };

  const handleApplyUrl = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = urlInput.trim();
    if (!clean) return;
    setPreviewUrl(clean);
    setCompressedSizeBytes(null);
    sounds.playTap();
  };

  const handleSelectPreset = (presetUrl: string) => {
    setPreviewUrl(presetUrl);
    setCompressedSizeBytes(null);
    sounds.playTap();
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMsg(null);
    sounds.playTap();

    try {
      if (userToEdit.id === "mem-1" || userToEdit.id === currentUser.id && userToEdit.roleLabel?.includes("مدير")) {
        await meetingStore.updateAdminAvatar(previewUrl, currentUser);
      }
      
      // Update member avatar in meeting store and firestore
      await meetingStore.updateMember(userToEdit.id, { avatarUrl: previewUrl }, currentUser);
      
      if (currentUser.id === userToEdit.id) {
        authStore.updateCurrentUserAvatar(previewUrl);
      }

      if (onSaved) {
        onSaved(previewUrl);
      }

      sounds.playVictory();
      setSuccessMsg("تم حفظ وتحديث الصورة بنجاح! ✨");
      setTimeout(() => {
        onClose();
      }, 1100);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e?.message || "تعذر حفظ الصورة في قاعدة البيانات");
      sounds.playClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemovePhoto = () => {
    sounds.playTap();
    setPreviewUrl("");
    setUrlInput("");
    setCompressedSizeBytes(null);
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn font-arabic select-none overflow-y-auto"
      dir="rtl"
    >
      {/* Hidden Gallery / File Input */}
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/*"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Hidden Mobile Camera Input */}
      <input
        type="file"
        accept="image/*"
        capture="user"
        ref={cameraInputRef}
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="relative w-full max-w-md rounded-3xl border border-slate-700 bg-[#0B132B] p-5 sm:p-6 shadow-2xl text-slate-100 space-y-4 text-center my-auto">
        {/* Close Button */}
        <button
          onClick={() => {
            sounds.playClose();
            onClose();
          }}
          className="absolute top-4 left-4 p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer z-10"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="space-y-1">
          <div className="inline-flex items-center justify-center p-2 rounded-2xl bg-amber-500/20 text-amber-400 mb-1">
            <Camera className="h-6 w-6" />
          </div>
          <h3 className="text-xl font-black text-white">
            تحديث صورة العضو 📷
          </h3>
          <p className="text-xs text-slate-400">
            رفع مباشر من كاميرا الموبايل أو ألبوم الصور أو الكمبيوتر
          </p>
        </div>

        {/* Circular Avatar Preview */}
        <div className="relative flex justify-center py-1">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-amber-400 to-amber-600 rounded-full blur-xl opacity-60 animate-pulse" />
            <div className="relative h-28 w-28 sm:h-32 sm:w-32 rounded-full border-4 border-amber-400/90 bg-slate-900 p-1 shadow-2xl overflow-hidden flex items-center justify-center ring-4 ring-amber-500/20">
              {isProcessing ? (
                <div className="flex flex-col items-center justify-center text-amber-400 space-y-1">
                  <RefreshCw className="h-7 w-7 animate-spin" />
                  <span className="text-[10px] font-bold">جاري المعالجة...</span>
                </div>
              ) : previewUrl ? (
                <img
                  src={previewUrl}
                  alt={userToEdit.name}
                  className="h-full w-full object-cover rounded-full"
                  onError={() => {
                    setErrorMsg("تعذر تحميل الرابط المباشر، تأكد من صحة الرابط أو ارفع ملف من جهازك");
                  }}
                />
              ) : (
                <div className="h-full w-full rounded-full bg-gradient-to-tr from-amber-500 via-amber-400 to-orange-500 flex items-center justify-center text-slate-950 font-black text-4xl shadow-inner">
                  {userToEdit.name.charAt(0)}
                </div>
              )}
            </div>

            {/* Crown badge */}
            <div className="absolute -bottom-1 -left-1 bg-amber-500 text-slate-950 rounded-full p-2 border-2 border-slate-950 shadow-lg">
              <Crown className="h-4 w-4 fill-slate-950" />
            </div>
          </div>
        </div>

        {/* User Info Card */}
        <div className="space-y-0.5">
          <span className="text-base font-black text-white">{userToEdit.name}</span>
          <span className="text-xs text-amber-300 font-bold block">{userToEdit.roleLabel || "عضو مسجل"}</span>
          {compressedSizeBytes && (
            <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold border border-emerald-500/30">
              تم الضغط بنجاح: {Math.round(compressedSizeBytes / 1024)} KB ⚡
            </span>
          )}
        </div>

        {/* TABS: DEVICE UPLOAD vs PRESET BADGES vs URL */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center gap-1.5 bg-slate-900 p-1.5 rounded-2xl border border-slate-800">
            {/* Tab 1: Upload from Mobile / PC */}
            <button
              type="button"
              onClick={() => {
                sounds.playTap();
                setUploadMode("file");
              }}
              className={`flex-1 py-2 px-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                uploadMode === "file"
                  ? "bg-amber-500 text-slate-950 shadow-md font-black"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span>من الجهاز 📱</span>
            </button>

            {/* Tab 2: Spiritual Presets */}
            <button
              type="button"
              onClick={() => {
                sounds.playTap();
                setUploadMode("presets");
              }}
              className={`flex-1 py-2 px-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                uploadMode === "presets"
                  ? "bg-amber-500 text-slate-950 shadow-md font-black"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Star className="h-3.5 w-3.5" />
              <span>رموز جاهزة ⭐</span>
            </button>

            {/* Tab 3: Direct Link (URL) */}
            <button
              type="button"
              onClick={() => {
                sounds.playTap();
                setUploadMode("url");
              }}
              className={`flex-1 py-2 px-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                uploadMode === "url"
                  ? "bg-amber-500 text-slate-950 shadow-md font-black"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <LinkIcon className="h-3.5 w-3.5" />
              <span>رابط 🔗</span>
            </button>
          </div>

          {/* TAB 1 CONTAINER: Upload from Device & Camera */}
          {uploadMode === "file" && (
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Mobile Camera direct button */}
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={isProcessing}
                  className="w-full py-3 px-3 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-black text-xs shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 border border-sky-400/30 disabled:opacity-50"
                >
                  <Camera className="h-4 w-4" />
                  <span>التقاط بالكاميرا 📸</span>
                </button>

                {/* Photo Gallery / Files button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  className="w-full py-3 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 border border-amber-300/30 disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" />
                  <span>ألبوم الصور / الملفات 🖼️</span>
                </button>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                يدعم كافة الصور من كاميرا الهاتف (آيفون وأندرويد) مع ضغط تلقائي ذكي لسرعة التحميل.
              </p>
            </div>
          )}

          {/* TAB 2 CONTAINER: Preset Badges */}
          {uploadMode === "presets" && (
            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2.5 animate-fadeIn">
              <span className="text-xs font-bold text-slate-300 block text-right">
                اختر رمزاً أو أيقونة روحية جاهزة للعضو بضغطة واحدة:
              </span>
              <div className="grid grid-cols-4 gap-2">
                {PRESET_MEMBER_AVATARS.map((preset) => {
                  const isSelected = previewUrl === preset.url;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset.url)}
                      className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                        isSelected
                          ? "bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/40 scale-105"
                          : "bg-slate-950 border-slate-800 hover:border-slate-700"
                      }`}
                      title={preset.name}
                    >
                      <span className="text-xl">{preset.icon}</span>
                      <span className="text-[10px] font-bold text-slate-300 truncate w-full text-center">
                        {preset.name.split(" ")[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3 CONTAINER: Enter Link (URL) */}
          {uploadMode === "url" && (
            <form onSubmit={handleApplyUrl} className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2.5 animate-fadeIn">
              <label className="text-xs font-bold text-slate-300 block text-right">
                أدخل رابط الصورة المباشر (Link / URL):
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/photo.jpg"
                  className="flex-1 h-11 px-3.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  className="px-4 h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold border border-slate-700 cursor-pointer active:scale-95"
                >
                  معاينة 🔍
                </button>
              </div>
            </form>
          )}

          {previewUrl && (
            <button
              type="button"
              onClick={handleRemovePhoto}
              className="text-xs text-rose-400 hover:text-rose-300 flex items-center justify-center gap-1 mx-auto pt-1 cursor-pointer transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>إزالة الصورة الحالية</span>
            </button>
          )}
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3 rounded-2xl bg-rose-950/90 border border-rose-500/60 text-rose-200 text-xs font-bold flex items-center gap-2 text-right">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div className="p-3 rounded-2xl bg-emerald-950/90 border border-emerald-500/60 text-emerald-200 text-xs font-bold flex items-center justify-center gap-2 animate-bounce">
            <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Action Save Button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || isProcessing}
          className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/25 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 border border-amber-300/40 disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          <span>{isSaving ? "جاري الحفظ والتثبيت..." : "حفظ وتثبيت الصورة ✨"}</span>
        </button>
      </div>
    </div>
  );
};
