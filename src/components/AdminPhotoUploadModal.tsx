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
} from "lucide-react";
import { authStore } from "../utils/authStore";
import { meetingStore } from "../utils/meetingStore";
import { sounds } from "../utils/soundEffects";

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

  const [uploadMode, setUploadMode] = useState<"file" | "url">("file");
  const [previewUrl, setPreviewUrl] = useState<string>(userToEdit.avatarUrl || "");
  const [urlInput, setUrlInput] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    sounds.playTap();
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 400;
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > maxDim) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          }
        } else {
          if (h > maxDim) {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL("image/jpeg", 0.85);
          setPreviewUrl(compressed);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleApplyUrl = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = urlInput.trim();
    if (!clean) return;
    setPreviewUrl(clean);
    sounds.playTap();
  };

  const handleSave = async () => {
    setIsSaving(true);
    sounds.playTap();

    try {
      if (userToEdit.id === "mem-1" || currentUser.role === "admin") {
        await meetingStore.updateAdminAvatar(previewUrl, currentUser);
      } else {
        await meetingStore.updateMember(userToEdit.id, { avatarUrl: previewUrl }, currentUser);
      }

      if (onSaved) {
        onSaved(previewUrl);
      }

      sounds.playVictory();
      setSuccessMsg("تم حفظ وتحديث الصورة بنجاح! ✨");
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (e) {
      console.error(e);
      sounds.playClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemovePhoto = () => {
    sounds.playTap();
    setPreviewUrl("");
    setUrlInput("");
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn font-arabic select-none"
      dir="rtl"
    >
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="relative w-full max-w-md rounded-3xl border border-slate-700 bg-[#0B132B] p-5 sm:p-7 shadow-2xl text-slate-100 space-y-4 text-center">
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
            تحديث صورة المستخدم 📷
          </h3>
          <p className="text-xs text-slate-400">
            اختر طريقة إضافة الصورة (تحميل من جهازك أو إدخال رابط مباشر)
          </p>
        </div>

        {/* Circular Avatar Preview */}
        <div className="relative flex justify-center py-1">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-amber-400 to-amber-600 rounded-full blur-xl opacity-60 animate-pulse" />
            <div className="relative h-28 w-28 sm:h-32 sm:w-32 rounded-full border-4 border-amber-400/90 bg-slate-900 p-1 shadow-2xl overflow-hidden flex items-center justify-center ring-4 ring-amber-500/20">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt={userToEdit.name}
                  className="h-full w-full object-cover rounded-full"
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
          <span className="text-xs text-amber-300 font-bold block">{userToEdit.roleLabel || "مستخدم مسجل"}</span>
        </div>

        {/* TWO MUTUALLY EXCLUSIVE CHOICES (TABS): LINK vs UPLOAD */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-2xl border border-slate-800">
            {/* Choice 1: Upload from Device */}
            <button
              type="button"
              onClick={() => {
                sounds.playTap();
                setUploadMode("file");
              }}
              className={`flex-1 py-2.5 px-3 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                uploadMode === "file"
                  ? "bg-amber-500 text-slate-950 shadow-md font-black"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <HardDrive className="h-4 w-4" />
              <span>تحميل من الجهاز 📁</span>
            </button>

            {/* Choice 2: Direct Link (URL) */}
            <button
              type="button"
              onClick={() => {
                sounds.playTap();
                setUploadMode("url");
              }}
              className={`flex-1 py-2.5 px-3 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                uploadMode === "url"
                  ? "bg-amber-500 text-slate-950 shadow-md font-black"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <LinkIcon className="h-4 w-4" />
              <span>رابط صورة (لينك) 🔗</span>
            </button>
          </div>

          {/* CHOICE 1 CONTAINER: Upload from Device */}
          {uploadMode === "file" && (
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2 animate-fadeIn">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs sm:text-sm shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Upload className="h-4 w-4" />
                <span>اختر صورة من الهاتف أو الكمبيوتر 📷</span>
              </button>
              <p className="text-[11px] text-slate-400">
                يدعم صيغ JPG و PNG و WebP مع ضغط وتحسين فوري للجودة
              </p>
            </div>
          )}

          {/* CHOICE 2 CONTAINER: Enter Link (URL) */}
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
              <p className="text-[11px] text-slate-400 text-right">
                يمكنك لصق أي رابط صورة عامة من جوجل درايف أو الإنترنت
              </p>
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
          disabled={isSaving}
          className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/25 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 border border-amber-300/40 disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          <span>{isSaving ? "جاري الحفظ..." : "حفظ وتثبيت الصورة ✨"}</span>
        </button>
      </div>
    </div>
  );
};
