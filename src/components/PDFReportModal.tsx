import React, { useRef, useState } from "react";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import {
  X,
  FileText,
  Download,
  Share2,
  Printer,
  Sparkles,
  Trophy,
  Users,
  Crown,
  Calendar,
  CheckCircle,
  Copy,
  Image as ImageIcon,
  Flame,
} from "lucide-react";
import { meetingStore } from "../utils/meetingStore";
import { sounds } from "../utils/soundEffects";
import { formatArabicTimestamp } from "../utils/dateFormatter";

interface PDFReportModalProps {
  onClose: () => void;
}

export const PDFReportModal: React.FC<PDFReportModalProps> = ({ onClose }) => {
  const data = meetingStore.getData();
  const processedTeams = meetingStore.getProcessedTeams();
  const reportRef = useRef<HTMLDivElement | null>(null);

  const [reportTitle, setReportTitle] = useState(
    `التقرير النهائي لنتائج وترتيب الفرق - ${data.config.meetingName}`
  );
  const [includeMembers, setIncludeMembers] = useState(true);
  const [customNote, setCustomNote] = useState(
    "بركة صلوات القديسين وشفعاء الأسرة تكون معنا جميعاً. ربنا يبارك كل تعب ومجهود!"
  );
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isGeneratingPng, setIsGeneratingPng] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const currentDate = new Date().toLocaleDateString("ar-EG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const totalPoints = processedTeams.reduce((sum, t) => sum + (t.points || 0), 0);
  const topTeam = processedTeams[0];

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    setIsGeneratingPdf(true);
    sounds.playTap();

    try {
      const dataUrl = await toPng(reportRef.current, {
        quality: 0.98,
        cacheBust: true,
        pixelRatio: 2,
      });

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(dataUrl, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`تقرير_ترتيب_الفرق_${new Date().toISOString().slice(0, 10)}.pdf`);

      sounds.playVictory();
      setToastMsg("تم تنزيل ملف التقرير PDF بنجاح! جاهز للمشاركة 📄");
      setTimeout(() => setToastMsg(null), 4000);
    } catch (err) {
      console.error("PDF generation failed:", err);
      sounds.playClose();
      setToastMsg("تعذر توليد ملف PDF، حاول مرة أخرى.");
      setTimeout(() => setToastMsg(null), 3000);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleExportPNG = async () => {
    if (!reportRef.current) return;
    setIsGeneratingPng(true);
    sounds.playTap();

    try {
      const dataUrl = await toPng(reportRef.current, {
        quality: 0.98,
        cacheBust: true,
        pixelRatio: 2,
      });

      const link = document.createElement("a");
      link.download = `تقرير_نتائج_الفرق_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();

      sounds.playVictory();
      setToastMsg("تم حفظ التقرير كصورة عالية الجودة PNG 🖼️");
      setTimeout(() => setToastMsg(null), 4000);
    } catch (err) {
      console.error("PNG export error:", err);
      sounds.playClose();
    } finally {
      setIsGeneratingPng(false);
    }
  };

  const handleCopySummaryText = () => {
    sounds.playTap();
    let text = `🏆 *${reportTitle}*\n`;
    text += `🏛️ ${data.config.churchName}\n`;
    text += `📅 ${currentDate}\n\n`;
    text += `📊 *ترتيب المجموعات الحالية:*\n`;

    processedTeams.forEach((t, i) => {
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
      text += `${medal} *${t.name}* — ${t.points.toLocaleString("en-US")} XP\n`;
      if (t.leaderName) text += `   👑 القائد: ${t.leaderName}\n`;
    });

    text += `\n✨ إجمالي النقاط المكتسبة: ${totalPoints.toLocaleString("en-US")} XP\n`;
    if (customNote) text += `\n🙏 ${customNote}`;

    navigator.clipboard.writeText(text);
    setCopiedText(true);
    sounds.playVictory();
    setTimeout(() => setCopiedText(false), 3000);
  };

  const handlePrint = () => {
    sounds.playTap();
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-5 bg-black/90 backdrop-blur-md animate-fadeIn font-arabic select-none"
      dir="rtl"
    >
      <div className="relative w-full max-w-4xl rounded-3xl border border-slate-700 bg-[#0B132B] p-5 sm:p-7 shadow-2xl text-slate-100 flex flex-col max-h-[95vh]">
        {/* Header bar */}
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-white">
                تصدير التقرير النهائي لنتائج الفرق (PDF / PNG)
              </h3>
              <p className="text-xs text-slate-400">
                تقرير رسمي أنيق وجاهز للمشاركة المباشرة عبر الواتساب وتليجرام
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Controls Toolbar */}
        <div className="py-3 px-4 rounded-2xl bg-slate-900/90 border border-slate-800 my-4 space-y-3 shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-slate-400 font-bold block mb-1">عنوان التقرير:</label>
              <input
                type="text"
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="text-slate-400 font-bold block mb-1">رسالة ختامية / بركة:</label>
              <input
                type="text"
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap pt-2 border-t border-slate-800/80">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeMembers}
                onChange={(e) => setIncludeMembers(e.target.checked)}
                className="h-4 w-4 rounded accent-amber-500 cursor-pointer"
              />
              <span>إظهار قادة وأعضاء الفرق في التقرير</span>
            </label>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleExportPDF}
                disabled={isGeneratingPdf}
                className="h-9 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black shadow-md active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                <span>{isGeneratingPdf ? "جاري التوليد..." : "تحميل ملف PDF 📄"}</span>
              </button>

              <button
                type="button"
                onClick={handleExportPNG}
                disabled={isGeneratingPng}
                className="h-9 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40 text-xs font-black active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <ImageIcon className="h-4 w-4" />
                <span>تحميل صورة PNG 🖼️</span>
              </button>

              <button
                type="button"
                onClick={handleCopySummaryText}
                className="h-9 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-500/40 text-xs font-black active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
              >
                {copiedText ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                    <span>تم نسخ الملخص!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>نسخ نص الواتساب 📲</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="h-9 p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 active:scale-95 transition-all cursor-pointer"
                title="طباعة التقرير"
              >
                <Printer className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Toast Notification */}
        {toastMsg && (
          <div className="mb-3 p-3 rounded-2xl bg-emerald-950/90 border border-emerald-500/60 text-emerald-200 text-xs font-bold flex items-center gap-2 shadow-lg animate-bounce shrink-0">
            <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Printable / Capturable Report Document Preview Container */}
        <div className="flex-1 overflow-y-auto p-2 bg-slate-950 rounded-2xl border border-slate-800">
          <div
            ref={reportRef}
            className="w-full max-w-[800px] mx-auto bg-[#070A1E] text-slate-100 p-8 rounded-3xl border-2 border-amber-500/40 shadow-2xl space-y-6 font-arabic"
            style={{ minHeight: "850px" }}
          >
            {/* Document Header */}
            <div className="flex items-center justify-between gap-4 pb-6 border-b-2 border-amber-500/40">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-white/95 border-2 border-amber-400 p-1 flex items-center justify-center overflow-hidden shadow-lg shrink-0">
                  <img
                    src={data.config.meetingLogoUrl || "/assets/aistudio/_______________________55ad5e73.png"}
                    alt="Logo"
                    className="w-full h-full object-contain rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-black text-amber-400 block tracking-wider">
                    {data.config.churchName}
                  </span>
                  <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight">
                    {reportTitle}
                  </h1>
                  <p className="text-xs text-slate-400 font-bold">
                    {data.config.seasonName} • تقرير إداري معتمد
                  </p>
                </div>
              </div>

              <div className="text-left shrink-0" dir="ltr">
                <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 font-mono text-xs text-amber-300 font-bold">
                  {currentDate}
                </div>
                <div className="text-[10px] text-slate-500 mt-1 font-bold text-right" dir="rtl">
                  تاريخ صدور التقرير
                </div>
              </div>
            </div>

            {/* Quick Overview Summary Badges */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-2xl bg-slate-900/90 border border-amber-500/30 text-center">
                <span className="text-[10px] text-slate-400 font-bold block">إجمالي النقاط المكتسبة</span>
                <span className="text-lg font-black text-amber-400 font-mono">
                  {totalPoints.toLocaleString("en-US")} XP
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-900/90 border border-amber-500/30 text-center">
                <span className="text-[10px] text-slate-400 font-bold block">المجموعة المتصدرة (#1)</span>
                <span className="text-sm font-black text-amber-300 flex items-center justify-center gap-1">
                  <Crown className="h-4 w-4 text-amber-400 shrink-0" />
                  <span>{topTeam?.name || "لا يوجد"}</span>
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-900/90 border border-amber-500/30 text-center">
                <span className="text-[10px] text-slate-400 font-bold block">عدد الفرق المشاركة</span>
                <span className="text-lg font-black text-sky-400 font-mono">
                  {processedTeams.length} مجموعات
                </span>
              </div>
            </div>

            {/* Teams Leaderboard Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-base font-black text-amber-300 flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-amber-400" />
                  <span>ترتيب الفرق والنتيجة الحالية</span>
                </h3>
                <span className="text-xs text-slate-400 font-bold">
                  ملاحظة: مرتبة تنازلياً حسب إجمالي النقاط
                </span>
              </div>

              <div className="space-y-2.5">
                {processedTeams.map((team, idx) => {
                  const isRank1 = team.rank === 1;
                  const isRank2 = team.rank === 2;
                  const isRank3 = team.rank === 3;

                  return (
                    <div
                      key={team.id}
                      className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                        isRank1
                          ? "bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/80 border-amber-400/90 ring-1 ring-amber-400/30"
                          : isRank2
                          ? "bg-gradient-to-r from-slate-900/90 via-slate-900 to-slate-900/90 border-slate-400/70"
                          : isRank3
                          ? "bg-gradient-to-r from-orange-950/70 via-slate-900 to-orange-950/70 border-orange-400/70"
                          : "bg-slate-900/70 border-slate-800"
                      }`}
                      style={{ borderRightWidth: "5px", borderRightColor: team.color }}
                    >
                      {/* Left: Rank & Team Details */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Rank Badge */}
                        <div
                          className={`h-11 w-11 rounded-xl flex items-center justify-center font-black text-base shrink-0 border ${
                            isRank1
                              ? "bg-amber-500 text-slate-950 border-amber-300 shadow-md"
                              : isRank2
                              ? "bg-slate-300 text-slate-950 border-white"
                              : isRank3
                              ? "bg-orange-500 text-white border-orange-300"
                              : "bg-slate-800 text-slate-300 border-slate-700"
                          }`}
                        >
                          #{team.rank}
                        </div>

                        {/* Team Avatar / Emblem */}
                        <div className="h-10 w-10 rounded-xl bg-slate-800 border border-white/20 flex items-center justify-center text-xl shrink-0 overflow-hidden">
                          {team.avatarUrl ? (
                            <img src={team.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span>{team.icon}</span>
                          )}
                        </div>

                        {/* Name & Leader */}
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-black text-base text-white truncate">
                              {team.name}
                            </h4>
                            {isRank1 && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-black border border-amber-400/40">
                                👑 الصدارة
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-400 font-bold flex-wrap">
                            {team.leaderName && (
                              <span>👑 القائد: <strong className="text-slate-200">{team.leaderName}</strong></span>
                            )}
                            {includeMembers && (
                              <span>👥 الأعضاء: <strong className="text-slate-200">{team.membersCount}</strong></span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Points */}
                      <div className="text-left shrink-0" dir="ltr">
                        <div className="flex items-baseline gap-1 text-amber-400 font-mono font-black text-lg">
                          <span className="text-xs font-bold text-amber-300/80 font-arabic">XP</span>
                          <span>{team.points.toLocaleString("en-US")}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Closing Note / Blessing Footer */}
            {customNote && (
              <div className="pt-4 border-t border-slate-800 text-center space-y-1">
                <p className="text-xs font-bold text-amber-300/90 italic">
                  "{customNote}"
                </p>
                <p className="text-[10px] text-slate-500 font-mono">
                  {data.config.meetingName} • {data.config.churchName}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
