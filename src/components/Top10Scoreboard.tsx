import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Trophy,
  Users,
  Search,
  Sparkles,
  Crown,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  PartyPopper,
  Settings,
  Plus,
  Shield,
  Camera,
  KeyRound,
  QrCode,
  AlertCircle,
  CheckCircle,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  TrendingDown,
  Edit2,
} from "lucide-react";
import type { ProcessedMeetingTeam } from "../types";
import { meetingStore } from "../utils/meetingStore";
import { sounds } from "../utils/soundEffects";
import { authStore, type SystemUser } from "../utils/authStore";
import { ConfettiCanvas, type ConfettiCanvasRef } from "./ConfettiCanvas";
import { TeamModal } from "./TeamModal";
import { AdminPanel } from "./AdminPanel";
import { AdminDashboard } from "./AdminDashboard";
import { QRScannerModal } from "./QRScannerModal";
import { UserSwitcherModal } from "./UserSwitcherModal";
export const Top10Scoreboard: React.FC = () => {
  const [data, setData] = useState(meetingStore.getData());
  const [isLoading, setIsLoading] = useState(meetingStore.getIsLoading());
  const [currentUser, setCurrentUser] = useState<SystemUser>(authStore.getCurrentUser());
  const [selectedTeam, setSelectedTeam] = useState<ProcessedMeetingTeam | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"scoreboard" | "admin">("scoreboard");
  const [adminInitialTab, setAdminInitialTab] = useState<any>(undefined);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showUserSwitcher, setShowUserSwitcher] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const confettiRef = useRef<ConfettiCanvasRef | null>(null);

  // Subscribe to meetingStore and authStore changes
  useEffect(() => {
    const unsubStore = meetingStore.subscribe(() => {
      setData({ ...meetingStore.getData() });
      setIsLoading(meetingStore.getIsLoading());
    });
    const unsubAuth = authStore.subscribe(() => {
      setCurrentUser(authStore.getCurrentUser());
    });
    return () => {
      unsubStore();
      unsubAuth();
    };
  }, []);

  // Listen to fullscreen changes
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const processedTeams = useMemo(() => {
    return meetingStore.getProcessedTeams();
  }, [data]);

  // Rank change and position shift animation tracking
  const prevRanksRef = useRef<Record<string, number>>({});
  const prevPointsRef = useRef<Record<string, number>>({});
  const isFirstRenderRef = useRef<boolean>(true);
  const [rankChanges, setRankChanges] = useState<
    Record<string, { delta: number; type: "up" | "down"; timestamp: number }>
  >({});
  const [pointDeltas, setPointDeltas] = useState<Record<string, { delta: number; timestamp: number }>>({});
  const [newLeaderNotice, setNewLeaderNotice] = useState<{ teamName: string; icon: string } | null>(null);

  useEffect(() => {
    if (isFirstRenderRef.current) {
      const initialRanks: Record<string, number> = {};
      const initialPoints: Record<string, number> = {};
      processedTeams.forEach((t) => {
        initialRanks[t.id] = t.rank;
        initialPoints[t.id] = t.points;
      });
      prevRanksRef.current = initialRanks;
      prevPointsRef.current = initialPoints;
      isFirstRenderRef.current = false;
      return;
    }

    const currentRanks = prevRanksRef.current;
    const currentPoints = prevPointsRef.current;
    const nextChanges: Record<string, { delta: number; type: "up" | "down"; timestamp: number }> = { ...rankChanges };
    const nextPointDeltas: Record<string, { delta: number; timestamp: number }> = {};
    let hasClimbed = false;
    let newLeaderFound: { teamName: string; icon: string } | null = null;

    processedTeams.forEach((team) => {
      const oldRank = currentRanks[team.id];
      const oldPoints = currentPoints[team.id] ?? team.points;

      // Check points change
      if (team.points !== oldPoints) {
        nextPointDeltas[team.id] = {
          delta: team.points - oldPoints,
          timestamp: Date.now(),
        };
      }

      // Check rank change
      if (oldRank !== undefined && oldRank !== team.rank) {
        // oldRank 4 -> newRank 2 => delta = 2 (climbed up 2 ranks!)
        const delta = oldRank - team.rank;
        const type = delta > 0 ? "up" : "down";
        nextChanges[team.id] = { delta, type, timestamp: Date.now() };

        if (delta > 0) {
          hasClimbed = true;
          if (team.rank === 1 && oldRank > 1) {
            newLeaderFound = { teamName: team.name, icon: team.icon };
          }
        }
      }
    });

    if (hasClimbed) {
      sounds.playVictory();
    }

    if (newLeaderFound) {
      setNewLeaderNotice(newLeaderFound);
      confettiRef.current?.celebrateWinner();
      setTimeout(() => setNewLeaderNotice(null), 6000);
    }

    setRankChanges(nextChanges);
    if (Object.keys(nextPointDeltas).length > 0) {
      setPointDeltas((prev) => ({ ...prev, ...nextPointDeltas }));
    }

    // Update stored ranks & points
    const updatedRanks: Record<string, number> = {};
    const updatedPoints: Record<string, number> = {};
    processedTeams.forEach((t) => {
      updatedRanks[t.id] = t.rank;
      updatedPoints[t.id] = t.points;
    });
    prevRanksRef.current = updatedRanks;
    prevPointsRef.current = updatedPoints;

    // Clear stale rank change badges after 6.5 seconds
    const timer = setTimeout(() => {
      setRankChanges({});
      setPointDeltas({});
    }, 6500);

    return () => clearTimeout(timer);
  }, [processedTeams]);

  // Sync active modal team if data changes
  const activeModalTeam = useMemo(() => {
    if (!selectedTeam) return null;
    return processedTeams.find((t) => t.id === selectedTeam.id) || selectedTeam;
  }, [selectedTeam, processedTeams]);

  // Filtered teams by search query
  const filteredTeams = useMemo(() => {
    if (!searchQuery.trim()) return processedTeams;
    const q = searchQuery.toLowerCase().trim();
    return processedTeams.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.slogan && t.slogan.toLowerCase().includes(q)) ||
        (t.leaderName && t.leaderName.toLowerCase().includes(q)) ||
        t.members.some((m) => m.name.toLowerCase().includes(q))
    );
  }, [processedTeams, searchQuery]);

  const totalMembers = data.members.length;
  const totalTeams = data.teams.length;
  const totalPoints = useMemo(() => {
    return data.teams.reduce((sum, t) => sum + (t.points || 0), 0);
  }, [data.teams]);

  const toggleMute = () => {
    const next = sounds.toggleMute();
    setIsMuted(next);
    if (!next) sounds.playTap();
  };

  const toggleFullscreen = () => {
    sounds.playTap();
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    } else {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
  };

  const triggerCelebrate = () => {
    sounds.playVictory();
    confettiRef.current?.celebrateWinner();
  };

  const handleQuickAdd = async (e: React.MouseEvent, team: ProcessedMeetingTeam, points = 50) => {
    e.stopPropagation();
    if (!currentUser.permissions.canAwardPoints) {
      sounds.playClose();
      setToastMsg("⚠️ رصد النقاط اليدوي مقصور على المسؤولين فقط. يمكن لقادة المجموعات مسح QR للحضور.");
      setTimeout(() => setToastMsg(null), 3500);
      return;
    }
    const res = await meetingStore.awardPoints(
      {
        targetType: "team",
        targetId: team.id,
        points,
        reason: `رصد نقاط مباشر من شاشة العرض لـ ${team.name}`,
        category: "تحدي فوري",
      },
      currentUser
    );
    if (res) {
      sounds.playVictory();
    } else {
      sounds.playClose();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-[#070A1E] flex flex-col items-center justify-center gap-6" dir="rtl">
        <div className="relative w-24 h-24">
          <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full animate-pulse" />
          <div className="absolute inset-0 border-t-4 border-blue-500 rounded-full animate-spin" />
        </div>
        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-black text-white tracking-widest animate-pulse">جاري جلب البيانات...</h2>
          <p className="text-blue-400 font-bold">يرجى الانتظار، جاري المزامنة مع السحاب ⚡</p>
        </div>
      </div>
    );
  }

  // If Admin View is active, render AdminDashboard
  if (viewMode === "admin") {
    return <AdminDashboard 
      onBackToScoreboard={() => {
        setViewMode("scoreboard");
        setAdminInitialTab(undefined);
      }} 
      initialPanelTab={adminInitialTab}
    />;
  }

  return (
    <div
      className="relative min-h-[100dvh] w-full bg-[#070A1E] text-slate-100 overflow-x-hidden select-none font-arabic"
      dir="rtl"
    >
      {/* Background ambient lighting */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[500px] bg-gradient-to-b from-blue-600/15 via-purple-600/10 to-transparent blur-3xl opacity-70" />
        <div className="absolute top-[35%] -left-48 w-96 h-96 bg-amber-500/10 blur-[130px] rounded-full" />
        <div className="absolute top-[45%] -right-48 w-96 h-96 bg-rose-500/10 blur-[130px] rounded-full" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] opacity-40" />
      </div>

      {/* Confetti Canvas */}
      <ConfettiCanvas ref={confettiRef} />

      <div className="relative z-10 max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-16 flex flex-col min-h-screen">
        {/* Top Header Card */}
        <header className="rounded-3xl border border-slate-800/90 bg-[#0B132B]/85 backdrop-blur-2xl p-4 sm:p-5 shadow-[0_20px_50px_rgba(0,0,0,0.6)] mb-5">
          <div className="flex items-center justify-between gap-3 flex-wrap md:flex-nowrap">
            {/* Title & Brand */}
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 text-slate-950 font-black shadow-lg shadow-amber-500/25 shrink-0">
                <Trophy className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
              </span>

              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-[10px] sm:text-[11px] font-black text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                    <span>مباشر • لوحة شرف الاجتماع</span>
                  </span>
                  <span className="text-[10px] sm:text-xs text-slate-400 font-medium">
                    {data.config.churchName}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight leading-tight">
                    {data.config.meetingName}
                  </h1>
                  {currentUser.role === "admin" && (
                    <button
                      onClick={() => {
                        sounds.playTap();
                        setAdminInitialTab("settings");
                        setViewMode("admin");
                      }}
                      className="p-1.5 rounded-lg bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition-all cursor-pointer"
                      title="تعديل اسم الاجتماع والكنيسة"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <p className="text-[10px] sm:text-xs text-slate-300 font-medium">
                  {data.config.subTitle} • المس أي فريق لعرض قائمة الأعضاء والنقاط
                </p>
              </div>
            </div>

            {/* Emblem */}
            <div className="flex flex-col items-center justify-center px-4 py-2 rounded-2xl bg-slate-900/90 border border-amber-500/30 shadow-inner shrink-0">
              <span className="text-[10px] sm:text-[11px] font-black text-amber-400 tracking-wider">
                TOP
              </span>
              <span className="text-sm sm:text-base font-black text-amber-300 leading-none">
                {totalTeams}
              </span>
            </div>

            {/* Controls & Admin Access */}
            <div className="flex flex-col gap-2 items-end shrink-0">
              <div className="flex items-center gap-2">
                {/* Total points badge */}
                <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/80 px-3 py-1.5">
                  <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
                  <div className="text-right">
                    <div className="text-xs font-black text-amber-300 leading-none font-mono">
                      {totalPoints.toLocaleString("en-US")} XP
                    </div>
                    <div className="text-[9px] text-slate-400 mt-0.5">إجمالي النقاط</div>
                  </div>
                </div>

                {/* Total attendees badge */}
                <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/80 px-3 py-1.5">
                  <Users className="h-4 w-4 text-sky-400 shrink-0" />
                  <div className="text-right">
                    <div className="text-xs font-black text-sky-400 leading-none font-mono">
                      {totalMembers} عضو
                    </div>
                    <div className="text-[9px] text-slate-400 mt-0.5">{totalTeams} مجموعات</div>
                  </div>
                </div>
              </div>

              {/* Action buttons row */}
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                {/* Active User Switcher Pill */}
                <button
                  type="button"
                  onClick={() => {
                    sounds.playTap();
                    setShowUserSwitcher(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 border border-amber-500/40 text-amber-300 text-xs font-bold shadow-sm active:scale-95 transition-all cursor-pointer"
                  title="تبديل الحساب أو تسجيل الدخول بكود العضو"
                >
                  <KeyRound className="h-3.5 w-3.5 text-amber-400" />
                  <span>{currentUser.name.split(" ")[0]} ({currentUser.roleLabel}) 🔑</span>
                </button>

                {/* Direct Scan QR Button for leaders/all */}
                <button
                  type="button"
                  onClick={() => {
                    sounds.playTap();
                    setShowQRScanner(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-black shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
                  title="مسح رمز QR الفعالية لتسجيل الحضور واحتساب النقاط تلقائياً"
                >
                  <Camera className="h-3.5 w-3.5" />
                  <span>مسح QR للحضور 📱</span>
                </button>

                {/* Admin Panel Button */}
                <button
                  type="button"
                  onClick={() => {
                    sounds.playTap();
                    setViewMode("admin");
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 text-xs font-black shadow-sm active:scale-95 transition-all cursor-pointer"
                  title="فتح لوحة تحكم الخادم لرصد النقاط وتعديل الفرق"
                >
                  <Settings className="h-3.5 w-3.5" />
                  <span>لوحة تحكم الخادم ⚙️</span>
                </button>

                {/* Celebrate winner button */}
                <button
                  type="button"
                  onClick={triggerCelebrate}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-black shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
                  title="احتفال بالمتصدر"
                >
                  <PartyPopper className="h-3.5 w-3.5" />
                  <span>احتفال بالبطل</span>
                </button>

                {/* Sound toggle */}
                <button
                  type="button"
                  onClick={toggleMute}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white shadow-xs active:scale-95 transition-all cursor-pointer"
                  title={isMuted ? "تشغيل المؤثرات الصوتية" : "كتم الصوت"}
                >
                  {isMuted ? (
                    <VolumeX className="h-4 w-4 text-rose-400" />
                  ) : (
                    <Volume2 className="h-4 w-4 text-emerald-400" />
                  )}
                </button>

                {/* Fullscreen toggle */}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white shadow-xs active:scale-95 transition-all cursor-pointer"
                  title={isFullscreen ? "إنهاء ملء الشاشة" : "ملء الشاشة للشاشات التفاعلية"}
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-4 w-4 text-sky-400" />
                  ) : (
                    <Maximize2 className="h-4 w-4 text-sky-400" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative mt-3.5 pt-3 border-t border-slate-800/80">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن اسم فريق أو قائد أو شعار أو عضو..."
              className="w-full h-10 sm:h-11 pr-10 pl-4 rounded-xl bg-slate-900/80 border border-slate-700/80 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400 shadow-inner"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white px-2 py-0.5 bg-slate-800 rounded-md cursor-pointer"
              >
                مسح
              </button>
            )}
          </div>
        </header>

        {/* Permission / Action Toast Alert */}
        {toastMsg && (
          <div className="mb-4 p-4 rounded-2xl bg-rose-950/90 border border-rose-500/60 text-rose-200 text-xs sm:text-sm font-bold flex items-center gap-2.5 shadow-xl animate-bounce">
            <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* New Leader Celebration Announcement */}
        <AnimatePresence>
          {newLeaderNotice && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 350, damping: 20 }}
              className="mb-4 p-4 rounded-3xl bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-500 text-slate-950 font-black flex items-center justify-between shadow-2xl shadow-amber-500/30 border-2 border-white ring-4 ring-amber-400/40"
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl p-1 bg-white/25 rounded-2xl shadow-inner">
                  {newLeaderNotice.icon}
                </span>
                <div>
                  <div className="text-xs uppercase tracking-wider font-extrabold text-slate-900 flex items-center gap-1">
                    <Crown className="h-4 w-4" />
                    <span>متصدر جديد للائحة الشرف الكبرى!</span>
                  </div>
                  <div className="text-base sm:text-lg font-black mt-0.5">
                    فريق «{newLeaderNotice.teamName}» ينتزع المركز الأول بجدارة! 🏆
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-3 py-1 rounded-full bg-slate-950 text-amber-300 font-bold hidden sm:inline-block">
                  #1 الصدارة
                </span>
                <PartyPopper className="h-7 w-7 text-slate-950 animate-bounce" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Teams List with Layout Animations */}
        <section className="space-y-3 flex-1">
          {filteredTeams.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm bg-slate-900/40 rounded-3xl border border-slate-800 space-y-3">
              <p>لا توجد فرق مطابقة للبحث أو لم يتم إضافة فرق بعد.</p>
              <button
                type="button"
                onClick={() => setViewMode("admin")}
                className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
              >
                فتح لوحة التحكم لإضافة فرق
              </button>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filteredTeams.map((team) => {
                const change = rankChanges[team.id];
                const pointDelta = pointDeltas[team.id];
                const isRank1 = team.rank === 1;
                const isRank2 = team.rank === 2;
                const isRank3 = team.rank === 3;
                const hasShiftedUp = change?.type === "up";
                const hasShiftedDown = change?.type === "down";

                return (
                  <motion.div
                    key={team.id}
                    layout
                    initial={{ opacity: 0, y: 20, scale: 0.98 }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: 1,
                    }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{
                      layout: {
                        type: "spring",
                        stiffness: 280,
                        damping: 24,
                        mass: 0.85,
                      },
                      duration: 0.35,
                    }}
                    whileHover={{ scale: 1.008, transition: { duration: 0.15 } }}
                    whileTap={{ scale: 0.992 }}
                    onClick={(e) => {
                      sounds.playOpen();
                      if (isRank1) {
                        confettiRef.current?.burst(e.clientX, e.clientY);
                      }
                      setSelectedTeam(team);
                    }}
                    className={`group relative flex flex-row items-center justify-between px-3.5 sm:px-5 py-3 sm:py-3.5 rounded-2xl sm:rounded-3xl border transition-all duration-300 cursor-pointer shadow-lg ${
                      hasShiftedUp
                        ? "ring-2 ring-emerald-400 border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.3)] bg-gradient-to-r from-emerald-950/40 via-[#0B132B] to-[#121B42]"
                        : hasShiftedDown
                        ? "ring-1 ring-rose-500/60 border-rose-500/60 shadow-[0_0_20px_rgba(244,63,94,0.2)] bg-gradient-to-r from-rose-950/30 via-[#0B132B] to-[#121B42]"
                        : isRank1
                        ? "bg-gradient-to-r from-[#161B3D] via-[#0D1535] to-[#121B42] border-amber-400/80 shadow-[0_0_24px_rgba(245,178,26,0.18)]"
                        : isRank2
                        ? "bg-gradient-to-r from-[#121730] via-[#0B132B] to-[#101938] border-slate-400/70 shadow-[0_0_18px_rgba(203,213,225,0.12)]"
                        : isRank3
                        ? "bg-gradient-to-r from-[#151428] via-[#0B132B] to-[#131330] border-orange-500/70 shadow-[0_0_18px_rgba(249,115,22,0.12)]"
                        : "bg-[#0B132B]/85 hover:bg-[#0E1738] border-slate-800/90 hover:border-slate-700/90 shadow-black/40"
                    }`}
                    style={{
                      borderRightWidth: "6px",
                      borderRightColor: team.color,
                    }}
                  >
                    {/* Floating Point Delta animation */}
                    {pointDelta && (
                      <motion.div
                        initial={{ opacity: 0, y: 5, scale: 0.8 }}
                        animate={{ opacity: 1, y: -22, scale: 1.05 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.2, ease: "easeOut" }}
                        className={`absolute -top-1 left-24 sm:left-32 px-2.5 py-0.5 rounded-full font-mono text-xs font-black shadow-lg pointer-events-none z-20 ${
                          pointDelta.delta > 0
                            ? "bg-emerald-500 text-slate-950 shadow-emerald-500/40"
                            : "bg-rose-500 text-white shadow-rose-500/40"
                        }`}
                      >
                        {pointDelta.delta > 0 ? `+${pointDelta.delta}` : pointDelta.delta} XP
                      </motion.div>
                    )}

                    {/* Left Info: Rank, Icon, Name, Slogan, Leaders */}
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1 pl-2 sm:pl-3">
                      {/* Rank Badge */}
                      <div
                        className={`relative flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl font-black shadow-md border ${
                          isRank1
                            ? "bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 border-white shadow-amber-500/30"
                            : isRank2
                            ? "bg-gradient-to-br from-slate-200 to-slate-400 text-slate-950 border-white shadow-slate-400/25"
                            : isRank3
                            ? "bg-gradient-to-br from-orange-400 to-amber-700 text-white border-white shadow-orange-500/25"
                            : "bg-slate-800/90 text-slate-200 border-slate-700/80"
                        }`}
                      >
                        <div className="flex flex-col items-center leading-none">
                          <span className="text-[10px] sm:text-xs opacity-75">#</span>
                          <motion.span
                            key={team.rank}
                            initial={{ scale: 1.35, y: hasShiftedUp ? 4 : hasShiftedDown ? -4 : 0 }}
                            animate={{ scale: 1, y: 0 }}
                            transition={{ type: "spring", stiffness: 450, damping: 18 }}
                            className="text-base sm:text-xl font-black"
                          >
                            {team.rank}
                          </motion.span>
                        </div>

                        {/* Rank Shift Indicator Pip on the rank badge */}
                        {change && (
                          <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 500, damping: 20 }}
                            className={`absolute -top-2 -right-2 h-5 w-5 rounded-full flex items-center justify-center shadow-md font-bold text-[10px] ${
                              hasShiftedUp
                                ? "bg-emerald-500 text-slate-950 shadow-emerald-500/50"
                                : "bg-rose-500 text-white shadow-rose-500/50"
                            }`}
                            title={hasShiftedUp ? `صعود +${change.delta} مراكز` : `تراجع ${change.delta} مراكز`}
                          >
                            {hasShiftedUp ? (
                              <ArrowUp className="h-3 w-3 stroke-[3]" />
                            ) : (
                              <ArrowDown className="h-3 w-3 stroke-[3]" />
                            )}
                          </motion.div>
                        )}
                      </div>

                      {/* Team Icon */}
                      <div
                        className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl text-xl sm:text-2xl border shadow-inner"
                        style={{
                          backgroundColor: `${team.color}22`,
                          borderColor: `${team.color}55`,
                        }}
                      >
                        {team.icon}
                      </div>

                      {/* Team Names and Metadata */}
                      <div className="space-y-0.5 sm:space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3
                            className={`font-black text-base sm:text-lg lg:text-xl tracking-tight transition-colors whitespace-nowrap ${
                              isRank1
                                ? "text-amber-300"
                                : isRank2
                                ? "text-slate-100"
                                : isRank3
                                ? "text-orange-300"
                                : "text-white group-hover:text-amber-300"
                            }`}
                          >
                            {team.name}
                          </h3>

                          {/* Rank Shift Pill */}
                          {change && (
                            <motion.span
                              initial={{ scale: 0, opacity: 0, x: -10 }}
                              animate={{ scale: 1, opacity: 1, x: 0 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={{ type: "spring", stiffness: 500, damping: 20 }}
                              className={`px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black flex items-center gap-1 shadow-sm ${
                                hasShiftedUp
                                  ? "bg-emerald-500/25 text-emerald-300 border border-emerald-400/50 shadow-emerald-500/20"
                                  : "bg-rose-500/20 text-rose-300 border border-rose-400/40"
                              }`}
                            >
                              {hasShiftedUp ? (
                                <>
                                  <TrendingUp className="h-3 w-3 text-emerald-400" />
                                  <span>+{change.delta} صعود</span>
                                </>
                              ) : (
                                <>
                                  <TrendingDown className="h-3 w-3 text-rose-400" />
                                  <span>{change.delta} تراجع</span>
                                </>
                              )}
                            </motion.span>
                          )}

                          {team.isTied ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] sm:text-[11px] font-black flex items-center gap-1 shrink-0">
                              <Sparkles className="h-3 w-3 text-amber-400" />
                              <span>تعادل في الصدارة</span>
                            </span>
                          ) : (
                            <>
                              {isRank1 && (
                                <span className="px-2.5 py-0.5 rounded-full bg-amber-400/25 text-amber-300 border border-amber-400/50 text-[10px] sm:text-[11px] font-black flex items-center gap-1 shrink-0">
                                  <Crown className="h-3 w-3 text-amber-400" />
                                  <span>المتصدر</span>
                                </span>
                              )}
                              {isRank2 && (
                                <span className="px-2.5 py-0.5 rounded-full bg-slate-300/20 text-slate-200 border border-slate-300/40 text-[10px] sm:text-[11px] font-black shrink-0">
                                  الوصيف
                                </span>
                              )}
                              {isRank3 && (
                                <span className="px-2.5 py-0.5 rounded-full bg-orange-400/20 text-orange-300 border border-orange-400/40 text-[10px] sm:text-[11px] font-black shrink-0">
                                  المركز الثالث
                                </span>
                              )}
                            </>
                          )}
                        </div>

                        {/* Stats Badges */}
                        <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-slate-300 flex-wrap">
                          {team.slogan && (
                            <>
                              <span className="text-amber-300/90 font-medium truncate max-w-[200px] sm:max-w-none">
                                "{team.slogan}"
                              </span>
                              <span className="text-slate-500">•</span>
                            </>
                          )}
                          <span className="text-slate-300 font-medium whitespace-nowrap">
                            {team.membersCount} مشاركاً
                          </span>
                          {team.leaderName && (
                            <>
                              <span className="text-slate-500">•</span>
                              <span className="text-slate-400 font-normal">
                                القائد: {team.leaderName}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: XP Score + Quick +50 XP trigger */}
                    <div className="flex items-center gap-2.5 sm:gap-4 shrink-0 mr-1 sm:mr-3">
                      {/* Quick +50 button for fast in-game scoring */}
                      <button
                        type="button"
                        onClick={(e) => handleQuickAdd(e, team, 50)}
                        className="hidden sm:flex h-8 px-2.5 rounded-xl bg-slate-800/80 hover:bg-amber-500 hover:text-slate-950 text-amber-400 text-xs font-bold border border-slate-700 items-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
                        title="إضافة سريعة +50 نقطة للفريق"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>50 XP</span>
                      </button>

                      <div className="flex flex-col items-start" dir="ltr">
                        <div className="flex items-baseline gap-1 text-amber-400 font-display">
                          <span className="text-xs sm:text-sm font-bold text-amber-300/90 font-arabic">
                            XP
                          </span>
                          <motion.span
                            key={team.points}
                            initial={{ scale: 1.25, color: "#10B981" }}
                            animate={{ scale: 1, color: "#FBBF24" }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                            className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight font-display"
                          >
                            {team.points.toLocaleString("en-US")}
                          </motion.span>
                        </div>
                        <div className="text-[10px] text-slate-400" dir="rtl">
                          المجموع التراكمي
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </section>

        {/* Footer info */}
        <footer className="mt-8 text-center text-xs text-slate-500 space-y-1">
          <p>
            {data.config.meetingName} • {data.config.churchName}
          </p>
          <p className="text-[11px] text-slate-600">
            {data.config.seasonName} • نظام السكور بورد ولوحة الشرف التفاعلية للشباب
          </p>
        </footer>
      </div>

      {/* Active Team Modal */}
      {activeModalTeam && (
        <TeamModal team={activeModalTeam} onClose={() => setSelectedTeam(null)} />
      )}

      {/* QR Attendance Scanner Modal */}
      {showQRScanner && (
        <QRScannerModal onClose={() => setShowQRScanner(false)} />
      )}

      {/* User Switcher / PIN Login Modal */}
      {showUserSwitcher && (
        <UserSwitcherModal onClose={() => setShowUserSwitcher(false)} />
      )}
    </div>
  );
};
