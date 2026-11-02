import React, { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Swords,
  Trophy,
  Crown,
  Sparkles,
  Zap,
  Users,
  Flame,
  Plus,
  Minus,
  RefreshCw,
  Shuffle,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  AlertCircle,
  ArrowRightLeft,
  ChevronRight,
  Shield,
  Star,
  Search,
} from "lucide-react";
import type { CustomMember, CustomTeam, ProcessedMeetingTeam, ScoreTransaction } from "../types";
import { meetingStore } from "../utils/meetingStore";
import { authStore, type SystemUser } from "../utils/authStore";
import { sounds } from "../utils/soundEffects";

interface LiveDuelModeProps {
  isLight: boolean;
  onBack?: () => void;
  teams: ProcessedMeetingTeam[];
  allMembers: CustomMember[];
  transactions: ScoreTransaction[];
}

export const LiveDuelMode: React.FC<LiveDuelModeProps> = ({
  isLight,
  onBack,
  teams,
  allMembers,
  transactions,
}) => {
  const [currentUser] = useState<SystemUser>(authStore.getCurrentUser());

  // Teams in duel
  const [teamAId, setTeamAId] = useState<string>(() => teams[0]?.id || "");
  const [teamBId, setTeamBId] = useState<string>(() => teams[1]?.id || teams[0]?.id || "");

  // Custom point input
  const [customPointsA, setCustomPointsA] = useState<string>("50");
  const [customPointsB, setCustomPointsB] = useState<string>("50");
  const [duelReason, setDuelReason] = useState<string>("جولة المبارزة والتحدي المباشر");

  // Feedback & Lead flip announcement
  const [leadFlipNotice, setLeadFlipNotice] = useState<{
    text: string;
    winnerName: string;
    winnerIcon: string;
    pointsDelta: number;
  } | null>(null);

  const [feedbackMsg, setFeedbackMsg] = useState<{
    text: string;
    teamId: string;
    type: "success" | "error";
  } | null>(null);

  // Search within roster comparison
  const [rosterSearch, setRosterSearch] = useState("");

  // Retrieve full team objects
  const teamA = useMemo(() => teams.find((t) => t.id === teamAId) || teams[0], [teams, teamAId]);
  const teamB = useMemo(() => teams.find((t) => t.id === teamBId) || teams[1] || teams[0], [teams, teamBId]);

  // Track previous leader to trigger flip effects
  const prevLeaderRef = useRef<string | null>(null);

  // Compute point difference and leader
  const pointsA = teamA?.points || 0;
  const pointsB = teamB?.points || 0;
  const totalDuelPoints = pointsA + pointsB;
  const percentA = totalDuelPoints > 0 ? Math.round((pointsA / totalDuelPoints) * 100) : 50;
  const percentB = 100 - percentA;
  const pointDifference = Math.abs(pointsA - pointsB);

  const currentLeaderId = pointsA > pointsB ? teamA?.id : pointsB > pointsA ? teamB?.id : "tie";

  // Check for lead flips
  useEffect(() => {
    if (!prevLeaderRef.current) {
      prevLeaderRef.current = currentLeaderId;
      return;
    }

    if (prevLeaderRef.current !== currentLeaderId && currentLeaderId !== "tie") {
      const winner = currentLeaderId === teamA?.id ? teamA : teamB;
      const loser = currentLeaderId === teamA?.id ? teamB : teamA;

      if (winner && loser) {
        sounds.playVictory();
        setLeadFlipNotice({
          text: `انقلاب حماسي في المبارزة! 🔥 «${winner.name}» ينتزع التقدم من «${loser.name}»!`,
          winnerName: winner.name,
          winnerIcon: winner.icon,
          pointsDelta: pointDifference,
        });

        const timer = setTimeout(() => {
          setLeadFlipNotice(null);
        }, 6000);
        return () => clearTimeout(timer);
      }
    }

    prevLeaderRef.current = currentLeaderId;
  }, [currentLeaderId, teamA, teamB, pointDifference]);

  // Handle quick score addition directly in duel
  const handleAwardDuelPoints = async (team: ProcessedMeetingTeam, pts: number) => {
    if (!currentUser.permissions.canAwardPoints) {
      sounds.playClose();
      setFeedbackMsg({
        text: "⚠️ ليس لديك صلاحية رصد النقاط في النظام",
        teamId: team.id,
        type: "error",
      });
      setTimeout(() => setFeedbackMsg(null), 3000);
      return;
    }

    sounds.playTap();
    const reasonText = duelReason.trim()
      ? `${duelReason} (${team.name} ضد ${team.id === teamA.id ? teamB.name : teamA.name})`
      : `مبارزة مباشرة: ${team.name}`;

    const res = await meetingStore.awardPoints(
      {
        targetType: "team",
        targetId: team.id,
        points: pts,
        reason: reasonText,
        category: "مبارزة مباشرة",
      },
      currentUser
    );

    if (res) {
      if (pts > 0) sounds.playVictory();
      setFeedbackMsg({
        text: `تم رصد +${pts} XP لـ «${team.name}» بنجاح! ⚡`,
        teamId: team.id,
        type: "success",
      });
    } else {
      sounds.playClose();
      setFeedbackMsg({
        text: "حدث خطأ أثناء رصد النقاط",
        teamId: team.id,
        type: "error",
      });
    }

    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  // Quick pairs
  const handleTopTwoDuel = () => {
    sounds.playTap();
    if (teams.length >= 2) {
      setTeamAId(teams[0].id);
      setTeamBId(teams[1].id);
    }
  };

  const handleRandomDuel = () => {
    sounds.playTap();
    if (teams.length < 2) return;
    const idx1 = Math.floor(Math.random() * teams.length);
    let idx2 = Math.floor(Math.random() * (teams.length - 1));
    if (idx2 >= idx1) idx2++;
    setTeamAId(teams[idx1].id);
    setTeamBId(teams[idx2].id);
  };

  const handleSwapTeams = () => {
    sounds.playTap();
    const temp = teamAId;
    setTeamAId(teamBId);
    setTeamBId(temp);
  };

  // Detailed comparative metrics calculation
  const metrics = useMemo(() => {
    if (!teamA || !teamB) return [];

    const txA = transactions.filter((t) => t.teamId === teamA.id || t.targetId === teamA.id);
    const txB = transactions.filter((t) => t.teamId === teamB.id || t.targetId === teamB.id);

    const makhdoumeenA = teamA.members.filter((m) => m.role === "member" || !m.role);
    const makhdoumeenB = teamB.members.filter((m) => m.role === "member" || !m.role);

    const servantsA = teamA.members.filter((m) => m.role !== "member" && m.role);
    const servantsB = teamB.members.filter((m) => m.role !== "member" && m.role);

    // Top individual scorer in Team A
    const sortedMembersA = [...teamA.members].sort((a, b) => (b.points || 0) - (a.points || 0));
    const mvpA = sortedMembersA[0];

    // Top individual scorer in Team B
    const sortedMembersB = [...teamB.members].sort((a, b) => (b.points || 0) - (a.points || 0));
    const mvpB = sortedMembersB[0];

    return [
      {
        id: "rank",
        label: "الترتيب العام في جدول الشرف",
        valA: `#${teamA.rank}`,
        valB: `#${teamB.rank}`,
        winner: teamA.rank < teamB.rank ? "A" : teamB.rank < teamA.rank ? "B" : "tie",
        diff: `${Math.abs(teamA.rank - teamB.rank)} مراكز`,
      },
      {
        id: "points",
        label: "إجمالي النقاط التراكمية",
        valA: `${teamA.points.toLocaleString("en-US")} XP`,
        valB: `${teamB.points.toLocaleString("en-US")} XP`,
        winner: teamA.points > teamB.points ? "A" : teamB.points > teamA.points ? "B" : "tie",
        diff: `${Math.abs(teamA.points - teamB.points).toLocaleString("en-US")} XP`,
      },
      {
        id: "members",
        label: "إجمالي عدد الأعضاء",
        valA: `${teamA.membersCount} عضو`,
        valB: `${teamB.membersCount} عضو`,
        winner: teamA.membersCount > teamB.membersCount ? "A" : teamB.membersCount > teamA.membersCount ? "B" : "tie",
        diff: `${Math.abs(teamA.membersCount - teamB.membersCount)} عضو`,
      },
      {
        id: "makhdoumeen",
        label: "عدد المخدومين",
        valA: `${makhdoumeenA.length} مخدوم`,
        valB: `${makhdoumeenB.length} مخدوم`,
        winner: makhdoumeenA.length > makhdoumeenB.length ? "A" : makhdoumeenB.length > makhdoumeenA.length ? "B" : "tie",
        diff: `${Math.abs(makhdoumeenA.length - makhdoumeenB.length)}`,
      },
      {
        id: "servants",
        label: "عدد الخدام وقادة المجموعات",
        valA: `${servantsA.length} خادم`,
        valB: `${servantsB.length} خادم`,
        winner: servantsA.length > servantsB.length ? "A" : servantsB.length > servantsA.length ? "B" : "tie",
        diff: `${Math.abs(servantsA.length - servantsB.length)}`,
      },
      {
        id: "txCount",
        label: "عدد جولات ورصد التحديات المكتسبة",
        valA: `${txA.length} عملية`,
        valB: `${txB.length} عملية`,
        winner: txA.length > txB.length ? "A" : txB.length > txA.length ? "B" : "tie",
        diff: `${Math.abs(txA.length - txB.length)}`,
      },
      {
        id: "mvp",
        label: "نجم الفريق وأعلى هداف نقاط",
        valA: mvpA ? `${mvpA.name} (${mvpA.points} XP)` : "--",
        valB: mvpB ? `${mvpB.name} (${mvpB.points} XP)` : "--",
        winner: (mvpA?.points || 0) > (mvpB?.points || 0) ? "A" : (mvpB?.points || 0) > (mvpA?.points || 0) ? "B" : "tie",
        diff: mvpA && mvpB ? `${Math.abs((mvpA.points || 0) - (mvpB.points || 0))} XP` : "--",
      },
    ];
  }, [teamA, teamB, transactions]);

  // Roster members side-by-side
  const rosterMembersA = useMemo(() => {
    if (!teamA) return [];
    let list = [...teamA.members];
    if (rosterSearch.trim()) {
      const q = rosterSearch.toLowerCase().trim();
      list = list.filter((m) => m.name.toLowerCase().includes(q) || (m.roleLabel || "").includes(q));
    }
    return list.sort((a, b) => (b.points || 0) - (a.points || 0));
  }, [teamA, rosterSearch]);

  const rosterMembersB = useMemo(() => {
    if (!teamB) return [];
    let list = [...teamB.members];
    if (rosterSearch.trim()) {
      const q = rosterSearch.toLowerCase().trim();
      list = list.filter((m) => m.name.toLowerCase().includes(q) || (m.roleLabel || "").includes(q));
    }
    return list.sort((a, b) => (b.points || 0) - (a.points || 0));
  }, [teamB, rosterSearch]);

  if (!teamA || !teamB) {
    return (
      <div className="p-8 text-center text-slate-400">
        <p>لا توجد فرق كافية للمبارزة المباشرة.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-fadeIn" dir="rtl">
      {/* Top Controls Bar */}
      <div className={`p-4 sm:p-5 rounded-3xl border-2 flex flex-col md:flex-row items-center justify-between gap-4 ${
        isLight
          ? "bg-white border-slate-300 shadow-sm"
          : "bg-slate-900/90 border-slate-800 shadow-xl"
      }`}>
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 text-slate-950 flex items-center justify-center shadow-lg shadow-rose-500/20">
            <Swords className="h-6 w-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className={`text-lg sm:text-xl font-black ${isLight ? "text-slate-950" : "text-white"}`}>
                المبارزة المباشرة بين الفرق (Head-to-Head Duel) ⚔️
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
                مباشر LIVE
              </span>
            </div>
            <p className={`text-xs ${isLight ? "text-slate-600 font-bold" : "text-slate-400"}`}>
              مقارنة تفاعلية لحظية، شريط شد الحبل، ورصد نقاط مباشر أثناء مسابقات الاجتماع
            </p>
          </div>
        </div>

        {/* Quick Duel Shortcuts */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleTopTwoDuel}
            className={`px-3 py-2 rounded-xl text-xs font-black border-2 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 ${
              isLight
                ? "bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300"
                : "bg-amber-950/60 hover:bg-amber-900 text-amber-300 border-amber-500/40"
            }`}
            title="مبارزة المركز الأول ضد الثاني"
          >
            <Crown className="h-4 w-4 text-amber-400" />
            <span>قمة الصدارة (#1 ضد #2) 👑</span>
          </button>

          <button
            type="button"
            onClick={handleRandomDuel}
            className={`px-3 py-2 rounded-xl text-xs font-black border-2 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 ${
              isLight
                ? "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300"
                : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
            }`}
            title="مبارزة عشوائية بين فريقين"
          >
            <Shuffle className="h-4 w-4 text-sky-400" />
            <span>مبارزة عشوائية 🎲</span>
          </button>

          <button
            type="button"
            onClick={handleSwapTeams}
            className={`p-2 rounded-xl border-2 flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
              isLight
                ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"
                : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
            }`}
            title="تبديل الأطراف"
          >
            <ArrowRightLeft className="h-4 w-4" />
          </button>

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="px-3 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white shadow-md active:scale-95 cursor-pointer"
            >
              العودة للوحة ✕
            </button>
          )}
        </div>
      </div>

      {/* Dramatic Lead Flip Announcement */}
      <AnimatePresence>
        {leadFlipNotice && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-950 via-rose-950 to-amber-950 border-2 border-amber-400 text-amber-200 shadow-2xl shadow-amber-500/30 flex items-center justify-between gap-4 overflow-hidden relative"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center gap-3.5 relative z-10">
              <div className="h-12 w-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center text-2xl shadow-lg shrink-0">
                {leadFlipNotice.winnerIcon || "🏆"}
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Flame className="h-4 w-4 animate-bounce" />
                  <span>انقلاب الصدارة في المبارزة!</span>
                </div>
                <div className="text-base sm:text-lg font-black text-white">
                  {leadFlipNotice.text}
                </div>
              </div>
            </div>
            <div className="text-xs font-black bg-black/40 px-3 py-1.5 rounded-xl border border-white/20 text-amber-300 shrink-0">
              +{leadFlipNotice.pointsDelta.toLocaleString("en-US")} XP فارق
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Battle Selection & Hero Cards Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* ===================== TEAM A HERO CARD ===================== */}
        <div className={`lg:col-span-5 rounded-3xl border-2 p-5 sm:p-6 transition-all relative overflow-hidden flex flex-col justify-between ${
          currentLeaderId === teamA.id
            ? isLight
              ? "bg-gradient-to-b from-amber-50 to-white border-amber-400 shadow-xl ring-2 ring-amber-400/40"
              : "bg-gradient-to-b from-amber-950/40 to-slate-900/90 border-amber-400 shadow-2xl shadow-amber-500/20 ring-2 ring-amber-500/30"
            : isLight
            ? "bg-white border-slate-300 shadow-sm"
            : "bg-slate-900/80 border-slate-800"
        }`}>
          {/* Top selection dropdown */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-4">
              <span className="text-xs font-black uppercase tracking-wider text-blue-500 flex items-center gap-1">
                <Shield className="h-4 w-4" />
                <span>الطرف الأول (الفريق أ)</span>
              </span>
              {currentLeaderId === teamA.id && (
                <span className="px-2.5 py-1 rounded-xl bg-amber-500 text-slate-950 text-xs font-black flex items-center gap-1 shadow-sm">
                  <Crown className="h-3.5 w-3.5" />
                  <span>المتصدر لحظياً (+{pointDifference} XP)</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <select
                value={teamAId}
                onChange={(e) => {
                  sounds.playTap();
                  setTeamAId(e.target.value);
                }}
                className={`flex-1 p-2.5 rounded-2xl border-2 text-sm font-black transition-all cursor-pointer ${
                  isLight
                    ? "bg-slate-50 border-slate-300 text-slate-900"
                    : "bg-slate-800 border-slate-700 text-white"
                }`}
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id} disabled={t.id === teamBId}>
                    {t.icon} {t.name} (#{t.rank} - {t.points} XP)
                  </option>
                ))}
              </select>
            </div>

            {/* Hero Team Profile */}
            <div className="mt-5 flex items-center gap-4">
              <div className="relative shrink-0">
                <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-3xl overflow-hidden border-2 border-white/20 shadow-xl bg-slate-800 flex items-center justify-center">
                  {teamA.avatarUrl ? (
                    <img src={teamA.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-4xl">{teamA.icon}</span>
                  )}
                </div>
                <div className="absolute -bottom-2 -right-2 px-2.5 py-0.5 rounded-xl bg-slate-950 text-amber-400 border border-amber-500/40 text-xs font-black font-mono">
                  #{teamA.rank}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <h3 className={`text-xl sm:text-2xl font-black truncate ${isLight ? "text-slate-950" : "text-white"}`}>
                  {teamA.name}
                </h3>
                <p className={`text-xs font-bold line-clamp-1 mt-0.5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                  «{teamA.slogan || "فريق المحبة والقوة"}»
                </p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border ${
                    isLight ? "bg-slate-100 border-slate-300 text-slate-700" : "bg-slate-800 border-slate-700 text-slate-300"
                  }`}>
                    القائد: {teamA.leaderName || "غير محدد"}
                  </span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border ${
                    isLight ? "bg-slate-100 border-slate-300 text-slate-700" : "bg-slate-800 border-slate-700 text-slate-300"
                  }`}>
                    {teamA.membersCount} عضو
                  </span>
                </div>
              </div>
            </div>

            {/* Score Big Display */}
            <div className={`mt-6 p-4 rounded-2xl border-2 flex items-center justify-between ${
              isLight ? "bg-amber-50/80 border-amber-300" : "bg-slate-950/70 border-slate-800"
            }`}>
              <div>
                <div className={`text-xs font-black ${isLight ? "text-amber-900" : "text-amber-400"}`}>
                  النقاط التراكمية في المبارزة
                </div>
                <div className={`text-3xl sm:text-4xl font-black font-display font-mono ${
                  isLight ? "text-slate-950" : "text-white"
                }`}>
                  <motion.span
                    key={teamA.points}
                    initial={{ scale: 1.25, color: "#10B981" }}
                    animate={{ scale: 1, color: isLight ? "#020617" : "#FFFFFF" }}
                    transition={{ duration: 0.5 }}
                  >
                    {teamA.points.toLocaleString("en-US")}
                  </motion.span>{" "}
                  <span className="text-base text-amber-500 font-arabic">XP</span>
                </div>
              </div>
              <div className="text-right">
                <span className={`text-lg sm:text-xl font-black font-mono ${
                  currentLeaderId === teamA.id ? "text-emerald-500" : "text-slate-400"
                }`}>
                  {percentA}%
                </span>
                <div className="text-[10px] text-slate-400 font-bold">نسبة القوة</div>
              </div>
            </div>
          </div>

          {/* Quick Duel Points Injector for Team A */}
          <div className="mt-6 pt-4 border-t border-slate-700/40">
            <div className="text-xs font-black mb-2 flex items-center justify-between">
              <span className={isLight ? "text-slate-800 font-black" : "text-slate-300"}>
                رصد فوري لـ «{teamA.name}»:
              </span>
              {feedbackMsg?.teamId === teamA.id && (
                <span className={`text-[11px] font-black ${feedbackMsg.type === "success" ? "text-emerald-400" : "text-rose-400"}`}>
                  {feedbackMsg.text}
                </span>
              )}
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {[10, 25, 50, 100].map((pts) => (
                <button
                  key={pts}
                  type="button"
                  onClick={() => handleAwardDuelPoints(teamA, pts)}
                  className={`py-2 px-1 rounded-xl text-xs font-black border-2 transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1 ${
                    isLight
                      ? "bg-blue-50 hover:bg-blue-500 hover:text-white text-blue-900 border-blue-300"
                      : "bg-blue-950/60 hover:bg-blue-600 hover:text-white text-blue-300 border-blue-500/40"
                  }`}
                  title={`إضافة +${pts} XP`}
                >
                  <Plus className="h-3 w-3" />
                  <span>{pts} XP</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ===================== CENTER VS & TUG-OF-WAR ===================== */}
        <div className="lg:col-span-2 flex flex-col items-center justify-center gap-4 py-4">
          <div className="relative">
            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 flex items-center justify-center text-white shadow-2xl shadow-rose-500/30 border-4 border-slate-900 z-10 relative">
              <span className="text-xl sm:text-2xl font-black font-display tracking-widest">VS</span>
            </div>
            <div className="absolute inset-0 rounded-full bg-rose-500/20 blur-xl animate-pulse" />
          </div>

          <div className="text-center space-y-1">
            <div className="text-xs font-black text-amber-400">
              {currentLeaderId === "tie"
                ? "تعادل تام! 🔥"
                : currentLeaderId === teamA.id
                ? `«${teamA.name}» يتقدم!`
                : `«${teamB.name}» يتقدم!`}
            </div>
            <div className={`text-[11px] font-bold ${isLight ? "text-slate-600" : "text-slate-400"}`}>
              {currentLeaderId === "tie"
                ? "0 نقطة فارق"
                : `فارق ${pointDifference.toLocaleString("en-US")} XP`}
            </div>
          </div>

          {/* Reason Input */}
          <div className="w-full mt-2">
            <input
              type="text"
              value={duelReason}
              onChange={(e) => setDuelReason(e.target.value)}
              placeholder="سبب جولة المبارزة..."
              className={`w-full text-center px-2 py-1.5 rounded-xl border text-[11px] font-bold transition-all ${
                isLight ? "bg-white border-slate-300 text-slate-800" : "bg-slate-950 border-slate-700 text-slate-300"
              }`}
            />
          </div>
        </div>

        {/* ===================== TEAM B HERO CARD ===================== */}
        <div className={`lg:col-span-5 rounded-3xl border-2 p-5 sm:p-6 transition-all relative overflow-hidden flex flex-col justify-between ${
          currentLeaderId === teamB.id
            ? isLight
              ? "bg-gradient-to-b from-amber-50 to-white border-amber-400 shadow-xl ring-2 ring-amber-400/40"
              : "bg-gradient-to-b from-amber-950/40 to-slate-900/90 border-amber-400 shadow-2xl shadow-amber-500/20 ring-2 ring-amber-500/30"
            : isLight
            ? "bg-white border-slate-300 shadow-sm"
            : "bg-slate-900/80 border-slate-800"
        }`}>
          {/* Top selection dropdown */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-4">
              <span className="text-xs font-black uppercase tracking-wider text-rose-500 flex items-center gap-1">
                <Swords className="h-4 w-4" />
                <span>الطرف الثاني (الفريق ب)</span>
              </span>
              {currentLeaderId === teamB.id && (
                <span className="px-2.5 py-1 rounded-xl bg-amber-500 text-slate-950 text-xs font-black flex items-center gap-1 shadow-sm">
                  <Crown className="h-3.5 w-3.5" />
                  <span>المتصدر لحظياً (+{pointDifference} XP)</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <select
                value={teamBId}
                onChange={(e) => {
                  sounds.playTap();
                  setTeamBId(e.target.value);
                }}
                className={`flex-1 p-2.5 rounded-2xl border-2 text-sm font-black transition-all cursor-pointer ${
                  isLight
                    ? "bg-slate-50 border-slate-300 text-slate-900"
                    : "bg-slate-800 border-slate-700 text-white"
                }`}
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id} disabled={t.id === teamAId}>
                    {t.icon} {t.name} (#{t.rank} - {t.points} XP)
                  </option>
                ))}
              </select>
            </div>

            {/* Hero Team Profile */}
            <div className="mt-5 flex items-center gap-4">
              <div className="relative shrink-0">
                <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-3xl overflow-hidden border-2 border-white/20 shadow-xl bg-slate-800 flex items-center justify-center">
                  {teamB.avatarUrl ? (
                    <img src={teamB.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-4xl">{teamB.icon}</span>
                  )}
                </div>
                <div className="absolute -bottom-2 -right-2 px-2.5 py-0.5 rounded-xl bg-slate-950 text-amber-400 border border-amber-500/40 text-xs font-black font-mono">
                  #{teamB.rank}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <h3 className={`text-xl sm:text-2xl font-black truncate ${isLight ? "text-slate-950" : "text-white"}`}>
                  {teamB.name}
                </h3>
                <p className={`text-xs font-bold line-clamp-1 mt-0.5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                  «{teamB.slogan || "فريق الإيمان والرجاء"}»
                </p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border ${
                    isLight ? "bg-slate-100 border-slate-300 text-slate-700" : "bg-slate-800 border-slate-700 text-slate-300"
                  }`}>
                    القائد: {teamB.leaderName || "غير محدد"}
                  </span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border ${
                    isLight ? "bg-slate-100 border-slate-300 text-slate-700" : "bg-slate-800 border-slate-700 text-slate-300"
                  }`}>
                    {teamB.membersCount} عضو
                  </span>
                </div>
              </div>
            </div>

            {/* Score Big Display */}
            <div className={`mt-6 p-4 rounded-2xl border-2 flex items-center justify-between ${
              isLight ? "bg-amber-50/80 border-amber-300" : "bg-slate-950/70 border-slate-800"
            }`}>
              <div>
                <div className={`text-xs font-black ${isLight ? "text-amber-900" : "text-amber-400"}`}>
                  النقاط التراكمية في المبارزة
                </div>
                <div className={`text-3xl sm:text-4xl font-black font-display font-mono ${
                  isLight ? "text-slate-950" : "text-white"
                }`}>
                  <motion.span
                    key={teamB.points}
                    initial={{ scale: 1.25, color: "#10B981" }}
                    animate={{ scale: 1, color: isLight ? "#020617" : "#FFFFFF" }}
                    transition={{ duration: 0.5 }}
                  >
                    {teamB.points.toLocaleString("en-US")}
                  </motion.span>{" "}
                  <span className="text-base text-amber-500 font-arabic">XP</span>
                </div>
              </div>
              <div className="text-right">
                <span className={`text-lg sm:text-xl font-black font-mono ${
                  currentLeaderId === teamB.id ? "text-emerald-500" : "text-slate-400"
                }`}>
                  {percentB}%
                </span>
                <div className="text-[10px] text-slate-400 font-bold">نسبة القوة</div>
              </div>
            </div>
          </div>

          {/* Quick Duel Points Injector for Team B */}
          <div className="mt-6 pt-4 border-t border-slate-700/40">
            <div className="text-xs font-black mb-2 flex items-center justify-between">
              <span className={isLight ? "text-slate-800 font-black" : "text-slate-300"}>
                رصد فوري لـ «{teamB.name}»:
              </span>
              {feedbackMsg?.teamId === teamB.id && (
                <span className={`text-[11px] font-black ${feedbackMsg.type === "success" ? "text-emerald-400" : "text-rose-400"}`}>
                  {feedbackMsg.text}
                </span>
              )}
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {[10, 25, 50, 100].map((pts) => (
                <button
                  key={pts}
                  type="button"
                  onClick={() => handleAwardDuelPoints(teamB, pts)}
                  className={`py-2 px-1 rounded-xl text-xs font-black border-2 transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1 ${
                    isLight
                      ? "bg-rose-50 hover:bg-rose-500 hover:text-white text-rose-900 border-rose-300"
                      : "bg-rose-950/60 hover:bg-rose-600 hover:text-white text-rose-300 border-rose-500/40"
                  }`}
                  title={`إضافة +${pts} XP`}
                >
                  <Plus className="h-3 w-3" />
                  <span>{pts} XP</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ===================== VISUAL TUG-OF-WAR BAR ===================== */}
      <div className={`p-5 rounded-3xl border-2 space-y-3 ${
        isLight ? "bg-white border-slate-300 shadow-sm" : "bg-slate-900/90 border-slate-800 shadow-xl"
      }`}>
        <div className="flex items-center justify-between text-xs font-black">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-blue-500" />
            <span className={isLight ? "text-blue-900" : "text-blue-400"}>{teamA.name} ({percentA}%)</span>
          </div>
          <div className="text-amber-400 flex items-center gap-1.5 font-bold">
            <Sparkles className="h-4 w-4" />
            <span>شريط شد الحبل وتوازن القوى لحظياً</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={isLight ? "text-rose-900" : "text-rose-400"}>{teamB.name} ({percentB}%)</span>
            <span className="h-3 w-3 rounded-full bg-rose-500" />
          </div>
        </div>

        {/* Dynamic Split Progress Bar */}
        <div className="relative h-6 rounded-2xl bg-slate-950 overflow-hidden p-1 border-2 border-slate-800 flex items-center">
          <motion.div
            initial={false}
            animate={{ width: `${percentA}%` }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="h-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-500 shadow-lg relative"
          />
          <motion.div
            initial={false}
            animate={{ width: `${percentB}%` }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="h-full rounded-xl bg-gradient-to-r from-orange-500 to-rose-600 shadow-lg relative"
          />

          {/* Center Needle Marker */}
          <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-1 bg-white shadow-xl z-20 pointer-events-none" />
        </div>
      </div>

      {/* ===================== INTERACTIVE COMPARISON TABLE ===================== */}
      <div className={`rounded-3xl border-2 overflow-hidden ${
        isLight ? "bg-white border-slate-300 shadow-sm" : "bg-slate-900/90 border-slate-800 shadow-xl"
      }`}>
        <div className={`p-4 border-b flex items-center justify-between ${
          isLight ? "bg-slate-50 border-slate-200" : "bg-slate-950/60 border-slate-800"
        }`}>
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            <h3 className={`text-base font-black ${isLight ? "text-slate-950" : "text-white"}`}>
              جدول المقارنة التفاعلي والمؤشرات التفصيلية
            </h3>
          </div>
          <span className="text-xs font-bold text-slate-400">
            تحديث لحظي متزامن مع السحاب ⚡
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs sm:text-sm">
            <thead>
              <tr className={`border-b text-xs font-black uppercase ${
                isLight ? "bg-slate-100/80 border-slate-200 text-slate-700" : "bg-slate-950 border-slate-800 text-slate-400"
              }`}>
                <th className="p-3.5">وجه المقارنة</th>
                <th className="p-3.5 text-center text-blue-400">{teamA.icon} {teamA.name}</th>
                <th className="p-3.5 text-center">الفارق والمؤشر</th>
                <th className="p-3.5 text-center text-rose-400">{teamB.icon} {teamB.name}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {metrics.map((m) => (
                <tr
                  key={m.id}
                  className={`transition-colors ${
                    isLight ? "hover:bg-slate-50 text-slate-800" : "hover:bg-slate-800/40 text-slate-200"
                  }`}
                >
                  <td className="p-3.5 font-bold flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    <span>{m.label}</span>
                  </td>

                  {/* Team A value */}
                  <td className={`p-3.5 text-center font-black ${
                    m.winner === "A"
                      ? "text-emerald-500 bg-emerald-500/10 rounded-xl"
                      : ""
                  }`}>
                    <div className="inline-flex items-center gap-1.5">
                      {m.winner === "A" && <Crown className="h-3.5 w-3.5 text-amber-400" />}
                      <span>{m.valA}</span>
                    </div>
                  </td>

                  {/* Diff indicator */}
                  <td className="p-3.5 text-center font-bold text-xs text-slate-400">
                    <span className="px-2 py-0.5 rounded-md bg-slate-800/50 border border-slate-700">
                      {m.diff}
                    </span>
                  </td>

                  {/* Team B value */}
                  <td className={`p-3.5 text-center font-black ${
                    m.winner === "B"
                      ? "text-emerald-500 bg-emerald-500/10 rounded-xl"
                      : ""
                  }`}>
                    <div className="inline-flex items-center gap-1.5">
                      {m.winner === "B" && <Crown className="h-3.5 w-3.5 text-amber-400" />}
                      <span>{m.valB}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===================== ROSTERS SIDE-BY-SIDE ===================== */}
      <div className={`p-5 rounded-3xl border-2 space-y-4 ${
        isLight ? "bg-white border-slate-300 shadow-sm" : "bg-slate-900/90 border-slate-800 shadow-xl"
      }`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-sky-400" />
            <h3 className={`text-base font-black ${isLight ? "text-slate-950" : "text-white"}`}>
              كتيبة أبطال الفريقين (مقارنة الأعضاء جنباً إلى جنب)
            </h3>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={rosterSearch}
              onChange={(e) => setRosterSearch(e.target.value)}
              placeholder="بحث في أسماء الأعضاء..."
              className={`w-full pr-9 pl-3 py-1.5 rounded-xl border text-xs font-bold ${
                isLight ? "bg-slate-50 border-slate-300 text-slate-900" : "bg-slate-950 border-slate-700 text-slate-200"
              }`}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Team A Roster */}
          <div className={`p-4 rounded-2xl border-2 space-y-2 ${
            isLight ? "bg-blue-50/50 border-blue-200" : "bg-slate-950/60 border-slate-800"
          }`}>
            <div className="text-xs font-black text-blue-400 flex items-center justify-between pb-2 border-b border-blue-500/20">
              <span>{teamA.icon} {teamA.name} ({rosterMembersA.length} عضو)</span>
              <span>النقاط</span>
            </div>
            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {rosterMembersA.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">لا يوجد أعضاء يطابقون البحث</p>
              ) : (
                rosterMembersA.map((m, idx) => (
                  <div
                    key={m.id}
                    className={`p-2 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                      isLight ? "bg-white border-slate-200 text-slate-800" : "bg-slate-900 border-slate-800 text-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-mono font-bold opacity-60">#{idx + 1}</span>
                      <span className="font-bold truncate">{m.name}</span>
                      {m.roleLabel && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-slate-800 text-amber-300 border border-amber-500/30 shrink-0">
                          {m.roleLabel}
                        </span>
                      )}
                    </div>
                    <span className="font-black font-mono text-amber-400 shrink-0">
                      {m.points} XP
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Team B Roster */}
          <div className={`p-4 rounded-2xl border-2 space-y-2 ${
            isLight ? "bg-rose-50/50 border-rose-200" : "bg-slate-950/60 border-slate-800"
          }`}>
            <div className="text-xs font-black text-rose-400 flex items-center justify-between pb-2 border-b border-rose-500/20">
              <span>{teamB.icon} {teamB.name} ({rosterMembersB.length} عضو)</span>
              <span>النقاط</span>
            </div>
            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {rosterMembersB.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">لا يوجد أعضاء يطابقون البحث</p>
              ) : (
                rosterMembersB.map((m, idx) => (
                  <div
                    key={m.id}
                    className={`p-2 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                      isLight ? "bg-white border-slate-200 text-slate-800" : "bg-slate-900 border-slate-800 text-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-mono font-bold opacity-60">#{idx + 1}</span>
                      <span className="font-bold truncate">{m.name}</span>
                      {m.roleLabel && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-slate-800 text-amber-300 border border-amber-500/30 shrink-0">
                          {m.roleLabel}
                        </span>
                      )}
                    </div>
                    <span className="font-black font-mono text-amber-400 shrink-0">
                      {m.points} XP
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
