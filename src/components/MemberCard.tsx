import React, { useEffect, useState, useRef } from "react";
import QRCode from "qrcode";
import { X, Printer, User, Shield, CreditCard, Award, BadgeCheck, Download, Image as ImageIcon } from "lucide-react";
import type { CustomMember, CustomTeam, RoleType } from "../types";
import { sounds } from "../utils/soundEffects";
import { toPng } from "html-to-image";

interface MemberCardProps {
  member: CustomMember;
  team: CustomTeam | undefined;
  onClose: () => void;
}

export const MemberCard: React.FC<MemberCardProps> = ({ member, team, onClose }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Determine role-based theme color
  const getRoleTheme = (role: RoleType) => {
    switch (role) {
      case "admin":
      case "priest":
        return {
          primary: "#7C3AED", // Indigo/Purple
          secondary: "#DDD6FE",
          accent: "#C4B5FD",
          label: "المسؤول العام",
          icon: <Shield className="h-4 w-4" />,
        };
      case "leader":
        return {
          primary: "#D97706", // Amber
          secondary: "#FEF3C7",
          accent: "#FCD34D",
          label: "قائد مجموعة",
          icon: <Award className="h-4 w-4" />,
        };
      case "servant":
        return {
          primary: "#2563EB", // Blue
          secondary: "#DBEAFE",
          accent: "#93C5FD",
          label: "خادم",
          icon: <BadgeCheck className="h-4 w-4" />,
        };
      default:
        return {
          primary: "#059669", // Emerald
          secondary: "#D1FAE5",
          accent: "#6EE7B7",
          label: "عضو مشارك",
          icon: <User className="h-4 w-4" />,
        };
    }
  };

  const theme = getRoleTheme(member.role);

  useEffect(() => {
    const baseUrl = window.location.origin + window.location.pathname;
    const loginUrl = `${baseUrl}?code=${member.accessCode}`;

    QRCode.toDataURL(loginUrl, {
      width: 400,
      margin: 1,
      color: {
        dark: "#0F172A", // Slate 900 for maximum contrast
        light: "#FFFFFF",
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error("Error generating member QR:", err));
  }, [member.accessCode]);

  const handlePrint = () => {
    sounds.playTap();
    // Use a small timeout to ensure the UI is ready
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleExportImage = async () => {
    if (!cardRef.current) return;
    sounds.playTap();
    setIsExporting(true);
    
    try {
      // Small delay to ensure everything is rendered
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        backgroundColor: '#FFFFFF',
        width: 350,
        height: 500,
        style: {
           transform: 'scale(1)',
           transformOrigin: 'top left'
        }
      });
      
      const link = document.createElement('a');
      link.download = `card-${member.name.replace(/\s+/g, '-')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-in fade-in duration-500 print:bg-white print:p-0">
      <div className="relative w-full max-w-[350px] overflow-hidden rounded-[2rem] bg-white shadow-2xl animate-in zoom-in-95 duration-500 print:shadow-none print:rounded-none print:w-full">
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
          ref={cardRef}
          id="printable-card" 
          className="relative flex flex-col items-center overflow-hidden min-h-[500px] bg-white"
          dir="rtl"
        >
          {/* Top Decorative Header */}
          <div 
            className="w-full h-28 relative flex flex-col items-center justify-center p-6 text-white text-center"
            style={{ backgroundColor: theme.primary }}
          >
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,white_1px,transparent_1px)] bg-[size:10px_10px]" />
            <div className="relative z-10 space-y-0.5">
               <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 leading-none">Youth Meeting 2026</div>
               <h1 className="text-xl font-black italic tracking-tighter">اجتماع الشباب ٢٠٢٦</h1>
            </div>
            
            {/* Wave Divider */}
            <div className="absolute -bottom-1 left-0 right-0 h-6">
               <svg viewBox="0 0 1440 320" className="w-full h-full preserve-3d" preserveAspectRatio="none">
                  <path fill="white" fillOpacity="1" d="M0,128L48,144C96,160,192,176,288,160C384,144,480,96,576,106.7C672,117,768,187,864,181.3C960,176,1056,96,1152,80C1248,64,1344,112,1392,138.7L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
               </svg>
            </div>
          </div>

          <div className="flex-1 w-full px-6 pt-1 pb-6 flex flex-col items-center justify-between text-center">
            {/* Avatar Section */}
            <div className="relative -mt-8 mb-2">
               <div 
                 className="w-20 h-20 rounded-full border-4 border-white bg-slate-100 shadow-lg overflow-hidden flex items-center justify-center"
               >
                 {member.avatarUrl ? (
                   <img src={member.avatarUrl} alt={member.name} className="w-full h-full object-cover" />
                 ) : (
                   <User className="w-10 h-10 text-slate-300" />
                 )}
               </div>
               <div 
                 className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-white shadow-sm"
                 style={{ backgroundColor: theme.primary }}
               >
                 {theme.icon}
               </div>
            </div>

            {/* Member Details */}
            <div className="space-y-2 mb-4">
              <div className="space-y-0.5">
                 <div 
                   className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-wider"
                   style={{ 
                     backgroundColor: theme.secondary, 
                     color: theme.primary,
                     borderColor: theme.accent
                   }}
                 >
                   {theme.label}
                 </div>
                 <h2 className="text-lg font-black text-slate-900 leading-none pt-1">{member.name}</h2>
              </div>

              <div className="flex items-center justify-center gap-2">
                <div className="px-4 py-1.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-1.5">
                   <span className="text-xl">{team?.icon || "🛡️"}</span>
                   <div className="text-right">
                      <div className="text-[8px] text-slate-400 font-bold leading-none">الفريق</div>
                      <div className="text-xs font-black text-slate-700 leading-tight">{team?.name || "عام"}</div>
                   </div>
                </div>
              </div>
            </div>

            {/* QR Code Section */}
            <div className="relative group mb-4">
              <div 
                className="absolute -inset-2 rounded-2xl opacity-10 blur-lg transition-opacity"
                style={{ backgroundColor: theme.primary }}
              />
              <div className="relative bg-white p-2 rounded-xl border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR Code" className="w-28 h-28 sm:w-32 sm:h-32" />
                ) : (
                  <div className="w-28 h-28 bg-slate-50 animate-pulse rounded-lg" />
                )}
              </div>
              
              {/* Access Code Overlay */}
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-slate-900 text-white text-[10px] font-black font-mono shadow-md border border-slate-700">
                {member.accessCode}
              </div>
            </div>

            {/* Footer Slogan */}
            <div className="w-full pt-3 border-t border-slate-100">
               <div 
                 className="text-lg font-arabic font-black italic"
                 style={{ color: theme.primary }}
               >
                 بطل التحدي
               </div>
               <div className="text-[8px] text-slate-300 font-bold mt-0.5 uppercase tracking-widest leading-none">Digital ID Card • Season 2026</div>
            </div>
          </div>

          {/* Bottom Side Accents */}
          <div className="absolute bottom-0 left-0 right-0 h-1.5 flex">
             <div className="flex-1 bg-amber-500"></div>
             <div className="flex-1 bg-blue-600"></div>
             <div className="flex-1 bg-purple-600"></div>
             <div className="flex-1 bg-emerald-500"></div>
          </div>
        </div>

        {/* Action Bar (Hidden on Print) */}
        <div className="relative p-6 bg-slate-50 border-t border-slate-100 flex flex-col gap-3 print:hidden z-20">
          <div className="flex items-center gap-3 w-full">
            <button
              onClick={handleExportImage}
              disabled={isExporting}
              className="flex-1 h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              <ImageIcon className="h-4 w-4" />
              <span>{isExporting ? "جاري التصدير..." : "تصدير كصورة 🖼️"}</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 h-12 rounded-2xl bg-slate-900 hover:bg-black text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>طباعة / PDF 🖨️</span>
            </button>
          </div>
          <button
            onClick={() => {
              sounds.playClose();
              onClose();
            }}
            className="w-full h-11 rounded-2xl bg-white border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          /* Hide everything by default */
          body, html {
            visibility: hidden;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            background: white !important;
          }
          
          /* Show only the card and ensure background colors are printed */
          #printable-card {
            visibility: visible;
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            width: 85mm;
            height: 120mm;
            border: 0.5pt solid #e2e8f0 !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
            border-radius: 10mm !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            overflow: hidden;
            box-shadow: none !important;
          }

          /* Ensure all content within the card is visible */
          #printable-card * {
            visibility: visible;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Hide print buttons and other overlays */
          .print\\:hidden, .print-hidden, button {
            display: none !important;
            visibility: hidden !important;
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
