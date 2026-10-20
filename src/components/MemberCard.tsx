import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { X, Download, Printer, User, Shield, CreditCard } from "lucide-react";
import type { CustomMember, CustomTeam } from "../types";
import { sounds } from "../utils/soundEffects";

interface MemberCardProps {
  member: CustomMember;
  team: CustomTeam | undefined;
  onClose: () => void;
}

export const MemberCard: React.FC<MemberCardProps> = ({ member, team, onClose }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    // Generate a full URL that includes the access code as a query parameter
    const baseUrl = window.location.origin + window.location.pathname;
    const loginUrl = `${baseUrl}?code=${member.accessCode}`;

    QRCode.toDataURL(loginUrl, {
      width: 200,
      margin: 1,
      color: {
        dark: "#0F172A",
        light: "#FFFFFF",
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error("Error generating member QR:", err));
  }, [member.accessCode]);

  const handleDownloadCard = () => {
    // This is a simplified download. In a real app, we'd use html2canvas or similar.
    // For now, we'll suggest printing.
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-lg animate-in fade-in duration-300">
      <div className="relative w-full max-w-lg space-y-6">
        {/* Close Button */}
        <button
          onClick={() => {
            sounds.playClose();
            onClose();
          }}
          className="absolute -top-12 right-0 p-2 rounded-full bg-slate-800 hover:bg-rose-600 text-white transition-all cursor-pointer"
        >
          <X className="h-6 w-6" />
        </button>

        {/* The Card itself */}
        <div 
          id="member-id-card"
          className="relative w-full aspect-[1.58/1] max-w-[450px] mx-auto rounded-[24px] overflow-hidden shadow-2xl bg-white text-slate-900 border-2 border-slate-200 print:shadow-none print:border-none"
          dir="rtl"
        >
          {/* Top accent color bar */}
          <div 
            className="h-3 w-full" 
            style={{ backgroundColor: team?.color || "#3B82F6" }}
          />

          <div className="p-6 h-full flex flex-col justify-between">
            {/* Header Area */}
            <div className="flex justify-between items-start">
              <div className="space-y-0.5">
                <h2 className="text-xl font-black tracking-tight text-slate-900 leading-tight">
                  كارنيه عضوية
                </h2>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Member Identity Card
                </p>
              </div>
              <div className="text-left">
                <span className="text-2xl">{team?.icon || "🛡️"}</span>
                <div className="text-[11px] font-black" style={{ color: team?.color || "#3B82F6" }}>
                  {team?.name || "بدون فريق"}
                </div>
              </div>
            </div>

            {/* Main Content: Photo & Info */}
            <div className="flex items-center gap-6 mt-4">
              {/* Photo placeholder or Avatar */}
              <div className="relative shrink-0">
                <div className="w-28 h-28 rounded-2xl bg-slate-100 border-2 border-slate-200 overflow-hidden flex items-center justify-center shadow-inner">
                  {member.avatarUrl ? (
                    <img 
                      src={member.avatarUrl} 
                      alt={member.name} 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "";
                        (e.target as HTMLImageElement).classList.add("hidden");
                      }}
                    />
                  ) : (
                    <User className="h-12 w-12 text-slate-300" />
                  )}
                </div>
                {/* Role Badge on photo */}
                <div 
                  className="absolute -bottom-2 -right-2 px-2.5 py-0.5 rounded-lg text-[9px] font-black text-white shadow-md"
                  style={{ backgroundColor: team?.color || "#3B82F6" }}
                >
                  {member.roleLabel || "مشارك"}
                </div>
              </div>

              {/* Personal Info */}
              <div className="flex-1 space-y-3">
                <div>
                  <label className="text-[9px] font-bold text-slate-400 block mb-0.5">الاسم بالكامل:</label>
                  <div className="text-lg font-black text-slate-900 truncate">
                    {member.name}
                  </div>
                </div>

                <div className="flex gap-4">
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 block mb-0.5">كود الوصول:</label>
                    <div className="font-mono text-sm font-black text-slate-900 tracking-widest bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                      {member.accessCode}
                    </div>
                  </div>
                  {member.phone && (
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 block mb-0.5">الهاتف:</label>
                      <div className="font-mono text-[11px] font-bold text-slate-600">
                        {member.phone}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* QR Code */}
              <div className="shrink-0 flex flex-col items-center gap-1">
                <div className="p-1.5 bg-white border border-slate-200 rounded-xl shadow-sm">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="QR Code" className="w-16 h-16" />
                  ) : (
                    <div className="w-16 h-16 bg-slate-50 animate-pulse" />
                  )}
                </div>
                <span className="text-[8px] font-black text-slate-400">SCAN TO SYNC</span>
              </div>
            </div>

            {/* Bottom Footer bar */}
            <div className="mt-auto pt-3 border-t border-slate-100 flex justify-between items-center text-[9px] font-bold text-slate-400">
              <div className="flex items-center gap-1">
                <Shield className="h-2.5 w-2.5" />
                <span>نظام إدارة الاجتماع التفاعلي</span>
              </div>
              <div className="font-mono">ID: {member.id.split("-")[1] || member.id.slice(-6)}</div>
            </div>
          </div>
        </div>

        {/* Actions Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={handleDownloadCard}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/20 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
          >
            <Printer className="h-5 w-5" />
            <span>طباعة الكارنيه 🖨️</span>
          </button>
          
          <button
            onClick={() => {
              sounds.playTap();
              onClose();
            }}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm border border-slate-700 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
          >
            <CreditCard className="h-5 w-5" />
            <span>إغلاق المعاينة</span>
          </button>
        </div>

        <p className="text-center text-slate-500 text-xs font-medium">
          ملاحظة: لطباعة الكارنيه بشكل صحيح، تأكد من تفعيل "خلفية الرسوم" في إعدادات الطباعة.
        </p>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #member-id-card, #member-id-card * {
            visibility: visible;
          }
          #member-id-card {
            position: fixed;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            width: 85mm;
            height: 54mm;
            border: none !important;
            box-shadow: none !important;
            border-radius: 5mm !important;
          }
          @page {
            size: auto;
            margin: 0;
          }
        }
      `}} />
    </div>
  );
};
