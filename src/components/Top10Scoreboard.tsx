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
  X,
  Tv,
  LayoutGrid,
  List,
  Share2,
  Link2,
  Sun,
  Moon,
  Clock,
} from "lucide-react";
import type { CustomMember, ProcessedMeetingTeam } from "../types";
import { meetingStore } from "../utils/meetingStore";
import { sounds } from "../utils/soundEffects";
import { authStore, type SystemUser } from "../utils/authStore";
import { useTheme } from "../utils/themeStore";
import { ConfettiCanvas, type ConfettiCanvasRef } from "./ConfettiCanvas";
import { TeamModal } from "./TeamModal";
import { TeamPhotoModal } from "./TeamPhotoModal";
import { AdminPanel } from "./AdminPanel";
import { AdminDashboard } from "./AdminDashboard";
import { QRScannerModal } from "./QRScannerModal";
import { UserSwitcherModal } from "./UserSwitcherModal";
import { DailyChallengeBanner } from "./DailyChallengeBanner";

interface Top10ScoreboardProps {
  onReturnToWelcome?: () => void;
}

export const Top10Scoreboard: React.FC<Top10ScoreboardProps> = ({ onReturnToWelcome }) => {
  const { preference: themePreference, isDaytime, isLight, setPreference: setThemePreference } = useTheme();
  const [data, setData] = useState(meetingStore.getData());
  const [isLoading, setIsLoading] = useState(meetingStore.getIsLoading());
  const [currentUser, setCurrentUser] = useState<SystemUser>(authStore.getCurrentUser());
  const [selectedTeam, setSelectedTeam] = useState<ProcessedMeetingTeam | null>(null);
  const [photoUploadTeam, setPhotoUploadTeam] = useState<ProcessedMeetingTeam | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTvMode, setIsTvMode] = useState<boolean>(false);
  const [tvScale, setTvScale] = useState<"normal" | "large" | "xl">("large");
  const [tvColumns, setTvColumns] = useState<"single" | "grid">("single");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"points-desc" | "points-asc">("points-desc");
  const [viewMode, setViewMode] = useState<"scoreboard" | "admin">("scoreboard");
  const [adminInitialTab, setAdminInitialTab] = useState<any>(undefined);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showUserSwitcher, setShowUserSwitcher] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toasts, setToasts] = useState<
    Array<{
      id: string;
      type: "leader_change" | "rank_up" | "rank_down" | "info" | "success" | "warning";
      title: string;
      message: string;
      teamIcon?: string;
      teamAvatarUrl?: string;
      timestamp: number;
    }>
  >([]);

  const confettiRef = useRef<ConfettiCanvasRef | null>(null);

  const addToast = (toast: {
    type: "leader_change" | "rank_up" | "rank_down" | "info" | "success" | "warning";
    title: string;
    message: string;
    teamIcon?: string;
    teamAvatarUrl?: string;
  }) => {
    const newToast = {
      ...toast,
      id: `toast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: Date.now(),
    };
    setToasts((prev) => [newToast, ...prev].slice(0, 5));
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Auto-dismiss oldest toast after 5s
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts((prev) => prev.slice(0, prev.length - 1));
    }, 5000);
    return () => clearTimeout(timer);
  }, [toasts]);

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

  // Escape key handler for fullscreen presentation mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        if (document.fullscreenElement) {
          document.exitFullscreen?.().catch(() => {});
        }
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  // Rank change and position shift animation tracking
  const prevRanksRef = useRef<Record<string, number>>({});
  const prevPointsRef = useRef<Record<string, number>>({});
  const isFirstRenderRef = useRef<boolean>(true);
  const [rankChanges, setRankChanges] = useState<
    Record<string, { delta: number; type: "up" | "down"; timestamp: number }>
  >({});
  const [pointDeltas, setPointDeltas] = useState<Record<string, { delta: number; timestamp: number }>>({});
  const [newLeaderNotice, setNewLeaderNotice] = useState<{ teamName: string; icon: string; avatarUrl?: string } | null>(null);

  // Handle auto-login from URL QR Code
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code && !isLoading && data.members.length > 0) {
      const result = authStore.loginWithCode(code, data.members, data.teams);
      if (result.success) {
        // Clear the query param from URL without refreshing to keep it clean
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        
        sounds.playVictory();
        addToast({
          type: "success",
          title: "لوحة الشرف الكبرى 🏆",
          message: `مرحباً بك يا ${result.user?.name}! تم تسجيل دخولك بنجاح والانتقال مباشرة إلى لوحة الشرف الكبرى.`,
        });
      } else {
        addToast({
          type: "warning",
          title: "خطأ في تسجيل الدخول",
          message: "كود الدخول من الـ QR غير صحيح أو منتهي الصلاحية.",
        });
      }
    }
  }, [isLoading, data.members, data.teams]);

  // Handle direct URL mode routing (?mode=admin or ?mode=public or ?admin=1)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");
    const admin = params.get("admin");
    if (mode === "admin" || admin === "true" || admin === "1" || window.location.pathname === "/admin") {
      setViewMode("admin");
    }
  }, []);

  // Secret shortcut (Ctrl+Shift+A) to toggle Admin Dashboard from anywhere
  useEffect(() => {
    const handleAdminHotkey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "A" || e.key === "a")) {
        e.preventDefault();
        sounds.playVictory();
        setViewMode((prev) => (prev === "admin" ? "scoreboard" : "admin"));
      }
    };
    window.addEventListener("keydown", handleAdminHotkey);
    return () => window.removeEventListener("keydown", handleAdminHotkey);
  }, []);

  // Determine if public / makhdoum mode is active (hides all admin controls, edit buttons, QR scanner, user switcher, and share links from public/makhdoum view)
  const isPublicDisplayMode = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");
    const view = params.get("view");
    if (mode === "public" || mode === "makhdoum" || view === "public" || params.get("public") === "true") return true;
    
    // If logged in as admin, priest, leader, or servant: unlock all admin/servant controls!
    if (currentUser.role === "admin" || currentUser.role === "priest" || currentUser.role === "leader" || currentUser.role === "servant") {
      return false;
    }
    
    // Default for guest / makhdoum members: read-only public mode
    return true;
  }, [currentUser.role]);

  const processedTeams = useMemo(() => {
    return meetingStore.getProcessedTeams();
  }, [data]);

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
    let newLeaderFound: { teamName: string; icon: string; avatarUrl?: string } | null = null;

    processedTeams.forEach((team) => {
      const oldRank = currentRanks[team.id];
      const oldPoints = currentPoints[team.id] ?? team.points;

      // Check points change
      if (team.points !== oldPoints) {
        const delta = team.points - oldPoints;
        nextPointDeltas[team.id] = {
          delta,
          timestamp: Date.now(),
        };

        // Live notification toast alerting viewers that points were updated by admin
        if (oldRank === team.rank) {
          addToast({
            type: delta > 0 ? "success" : "info",
            title: delta > 0 ? `⚡ تحديث نقاط: ${team.name}` : `تعديل نقاط: ${team.name}`,
            message: delta > 0
              ? `تم تحديث نقاط فريق «${team.name}» بإضافة +${delta.toLocaleString("en-US")} XP (الرصيد الحالي: ${team.points.toLocaleString("en-US")} XP)`
              : `تم تعديل نقاط فريق «${team.name}» بخصم ${Math.abs(delta).toLocaleString("en-US")} XP (الرصيد الحالي: ${team.points.toLocaleString("en-US")} XP)`,
            teamIcon: team.icon,
            teamAvatarUrl: team.avatarUrl,
          });
          sounds.playPointUp();
        }
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
            newLeaderFound = { teamName: team.name, icon: team.icon, avatarUrl: team.avatarUrl };
            addToast({
              type: "leader_change",
              title: "👑 متصدر جديد للائحة الشرف!",
              message: `صعد فريق «${team.name}» إلى المركز الأول بمجموع ${team.points.toLocaleString("en-US")} XP! 🏆`,
              teamIcon: team.icon,
              teamAvatarUrl: team.avatarUrl,
            });
          } else {
            addToast({
              type: "rank_up",
              title: `🚀 تقدم في الترتيب: ${team.name}`,
              message: `قفز فريق «${team.name}» إلى المركز #${team.rank} (تقدم ${delta} ${delta === 1 ? "مركز" : "مراكز"})!`,
              teamIcon: team.icon,
              teamAvatarUrl: team.avatarUrl,
            });
          }
        } else if (delta < 0) {
          addToast({
            type: "rank_down",
            title: `📉 تغيير الترتيب: ${team.name}`,
            message: `تراجع فريق «${team.name}» إلى المركز #${team.rank}.`,
            teamIcon: team.icon,
            teamAvatarUrl: team.avatarUrl,
          });
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

  // Filtered and sorted teams
  const filteredTeams = useMemo(() => {
    let list = [...processedTeams];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.slogan && t.slogan.toLowerCase().includes(q)) ||
          (t.leaderName && t.leaderName.toLowerCase().includes(q)) ||
          t.members.some((m) => m.name.toLowerCase().includes(q))
      );
    }

    if (sortOrder === "points-asc") {
      list.sort((a, b) => a.points - b.points);
    } else {
      // Default: "points-desc"
      list.sort((a, b) => b.points - a.points);
    }

    return list;
  }, [processedTeams, searchQuery, sortOrder]);

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
    if (document.fullscreenElement || isFullscreen) {
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
      setIsFullscreen(false);
    } else {
      setIsTvMode(true);
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen()
          .then(() => setIsFullscreen(true))
          .catch(() => {
            // Fallback for iframe restrictions: activate presentation fullscreen mode internally
            setIsFullscreen(true);
          });
      } else {
        setIsFullscreen(true);
      }
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
      className="relative min-h-[100dvh] w-full bg-[#0B0F2A] text-slate-100 overflow-x-hidden select-none font-arabic"
      dir="rtl"
    >
      {/* Background ambient lighting - Cheerful Vibrant Orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[550px] bg-gradient-to-b from-indigo-600/25 via-purple-600/20 to-transparent blur-3xl opacity-80" />
        <div className="absolute top-[25%] -left-40 w-[450px] h-[450px] bg-amber-500/20 blur-[140px] rounded-full" />
        <div className="absolute top-[35%] -right-40 w-[450px] h-[450px] bg-emerald-500/20 blur-[140px] rounded-full" />
        <div className="absolute top-[65%] left-1/3 w-[500px] h-[500px] bg-cyan-500/15 blur-[160px] rounded-full" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px] opacity-50" />
      </div>

      {/* Confetti Canvas */}
      <ConfettiCanvas ref={confettiRef} />

      <div className={`relative z-10 mx-auto flex flex-col min-h-screen transition-all duration-300 ${
        isTvMode || isFullscreen
          ? "w-full max-w-[1800px] px-3 sm:px-6 lg:px-10 2xl:px-14 pt-3 pb-16"
          : "max-w-6xl px-3 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-16"
      }`}>
        {/* Top Header Card */}
        <header className="rounded-3xl border border-slate-700/60 bg-slate-900/85 backdrop-blur-2xl p-4 sm:p-5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] mb-5">
          <div className="flex items-center justify-between gap-3 flex-wrap md:flex-nowrap">
            {/* Title & Brand */}
            <div className="flex items-center gap-3">
              <div className="relative flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-white/95 border-2 border-amber-400/80 shadow-lg shadow-amber-500/20 shrink-0 overflow-hidden p-0.5">
                <img
                  src={data.config.meetingLogoUrl || "/assets/aistudio/_______________________55ad5e73.png"}
                  alt="لوجو أسرة الشهيد العظيم أبي سيفين وتماف إيريني"
                  className="w-full h-full object-contain rounded-xl"
                />
              </div>

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
                  {!isPublicDisplayMode && currentUser.role === "admin" && (
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

              {/* Action buttons row - Unified Design System */}
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {/* Administrative Controls - Hidden in Public / Makhdoum View */}
                {!isPublicDisplayMode ? (
                  <>
                    {/* Active User Switcher Pill */}
                    <button
                      type="button"
                      onClick={() => {
                        sounds.playTap();
                        setShowUserSwitcher(true);
                      }}
                      className="h-9 px-3.5 rounded-xl bg-slate-900 border border-amber-500/40 text-amber-300 text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                      title="تبديل الحساب أو تسجيل الدخول بكود العضو"
                    >
                      <KeyRound className="h-4 w-4 text-amber-400 shrink-0" />
                      <span>{currentUser.name.split(" ")[0]} ({currentUser.roleLabel}) 🔑</span>
                    </button>

                    {/* Direct Scan QR Button */}
                    <button
                      type="button"
                      onClick={() => {
                        sounds.playTap();
                        setShowQRScanner(true);
                      }}
                      className="h-9 px-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-black shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                      title="مسح رمز QR الفعالية لتسجيل الحضور واحتساب النقاط تلقائياً"
                    >
                      <Camera className="h-4 w-4 shrink-0" />
                      <span>مسح QR للحضور 📱</span>
                    </button>

                    {/* Admin Panel Button */}
                    <button
                      type="button"
                      onClick={() => {
                        sounds.playTap();
                        setViewMode("admin");
                      }}
                      className="h-9 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 text-xs font-black shadow-xs active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                      title="فتح لوحة تحكم الخادم لرصد النقاط وتعديل الفرق"
                    >
                      <Settings className="h-4 w-4 shrink-0" />
                      <span>لوحة تحكم الخادم ⚙️</span>
                    </button>

                    {/* Exit to Public View Button */}
                    <button
                      type="button"
                      onClick={() => {
                        sounds.playClose();
                        authStore.logout();
                        addToast({
                          type: "info",
                          title: "الشاشة العامة (المخدومين)",
                          message: "تم تسجيل الخروج والعودة للشاشة العامة المقروءة فقط.",
                        });
                      }}
                      className="h-9 px-3.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-300 hover:text-white text-xs font-black shadow-xs active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                      title="تسجيل الخروج والرجوع إلى شاشة العرض العامة المقروءة للمخدومين فقط"
                    >
                      <span>🚪 خروج للشاشة العامة</span>
                    </button>
                  </>
                ) : (
                  <>
                    {onReturnToWelcome && (
                      <button
                        type="button"
                        onClick={() => {
                          sounds.playTap();
                          onReturnToWelcome();
                        }}
                        className="h-9 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-300/40 text-xs font-black shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                        title="العودة لصفحة الدخول والشعار الرئيسية لإدخال الكود أو مسح الباركود"
                      >
                        <KeyRound className="h-4 w-4 shrink-0" />
                        <span>🔑 صفحة الدخول والكود</span>
                      </button>
                    )}
                  </>
                )}

                {/* Celebrate winner button */}
                <button
                  type="button"
                  onClick={triggerCelebrate}
                  className="h-9 px-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-black shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                  title="احتفال بالمتصدر"
                >
                  <PartyPopper className="h-4 w-4 shrink-0" />
                  <span>احتفال بالبطل</span>
                </button>

                {/* Fullscreen / Conference Hall Presentation Button */}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className={`h-9 px-3.5 rounded-xl text-xs font-black shadow-md active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 border shrink-0 ${
                    isFullscreen
                      ? "bg-gradient-to-r from-rose-500 to-amber-500 text-slate-950 border-amber-300 shadow-rose-500/25 ring-2 ring-amber-400"
                      : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white border-purple-400/40 shadow-purple-500/20"
                  }`}
                  title="عرض لوحة الشرف بنظام ملء الشاشة لقاعات المؤتمرات والشاشات الكبيرة"
                >
                  {isFullscreen ? (
                    <>
                      <Minimize2 className="h-4 w-4 shrink-0" />
                      <span>إلغاء ملء الشاشة</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="h-4 w-4 shrink-0 animate-pulse" />
                      <span>ملء الشاشة للقاعات 📺</span>
                    </>
                  )}
                </button>

                {/* Sound toggle button */}
                <button
                  type="button"
                  onClick={toggleMute}
                  className="h-9 w-9 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white shadow-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center shrink-0"
                  title={isMuted ? "تشغيل المؤثرات الصوتية" : "كتم الصوت"}
                >
                  {isMuted ? (
                    <VolumeX className="h-4 w-4 text-rose-400 shrink-0" />
                  ) : (
                    <Volume2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  )}
                </button>

                {/* Theme Switcher Toggle (Auto Time / Day / Night) */}
                <div className="flex items-center gap-1 bg-slate-900/90 border border-amber-500/30 p-1 rounded-xl shrink-0 shadow-xs">
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playTap();
                      setThemePreference("auto");
                    }}
                    className={`h-7 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      themePreference === "auto"
                        ? "bg-amber-500 text-slate-950 font-black shadow-xs"
                        : "text-slate-300 hover:text-white"
                    }`}
                    title={`تلقائي حسب الوقت (${isDaytime ? "نهار ☀️ 06:00-18:00" : "ليل 🌙 18:00-06:00"})`}
                  >
                    <Clock className="h-3 w-3" />
                    <span>تلقائي</span>
                    <span className="text-[10px] opacity-90">({isDaytime ? "☀️" : "🌙"})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      sounds.playTap();
                      setThemePreference("light");
                    }}
                    className={`h-7 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      themePreference === "light"
                        ? "bg-amber-400 text-slate-950 font-black shadow-xs"
                        : "text-slate-300 hover:text-white"
                    }`}
                    title="الوضع النهاري (فاتح ومشرق)"
                  >
                    <Sun className="h-3 w-3 text-amber-600" />
                    <span>نهاري</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      sounds.playTap();
                      setThemePreference("dark");
                    }}
                    className={`h-7 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      themePreference === "dark"
                        ? "bg-indigo-600 text-white font-black shadow-xs"
                        : "text-slate-300 hover:text-white"
                    }`}
                    title="الوضع الليلي (داكن وجميل)"
                  >
                    <Moon className="h-3 w-3 text-indigo-300" />
                    <span>ليلي</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Search & Sort Filter Control Bar */}
          <div className="relative mt-3.5 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن اسم فريق أو قائد أو شعار بسرعة..."
                className="w-full h-10 sm:h-11 pr-10 pl-8 rounded-2xl bg-slate-950/80 border border-slate-700/80 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400 transition-colors shadow-inner"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white px-2 py-0.5 bg-slate-800 rounded-lg cursor-pointer"
                >
                  مسح
                </button>
              )}
            </div>

            {/* Sort Controls */}
            <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-2xl border border-slate-800 shrink-0 overflow-x-auto no-scrollbar">
              <span className="text-[11px] text-slate-400 px-2 font-bold whitespace-nowrap hidden sm:inline-block">
                ترتيب الفرق:
              </span>
              <button
                type="button"
                onClick={() => {
                  sounds.playTap();
                  setSortOrder("points-desc");
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  sortOrder === "points-desc"
                    ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black"
                    : "text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
                title="ترتيب الفرق حسب النقاط تنازلياً (الأعلى أولاً)"
              >
                <TrendingDown className="h-3.5 w-3.5" />
                <span>الأعلى نقاطاً ⚡</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sounds.playTap();
                  setSortOrder("points-asc");
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  sortOrder === "points-asc"
                    ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black"
                    : "text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
                title="ترتيب الفرق حسب النقاط تصاعدياً (الأقل أولاً)"
              >
                <TrendingUp className="h-3.5 w-3.5" />
                <span>الأقل نقاطاً 📈</span>
              </button>
            </div>
          </div>
        </header>

        {/* TV & Projector Mode Active Controller Banner */}
        <AnimatePresence>
          {isTvMode && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              className="mb-5 p-3.5 sm:p-4 rounded-3xl bg-gradient-to-r from-amber-950/90 via-slate-900/95 to-amber-950/90 border-2 border-amber-400/80 shadow-[0_15px_40px_rgba(245,158,11,0.25)] backdrop-blur-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-100"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black shadow-lg shadow-amber-500/30 shrink-0">
                  <Tv className="h-5 w-5 sm:h-6 sm:w-6" />
                </span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <h3 className="text-sm sm:text-base lg:text-lg font-black text-amber-300">
                      نمط الشاشات الكبيرة والبروجكتور نشط 📽️ (TV / Projector Mode)
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[10px] font-black">
                      قاعات المؤتمرات والاجتماعات
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 hidden sm:block mt-0.5 font-medium">
                    تم تكبير أحجام الخطوط والأرقام والشعارات لضمان أعلى درجات الوضوح والتباين لجمهور القاعة عن بُعد
                  </p>
                </div>
              </div>

              {/* Controls: Scale & Layout Grid */}
              <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap justify-end w-full sm:w-auto">
                {/* Scale buttons */}
                <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-2xl border border-slate-700/80">
                  <span className="text-[11px] text-slate-400 font-bold px-1.5 hidden md:inline">
                    حجم الخط:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playTap();
                      setTvScale("normal");
                    }}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      tvScale === "normal"
                        ? "bg-amber-500 text-slate-950 font-black shadow-xs"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    100% عادي
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playTap();
                      setTvScale("large");
                    }}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      tvScale === "large"
                        ? "bg-amber-500 text-slate-950 font-black shadow-xs"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    125% كبير 🔍
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playTap();
                      setTvScale("xl");
                    }}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      tvScale === "xl"
                        ? "bg-amber-500 text-slate-950 font-black shadow-xs"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    150% عملاق 🚀
                  </button>
                </div>

                {/* Column layout toggle on wide screens */}
                <div className="hidden lg:flex items-center gap-1 bg-slate-950/80 p-1 rounded-2xl border border-slate-700/80">
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playTap();
                      setTvColumns("single");
                    }}
                    className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                      tvColumns === "single"
                        ? "bg-amber-500 text-slate-950"
                        : "text-slate-400 hover:text-white"
                    }`}
                    title="عرض رأسي فردي"
                  >
                    <List className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playTap();
                      setTvColumns("grid");
                    }}
                    className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                      tvColumns === "grid"
                        ? "bg-amber-500 text-slate-950"
                        : "text-slate-400 hover:text-white"
                    }`}
                    title="عرض شبكي مزدوج (عمودين متجاورين للشاشات العريضة)"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                </div>

                {/* Close TV Mode */}
                <button
                  type="button"
                  onClick={() => {
                    sounds.playTap();
                    setIsTvMode(false);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  إلغاء ✕
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Daily Challenge Banner */}
        {data.config.dailyChallenge && (
          <DailyChallengeBanner
            challenge={data.config.dailyChallenge}
            canAwardPoints={!isPublicDisplayMode && currentUser.permissions.canAwardPoints}
            onAwardChallengePoints={() => {
              setAdminInitialTab("quick_score");
              setViewMode("admin");
            }}
          />
        )}

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
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl overflow-hidden border border-white/40 shadow-inner bg-white/25">
                  {newLeaderNotice.avatarUrl ? (
                    <img
                      src={newLeaderNotice.avatarUrl}
                      alt={newLeaderNotice.teamName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl">{newLeaderNotice.icon}</span>
                  )}
                </div>
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
                        ? "ring-2 ring-emerald-400 border-emerald-400 shadow-[0_0_35px_rgba(16,185,129,0.35)] bg-gradient-to-r from-emerald-950/60 via-slate-900 to-teal-950/60"
                        : hasShiftedDown
                        ? "ring-1 ring-rose-500/80 border-rose-500/80 shadow-[0_0_25px_rgba(244,63,94,0.25)] bg-gradient-to-r from-rose-950/50 via-slate-900 to-slate-950"
                        : isRank1
                        ? "bg-gradient-to-r from-amber-950/75 via-slate-900/95 to-amber-950/75 border-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.25)] ring-1 ring-amber-400/40"
                        : isRank2
                        ? "bg-gradient-to-r from-sky-950/70 via-slate-900/95 to-sky-950/70 border-cyan-400/80 shadow-[0_0_24px_rgba(6,182,212,0.2)]"
                        : isRank3
                        ? "bg-gradient-to-r from-orange-950/70 via-slate-900/95 to-amber-950/70 border-orange-400/80 shadow-[0_0_24px_rgba(249,115,22,0.2)]"
                        : "bg-slate-900/80 hover:bg-slate-800/90 border-slate-700/60 hover:border-slate-500/80 shadow-black/40"
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

                      {/* Team Avatar / Profile Photo with Upload Trigger */}
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          sounds.playTap();
                          setPhotoUploadTeam(team);
                        }}
                        className="relative group/photo flex h-11 w-11 sm:h-13 sm:w-13 shrink-0 items-center justify-center rounded-2xl overflow-hidden border-2 shadow-md transition-all duration-300 hover:scale-105 cursor-pointer ring-1 ring-white/10"
                        style={{
                          backgroundColor: `${team.color}22`,
                          borderColor: team.color || "#F59E0B",
                          boxShadow: `0 0 16px ${team.color}35`,
                        }}
                        title="انقر لتغيير أو تحميل صورة تعريفية للفريق 📸"
                      >
                        {team.avatarUrl ? (
                          <img
                            src={team.avatarUrl}
                            alt={team.name}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover/photo:scale-110"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <span className="text-xl sm:text-2xl select-none transition-transform duration-300 group-hover/photo:scale-110">
                            {team.icon}
                          </span>
                        )}

                        {/* Camera Hover Overlay */}
                        <div className="absolute inset-0 bg-slate-950/75 opacity-0 group-hover/photo:opacity-100 flex flex-col items-center justify-center text-amber-300 transition-opacity duration-200">
                          <Camera className="h-4 w-4 drop-shadow" />
                          <span className="text-[8px] font-black mt-0.5">صورة</span>
                        </div>
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

                          {/* Quick Photo Upload Trigger Button (Admin/Leader only) */}
                          {!isPublicDisplayMode && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                sounds.playTap();
                                setPhotoUploadTeam(team);
                              }}
                              className="opacity-60 hover:opacity-100 p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-amber-300 transition-all text-xs flex items-center gap-1 cursor-pointer"
                              title="تحميل أو تعديل صورة الفريق 📸"
                            >
                              <Camera className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {/* Rank Shift Indicator Pill (Live shift or Previous Round comparison) */}
                          {change ? (
                            <motion.span
                              initial={{ scale: 0, opacity: 0, x: -10 }}
                              animate={{ scale: 1, opacity: 1, x: 0 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={{ type: "spring", stiffness: 500, damping: 20 }}
                              className={`px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black flex items-center gap-1 shadow-sm shrink-0 ${
                                hasShiftedUp
                                  ? "bg-emerald-500/25 text-emerald-300 border border-emerald-400/50 shadow-emerald-500/20"
                                  : "bg-rose-500/20 text-rose-300 border border-rose-400/40"
                              }`}
                              title={hasShiftedUp ? `صعد +${change.delta} مراكز في الجولة الحالية` : `تراجع ${change.delta} مراكز`}
                            >
                              {hasShiftedUp ? (
                                <>
                                  <ArrowUp className="h-3 w-3 stroke-[3] text-emerald-400" />
                                  <span>+{change.delta} صعود</span>
                                </>
                              ) : (
                                <>
                                  <ArrowDown className="h-3 w-3 stroke-[3] text-rose-400" />
                                  <span>{change.delta} تراجع</span>
                                </>
                              )}
                            </motion.span>
                          ) : team.previousRank && team.previousRank !== team.rank ? (
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black flex items-center gap-1 shadow-xs shrink-0 ${
                                team.previousRank > team.rank
                                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                                  : "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                              }`}
                              title={`الترتيب السابق #${team.previousRank} ➔ الحالي #${team.rank}`}
                            >
                              {team.previousRank > team.rank ? (
                                <>
                                  <ArrowUp className="h-3 w-3 stroke-[3] text-emerald-400" />
                                  <span>+{team.previousRank - team.rank} صعود</span>
                                </>
                              ) : (
                                <>
                                  <ArrowDown className="h-3 w-3 stroke-[3] text-rose-400" />
                                  <span>-{team.rank - team.previousRank} تراجع</span>
                                </>
                              )}
                            </span>
                          ) : (
                            <span
                              className="px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-400 border border-slate-700/60 text-[10px] font-bold flex items-center gap-1 shrink-0"
                              title="مستقر في الترتيب مقارنة بالجولة السابقة"
                            >
                              <span className="text-[9px]">➖</span>
                              <span>مستقر</span>
                            </span>
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
                          {/* Hierarchy Order: Leader -> Servant -> Makhdoumeen */}
                          {team.leaderName ? (
                            <span className="text-amber-300 font-bold flex items-center gap-1">
                              <span>👑 القائد:</span>
                              <span className="text-white font-semibold">{team.leaderName}</span>
                            </span>
                          ) : team.leadersCount > 0 ? (
                            <span className="text-amber-300 font-bold flex items-center gap-1">
                              <span>👑 القادة:</span>
                              <span className="text-white font-semibold">{team.leadersCount}</span>
                            </span>
                          ) : null}

                          {(team.servantsCount || 0) > 0 && (
                            <>
                              <span className="text-slate-500">•</span>
                              <span className="text-purple-300 font-medium flex items-center gap-1">
                                <span>✝️ الخدام:</span>
                                <span className="text-slate-100 font-semibold">{team.servantsCount}</span>
                              </span>
                            </>
                          )}

                          <span className="text-slate-500">•</span>
                          <span className="text-teal-300 font-medium flex items-center gap-1">
                            <span>👥 المخدومين:</span>
                            <span className="text-slate-100 font-semibold">
                              {team.makhdoumeenCount !== undefined ? team.makhdoumeenCount : team.membersCount}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: XP Score + Quick +50 XP trigger */}
                    <div className="flex items-center gap-2.5 sm:gap-4 shrink-0 mr-1 sm:mr-3">
                      {/* Quick +50 button for fast in-game scoring (Admin only) */}
                      {!isPublicDisplayMode && currentUser.permissions.canAwardPoints && (
                        <button
                          type="button"
                          onClick={(e) => handleQuickAdd(e, team, 50)}
                          className="hidden sm:flex h-8 px-2.5 rounded-xl bg-slate-800/80 hover:bg-amber-500 hover:text-slate-950 text-amber-400 text-xs font-bold border border-slate-700 items-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
                          title="إضافة سريعة +50 نقطة للفريق"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>50 XP</span>
                        </button>
                      )}

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

      {/* Team Photo Upload Modal */}
      {photoUploadTeam && (
        <TeamPhotoModal
          team={photoUploadTeam}
          onClose={() => setPhotoUploadTeam(null)}
          onSuccess={(msg) => {
            addToast({
              type: "success",
              title: "تحديث صورة الفريق 📸",
              message: msg,
              teamIcon: photoUploadTeam.icon,
            });
          }}
        />
      )}


      {/* Floating Exit Fullscreen Button for Conference Hall Mode */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.button
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            type="button"
            onClick={toggleFullscreen}
            className="fixed top-4 left-4 z-[220] flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-900/90 hover:bg-rose-600 text-white text-xs font-black shadow-2xl border border-white/20 backdrop-blur-xl active:scale-95 transition-all cursor-pointer ring-2 ring-rose-500/30"
            title="إنهاء وضع ملء الشاشة (Esc)"
          >
            <Minimize2 className="h-4 w-4 text-rose-400" />
            <span>إنهاء ملء الشاشة (Esc) ✕</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Floating Toast Notifications Stack */}
      <div
        className="fixed bottom-6 left-4 sm:left-6 z-[200] max-w-sm w-full flex flex-col-reverse gap-2.5 pointer-events-none"
        dir="rtl"
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.9, x: -20 }}
              animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
              exit={{ opacity: 0, y: 10, scale: 0.9, x: -20 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className={`pointer-events-auto relative p-3.5 sm:p-4 rounded-2xl border shadow-2xl backdrop-blur-xl flex items-start gap-3 overflow-hidden ${
                toast.type === "leader_change"
                  ? "bg-gradient-to-r from-amber-950/95 via-slate-900/95 to-amber-950/95 border-amber-400/90 text-amber-200 shadow-amber-500/20 ring-2 ring-amber-500/30"
                  : toast.type === "rank_up"
                  ? "bg-gradient-to-r from-emerald-950/95 via-slate-900/95 to-teal-950/95 border-emerald-400/80 text-emerald-200 shadow-emerald-500/20"
                  : toast.type === "rank_down"
                  ? "bg-gradient-to-r from-rose-950/95 via-slate-900/95 to-slate-950/95 border-rose-500/60 text-rose-200 shadow-rose-500/15"
                  : toast.type === "success"
                  ? "bg-gradient-to-r from-teal-950/95 via-slate-900/95 to-slate-950/95 border-teal-500/60 text-teal-200"
                  : "bg-gradient-to-r from-amber-950/95 via-slate-900/95 to-slate-950/95 border-amber-500/60 text-amber-200"
              }`}
            >
              {/* Icon badge */}
              <div className="shrink-0 h-10 w-10 rounded-xl bg-white/10 border border-white/10 text-lg flex items-center justify-center overflow-hidden">
                {toast.teamAvatarUrl ? (
                  <img src={toast.teamAvatarUrl} alt="" className="w-full h-full object-cover" />
                ) : toast.teamIcon ? (
                  <span>{toast.teamIcon}</span>
                ) : toast.type === "leader_change" ? (
                  <Crown className="h-5 w-5 text-amber-400" />
                ) : toast.type === "rank_up" ? (
                  <TrendingUp className="h-5 w-5 text-emerald-400" />
                ) : toast.type === "rank_down" ? (
                  <TrendingDown className="h-5 w-5 text-rose-400" />
                ) : toast.type === "success" ? (
                  <CheckCircle className="h-5 w-5 text-teal-400" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-amber-400" />
                )}
              </div>

              {/* Text Body */}
              <div className="flex-1 space-y-0.5 min-w-0 pr-1">
                <div className="text-xs font-black tracking-tight leading-snug">
                  {toast.title}
                </div>
                <div className="text-[11px] font-bold opacity-90 leading-relaxed">
                  {toast.message}
                </div>
              </div>

              {/* Dismiss Button */}
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="shrink-0 p-1 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
