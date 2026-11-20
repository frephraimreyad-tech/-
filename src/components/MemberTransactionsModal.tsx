import React, { useEffect, useMemo, useState } from "react";
import {
  X,
  Search,
  Clock,
  Sparkles,
  Users,
  User,
  QrCode,
  Shield,
  Copy,
  Check,
  RotateCcw,
  FileText,
  TrendingUp,
  TrendingDown,
  Info,
} from "lucide-react";
import type { CustomMember, CustomTeam, ScoreTransaction } from "../types";
import { meetingStore } from "../utils/meetingStore";
import { authStore } from "../utils/authStore";
import { sounds } from "../utils/soundEffects";
import { formatArabicTimestamp } from "../utils/dateFormatter";
import { useTheme } from "../utils/themeStore";

interface MemberTransactionsModalProps {
  member: CustomMember;
  team?: CustomTeam;
  onClose: () => void;
}

interface MemberStatementItem {
  id: string;
  txId?: string;
  timestamp: string;
  points: number;
  sourceType: "direct" | "qr" | "team_share";
  reason: string;
  category?: string;
  notes?: string;
  executorName?: string;
  teamTotalPoints?: number;
  canUndo?: boolean;
}

function extractPerMemberShareFromTx(tx: ScoreTransaction, teamMembersCount: number): number {
  // Check if notes contains the recorded equal-split value, e.g. "(+10 XP لكل عضو ...)"
  if (tx.notes) {
    const match = tx.notes.match(/\(([+-]?\d+)\s*XP\s*لكل عضو/);
    if (match && match[1]) {
      const parsed = parseInt(match[1], 10);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  if (teamMembersCount <= 0) return 0;
  return tx.points >= 0
    ? Math.max(tx.points > 0 ? 1 : 0, Math.round(tx.points / teamMembersCount))
    : Math.min(tx.points < 0 ? -1 : 0, -Math.round(Math.abs(tx.points) / teamMembersCount));
}

export const MemberTransactionsModal: React.FC<MemberTransactionsModalProps> = ({
  member: initialMember,
  team: initialTeam,
  onClose,
}) => {
  const { isLight } = useTheme();
  const [data, setData] = useState(meetingStore.getData());
  const currentUser = authStore.getCurrentUser();
  const [filterType, setFilterType] = useState<"all" | "direct" | "team_share" | "qr">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsub = meetingStore.subscribe(() => {
      setData(meetingStore.getData());
    });
    return unsub;
  }, []);

  // Always get the freshest member & team objects from store
  const member = useMemo(() => {
    return data.members.find((m) => m.id === initialMember.id) || initialMember;
  }, [data.members, initialMember]);

  const team = useMemo(() => {
    return data.teams.find((t) => t.id === member.teamId) || initialTeam;
  }, [data.teams, member.teamId, initialTeam]);

  const teamMembersCount = useMemo(() => {
    return data.members.filter((m) => m.teamId === member.teamId).length;
  }, [data.members, member.teamId]);

  // Build unified chronological statement of all point sources for this member
  const { items, directSum, teamShareSum, qrSum, trackedSum, openingBalance } = useMemo(() => {
    const result: MemberStatementItem[] = [];
    const seenAttendanceEventIds = new Set<string>();

    let directTotal = 0;
    let teamShareTotal = 0;
    let qrTotal = 0;

    // 1. Scan all recorded transactions in Firestore/store
    for (const tx of data.transactions || []) {
      const isDirectMemberTx =
        tx.targetType === "member" &&
        (tx.targetId === member.id ||
          (tx.targetName && tx.targetName.trim() === member.name.trim() && tx.teamId === member.teamId));

      if (isDirectMemberTx) {
        const isQr =
          tx.category === "حضور QR" ||
          tx.reason.includes("حضور QR") ||
          tx.reason.includes("تسجيل حضور") ||
          tx.reason.includes("مسح QR");

        if (isQr) {
          qrTotal += tx.points;
        } else {
          directTotal += tx.points;
        }

        result.push({
          id: `tx-${tx.id}`,
          txId: tx.id,
          timestamp: tx.timestamp,
          points: tx.points,
          sourceType: isQr ? "qr" : "direct",
          reason: tx.reason,
          category: tx.category,
          notes: tx.notes,
          executorName: tx.executorName,
          canUndo: currentUser.role === "admin" || currentUser.role === "priest",
        });

        // Track event titles to avoid duplicating attendance records
        if (isQr) {
          seenAttendanceEventIds.add(`${tx.timestamp.slice(0, 10)}-${tx.points}`);
        }
      } else if (tx.targetType === "team" && tx.teamId === member.teamId) {
        // Shared team score distributed equally to team members
        const share = extractPerMemberShareFromTx(tx, teamMembersCount);
        if (share !== 0) {
          teamShareTotal += share;
          result.push({
            id: `team-tx-${tx.id}`,
            txId: tx.id,
            timestamp: tx.timestamp,
            points: share,
            sourceType: "team_share",
            reason: tx.reason,
            category: tx.category || "نقاط جماعية للفريق",
            notes: tx.notes || `حصة العضو من إجمالي (${tx.points > 0 ? "+" : ""}${tx.points} XP) للفريق`,
            executorName: tx.executorName,
            teamTotalPoints: tx.points,
            canUndo: false,
          });
        }
      }
    }

    // 2. Cross-check attendance records in case any attendance record exists without a matching transaction
    for (const att of data.attendance || []) {
      if (att.memberId === member.id) {
        const key = `${att.scannedAt.slice(0, 10)}-${att.pointsAwarded}`;
        const hasTxAlready =
          seenAttendanceEventIds.has(key) ||
          result.some(
            (r) =>
              r.sourceType === "qr" &&
              Math.abs(new Date(r.timestamp).getTime() - new Date(att.scannedAt).getTime()) < 60_000
          );

        if (!hasTxAlready && att.pointsAwarded) {
          qrTotal += att.pointsAwarded;
          result.push({
            id: `att-${att.id}`,
            timestamp: att.scannedAt,
            points: att.pointsAwarded,
            sourceType: "qr",
            reason: `تسجيل حضور: ${att.eventTitle}${att.isPunctual ? " (مع بونص الالتزام بالموعد)" : ""}`,
            category: "حضور QR",
            executorName: att.scannedByUserName,
            canUndo: false,
          });
        }
      }
    }

    // Sort newest first
    result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const tracked = directTotal + teamShareTotal + qrTotal;
    const diff = (member.points || 0) - tracked;

    return {
      items: result,
      directSum: directTotal,
      teamShareSum: teamShareTotal,
      qrSum: qrTotal,
      trackedSum: tracked,
      openingBalance: diff,
    };
  }, [data.transactions, data.attendance, member, teamMembersCount, currentUser.role]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (filterType !== "all" && item.sourceType !== filterType) return false;
      if (!q) return true;
      return (
        item.reason.toLowerCase().includes(q) ||
        (item.category || "").toLowerCase().includes(q) ||
        (item.notes || "").toLowerCase().includes(q) ||
        (item.executorName || "").toLowerCase().includes(q)
      );
    });
  }, [items, filterType, searchQuery]);

  const handleCopyStatement = () => {
    sounds.playTap();
    const lines = [
      `📊 كشف نقاط العضو: ${member.name}`,
      team ? `🛡️ الفريق: ${team.name}` : "",
      `⭐ إجمالي النقاط الحالي: ${member.points} XP`,
      `────────────────────`,
      `• حضور QR: ${qrSum >= 0 ? "+" : ""}${qrSum} XP`,
      `• معاملات فردية مباشرة: ${directSum >= 0 ? "+" : ""}${directSum} XP`,
      `• حصة من نقاط الفريق الجماعية: ${teamShareSum >= 0 ? "+" : ""}${teamShareSum} XP`,
      openingBalance !== 0 ? `• رصيد سابق / تعديل مباشر: ${openingBalance >= 0 ? "+" : ""}${openingBalance} XP` : "",
      `────────────────────`,
      `📝 تفاصيل المعاملات (${items.length}):`,
      ...items.slice(0, 25).map((item, idx) => {
        const t = formatArabicTimestamp(item.timestamp);
        const sign = item.points > 0 ? `+${item.points}` : `${item.points}`;
        const tag =
          item.sourceType === "qr" ? "حضور" : item.sourceType === "team_share" ? "حصة فريق" : "فردي";
        return `${idx + 1}. [${sign} XP] (${tag}) ${item.reason} — ${t.dateStr} ${t.timeStr}`;
      }),
    ].filter(Boolean);

    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    sounds.playVictory();
    setTimeout(() => setCopied(false), 2500);
  };

  const handleUndo = async (item: MemberStatementItem) => {
    if (!item.txId || !item.canUndo) return;
    sounds.playTap();
    const ok = await meetingStore.undoTransaction(item.txId);
    if (ok) {
      sounds.playVictory();
      setToastMsg("تم التراجع عن المعاملة وتحديث رصيد العضو والفريق بنجاح! ⚡");
      setTimeout(() => setToastMsg(null), 3000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[160] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn font-arabic"
      dir="rtl"
      onClick={() => {
        sounds.playClose();
        onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-2xl max-h-[92dvh] flex flex-col rounded-t-3xl sm:rounded-3xl border-2 shadow-2xl overflow-hidden pb-safe sm:pb-0 ${
          isLight
            ? "bg-slate-50 border-slate-300 text-slate-900"
            : "bg-[#0B132B] border-slate-700 text-slate-100"
        }`}
      >
        {/* Top Accent Strip */}
        <div
          className="h-2 w-full shrink-0"
          style={{
            background: `linear-gradient(90deg, ${team?.color || "#F59E0B"}, #F59E0B, #10B981)`,
          }}
        />

        {/* Header */}
        <div
          className={`p-4 sm:p-5 border-b shrink-0 space-y-3 ${
            isLight ? "bg-white border-slate-200" : "bg-slate-900/90 border-slate-800"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl border-2 flex items-center justify-center font-black text-lg shrink-0 overflow-hidden shadow-md"
                style={{
                  borderColor: team?.color || "#F59E0B",
                  backgroundColor: `${team?.color || "#F59E0B"}22`,
                }}
              >
                {member.avatarUrl ? (
                  <img src={member.avatarUrl} alt={member.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-amber-400">{member.name.charAt(0)}</span>
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className={`text-base sm:text-xl font-black truncate ${isLight ? "text-slate-900" : "text-white"}`}>
                    {member.name}
                  </h3>
                  <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-black">
                    {member.roleLabel || (member.role === "leader" ? "قائد" : member.role === "servant" ? "خادم" : "مخدوم")}
                  </span>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span>{team ? `${team.icon} ${team.name}` : "عضو بالاجتماع"}</span>
                  <span>•</span>
                  <span>كشف تفصيلي لمصدر كل نقطة</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                sounds.playClose();
                onClose();
              }}
              className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 cursor-pointer transition-all ${
                isLight ? "bg-slate-100 hover:bg-slate-200 text-slate-800" : "bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
              }`}
              aria-label="إغلاق"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Breakdown KPI Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/40 text-center">
              <div className="text-[10px] font-bold text-amber-300">الرصيد الإجمالي الحالي</div>
              <div className="text-lg sm:text-xl font-black font-mono text-amber-400 leading-tight mt-0.5" dir="ltr">
                {member.points.toLocaleString("en-US")} XP
              </div>
            </div>

            <div className={`p-2.5 rounded-2xl border text-center ${
              isLight ? "bg-emerald-50 border-emerald-200" : "bg-emerald-950/40 border-emerald-500/30"
            }`}>
              <div className="text-[10px] font-bold text-emerald-400">حضور QR والالتزام</div>
              <div className="text-base sm:text-lg font-black font-mono text-emerald-400 leading-tight mt-0.5" dir="ltr">
                {qrSum >= 0 ? `+${qrSum}` : qrSum} XP
              </div>
            </div>

            <div className={`p-2.5 rounded-2xl border text-center ${
              isLight ? "bg-sky-50 border-sky-200" : "bg-sky-950/40 border-sky-500/30"
            }`}>
              <div className="text-[10px] font-bold text-sky-400">معاملات فردية</div>
              <div className="text-base sm:text-lg font-black font-mono text-sky-400 leading-tight mt-0.5" dir="ltr">
                {directSum >= 0 ? `+${directSum}` : directSum} XP
              </div>
            </div>

            <div className={`p-2.5 rounded-2xl border text-center ${
              isLight ? "bg-purple-50 border-purple-200" : "bg-purple-950/40 border-purple-500/30"
            }`}>
              <div className="text-[10px] font-bold text-purple-400">حصة نقاط الفريق</div>
              <div className="text-base sm:text-lg font-black font-mono text-purple-300 leading-tight mt-0.5" dir="ltr">
                {teamShareSum >= 0 ? `+${teamShareSum}` : teamShareSum} XP
              </div>
            </div>
          </div>

          {/* Search, Filters & Copy Action */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث بالسبب أو اسم الخادم..."
                className={`w-full min-h-[44px] pr-9 pl-3 rounded-xl border text-sm focus:outline-none ${
                  isLight
                    ? "bg-slate-50 border-slate-300 text-slate-900 focus:border-amber-500"
                    : "bg-slate-950 border-slate-700 text-white focus:border-amber-400"
                }`}
              />
            </div>

            <button
              type="button"
              onClick={handleCopyStatement}
              className="min-h-[44px] px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shrink-0 shadow-sm"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span>{copied ? "تم نسخ الكشف!" : "نسخ كشف النقاط"}</span>
            </button>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar touch-scroll-x pb-0.5">
            {[
              { id: "all" as const, label: `الكل (${items.length})` },
              { id: "qr" as const, label: `حضور QR (${items.filter((i) => i.sourceType === "qr").length})` },
              { id: "direct" as const, label: `فردي مباشر (${items.filter((i) => i.sourceType === "direct").length})` },
              { id: "team_share" as const, label: `حصة الفريق (${items.filter((i) => i.sourceType === "team_share").length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  sounds.playTap();
                  setFilterType(tab.id);
                }}
                className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap border transition-all cursor-pointer ${
                  filterType === tab.id
                    ? "bg-amber-500 text-slate-950 border-amber-400 shadow-sm"
                    : isLight
                    ? "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                    : "bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Toast Feedback */}
        {toastMsg && (
          <div className="mx-4 mt-3 p-3 rounded-2xl bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 text-xs font-bold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Transactions Timeline Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {filteredItems.length === 0 ? (
            <div
              className={`p-8 rounded-2xl border text-center space-y-2 ${
                isLight ? "bg-white border-slate-200" : "bg-slate-900/70 border-slate-800"
              }`}
            >
              <FileText className="h-8 w-8 text-slate-500 mx-auto" />
              <div className={`text-sm font-black ${isLight ? "text-slate-900" : "text-white"}`}>
                لا توجد معاملات مسجلة مطابقة في السجل
              </div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                {member.points > 0
                  ? `رصيد ${member.name} الحالي (${member.points} XP) تم رصده كرصيد ابتدائي أو تعديل مباشر قبل تفعيل سجل المعاملات التفصيلي.`
                  : `لم يتم رصد أي نقاط أو معاملات لـ ${member.name} بعد.`}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredItems.map((item) => {
                const parsed = formatArabicTimestamp(item.timestamp);
                const isPositive = item.points >= 0;

                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-2xl border transition-all space-y-2 ${
                      isLight
                        ? "bg-white border-slate-200 shadow-xs"
                        : "bg-slate-900/85 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0 space-y-1">
                        {/* Source Type Badge */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {item.sourceType === "qr" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-emerald-400 text-[10px] font-black">
                              <QrCode className="h-3 w-3" />
                              <span>حضور QR</span>
                            </span>
                          ) : item.sourceType === "team_share" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-500/15 border border-purple-500/35 text-purple-300 text-[10px] font-black">
                              <Users className="h-3 w-3" />
                              <span>
                                حصة من نقاط الفريق
                                {item.teamTotalPoints !== undefined &&
                                  ` (من ${item.teamTotalPoints > 0 ? "+" : ""}${item.teamTotalPoints} XP)`}
                              </span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-500/15 border border-sky-500/35 text-sky-300 text-[10px] font-black">
                              <User className="h-3 w-3" />
                              <span>معاملة فردية مباشرة</span>
                            </span>
                          )}

                          {item.category && (
                            <span className="px-2 py-0.5 rounded-lg bg-slate-800/80 border border-slate-700 text-[10px] font-bold text-slate-300">
                              {item.category}
                            </span>
                          )}
                        </div>

                        {/* Reason */}
                        <div className={`text-xs sm:text-sm font-black leading-snug ${isLight ? "text-slate-900" : "text-white"}`}>
                          {item.reason}
                        </div>

                        {/* Notes if present */}
                        {item.notes && (
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            {item.notes}
                          </p>
                        )}
                      </div>

                      {/* Points Pill */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl font-mono text-xs sm:text-sm font-black border ${
                            isPositive
                              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                              : "bg-rose-500/15 border-rose-500/40 text-rose-400"
                          }`}
                          dir="ltr"
                        >
                          {isPositive ? (
                            <TrendingUp className="h-3.5 w-3.5" />
                          ) : (
                            <TrendingDown className="h-3.5 w-3.5" />
                          )}
                          <span>{isPositive ? `+${item.points}` : item.points} XP</span>
                        </span>

                        {item.canUndo && (
                          <button
                            type="button"
                            onClick={() => handleUndo(item)}
                            className="px-2 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                            title="تراجع عن هذه المعاملة وعكس النقاط"
                          >
                            <RotateCcw className="h-3 w-3" />
                            <span>تراجع</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Footer Meta: Executor + Timestamp */}
                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400 pt-2 border-t border-slate-800/40 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Shield className="h-3 w-3 text-amber-400" />
                        <span>المنفذ: {item.executorName || "الإدارة"}</span>
                      </span>
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="h-3 w-3 text-slate-500" />
                        <span>
                          {parsed.dateStr} — {parsed.timeStr}
                        </span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Opening / Reconciled Historical Balance Explanation Card */}
          {openingBalance !== 0 && filterType === "all" && !searchQuery.trim() && (
            <div
              className={`p-3.5 rounded-2xl border-2 border-dashed flex items-start justify-between gap-3 ${
                isLight
                  ? "bg-amber-50/80 border-amber-300 text-amber-950"
                  : "bg-amber-950/25 border-amber-500/40 text-amber-100"
              }`}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="text-xs font-black text-amber-300">
                    رصيد افتتاحي / تعديل يدوي سابق
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    مجموع المعاملات المسجلة بالتفصيل ({trackedSum} XP) + هذا الرصيد السابق = الرصيد الإجمالي الحالي ({member.points} XP).
                  </p>
                </div>
              </div>
              <span
                className="px-2.5 py-1 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono text-xs font-black shrink-0"
                dir="ltr"
              >
                {openingBalance > 0 ? `+${openingBalance}` : openingBalance} XP
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
