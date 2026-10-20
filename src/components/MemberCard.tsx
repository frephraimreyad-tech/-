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
      width: 400,
      margin: 1,
      color: {
        dark: "#1E1B4B", // Deep indigo matching the card
        light: "#FFFFFF",
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error("Error generating member QR:", err));
  }, [member.accessCode]);

  const handlePrint = () => {
    sounds.playTap();
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-in fade-in duration-500 print:bg-white print:p-0">
      <div className="relative w-full max-w-[340px] overflow-hidden rounded-[2rem] bg-white shadow-2xl animate-in zoom-in-95 duration-500 print:shadow-none print:rounded-none">
        {/* Close Button (Hidden on Print) */}
        <button
          onClick={() => {
            sounds.playClose();
            onClose();
          }}
          className="absolute top-4 left-4 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-all cursor-pointer z-10 print:hidden"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Card Content Area */}
        <div 
          id="printable-card" 
          className="relative flex flex-col items-center p-6 space-y-5 text-center min-h-[520px] bg-white"
          dir="rtl"
        >
          {/* Header Branding - Youth Meeting 2026 */}
          <div className="w-full flex justify-center pt-2">
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1.5 mb-1">
                 <span className="text-indigo-950 font-black tracking-[0.1em] text-xs uppercase">Youth Meeting</span>
                 <div className="h-1 w-1 rounded-full bg-amber-500"></div>
                 <span className="text-indigo-950 font-black text-xs uppercase">اجتماع الشباب</span>
              </div>
              
              <div className="relative mt-0.5">
                <span className="text-3xl font-black text-indigo-950 italic tracking-tighter">
                  اجتماع الشباب
                </span>
                <div className="absolute -top-1 -right-3 flex gap-1">
                   <div className="h-1.5 w-1.5 rounded-full bg-amber-500"></div>
                   <div className="h-1 w-1 rounded-full bg-purple-600"></div>
                </div>
                <div className="flex items-center justify-center -mt-1.5">
                   <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-800 via-purple-700 to-amber-600 italic">2026</span>
                </div>
              </div>
            </div>
          </div>

          {/* QR Code Container */}
          <div className="relative group mt-4">
            <div className="absolute -inset-4 bg-gradient-to-br from-indigo-500 via-purple-500 to-amber-500 rounded-[2rem] opacity-10 blur-xl group-hover:opacity-20 transition-opacity"></div>
            <div className="relative bg-white p-2.5 rounded-xl border border-slate-200 shadow-[0_5px_20px_rgba(0,0,0,0.06)]">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR Code" className="w-40 h-40 sm:w-44 sm:h-44" />
              ) : (
                <div className="w-40 h-40 bg-slate-50 animate-pulse rounded-lg" />
              )}
            </div>
          </div>

          {/* Access Code Display */}
          <div className="space-y-0.5">
            <div className="text-3xl font-black text-indigo-950 tracking-[0.25em] uppercase font-mono">
              {member.accessCode}
            </div>
            <div className="h-0.5 w-12 bg-amber-500 mx-auto rounded-full"></div>
          </div>

          {/* Member Name and Team */}
          <div className="space-y-2 pt-1">
            <h2 className="text-xl font-black text-slate-950 leading-tight">{member.name}</h2>
            <div className="flex items-center justify-center gap-2">
              <span className="px-3 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-black flex items-center gap-1.5 border border-slate-200">
                <span className="text-base">{team?.icon || "🛡️"}</span>
                {team?.name || "فريق عام"}
              </span>
              <span className="px-3 py-1 rounded-xl bg-indigo-50 text-indigo-700 text-[10px] font-black border border-indigo-100 uppercase tracking-wider">
                {member.roleLabel || "Member"}
              </span>
            </div>
          </div>

          {/* Arabic Slogan - "نُبْنَى... فَنَبْنِي" */}
          <div className="pt-2 w-full">
            <div className="text-2xl font-arabic font-black text-indigo-950 opacity-100 italic">
              نُبْنَى... فَنَبْنِي
            </div>
          </div>

          {/* Bottom Graphics - Colorful Waves */}
          <div className="absolute bottom-0 left-0 right-0 h-24 overflow-hidden pointer-events-none rounded-b-[2.5rem]">
            <svg viewBox="0 0 400 100" className="absolute bottom-0 w-full h-full preserve-3d" preserveAspectRatio="none">
              <path d="M0 100 C 150 0 250 150 400 100 L 400 100 L 0 100 Z" fill="#F59E0B" opacity="0.3"></path>
              <path d="M0 100 C 100 20 300 80 400 100 L 400 100 L 0 100 Z" fill="#7C3AED" opacity="0.3"></path>
              <path d="M0 100 C 50 50 150 20 400 100 L 400 100 L 0 100 Z" fill="#4F46E5" opacity="0.4"></path>
            </svg>
            <div className="absolute bottom-0 left-0 right-0 h-2 flex">
              <div className="flex-1 bg-indigo-700"></div>
              <div className="flex-1 bg-purple-600"></div>
              <div className="flex-1 bg-amber-500"></div>
              <div className="flex-1 bg-sky-500"></div>
            </div>
          </div>
        </div>

        {/* Action Bar (Hidden on Print) */}
        <div className="relative p-6 bg-slate-50 border-t border-slate-100 flex items-center gap-3 print:hidden z-20">
          <button
            onClick={handlePrint}
            className="flex-1 h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            <span>طباعة الكارنيه 🖨️</span>
          </button>
          <button
            onClick={() => {
              sounds.playClose();
              onClose();
            }}
            className="px-6 h-12 rounded-2xl bg-white border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #printable-card, #printable-card * {
            visibility: visible;
          }
          #printable-card {
            position: fixed;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            width: 75mm;
            height: 110mm;
            border: none !important;
            box-shadow: none !important;
            padding: 8mm;
            background: white !important;
          }
          @page {
            size: portrait;
            margin: 0;
          }
        }
      `}} />
    </div>
  );
};
