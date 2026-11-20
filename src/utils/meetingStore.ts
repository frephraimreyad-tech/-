import type {
  ActivityReason,
  AttendanceRecord,
  AuditLogEntry,
  CustomMember,
  CustomTeam,
  DailyChallenge,
  EventSession,
  MeetingConfig,
  MeetingData,
  MemberPermissions,
  ProcessedMeetingTeam,
  RoleType,
  ScoreTransaction,
  VisitationRecord,
} from "../types";
import { type SystemUser, SUPER_ADMIN_USER, getRoleDefaultPermissions, authStore } from "./authStore";
import { getCurrentOrNearestFridayDate, formatLocalDate } from "./fridaySchedule";
import { db, OperationType, handleFirestoreError, stripUndefined } from "./firebase";
import { googleSheets } from "./googleSheets";
import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  getDoc,
  getDocs,
  writeBatch,
} from "firebase/firestore";

import { calculateTeamXP } from "./teamXPCalculator";

const STORAGE_KEY = "youth_meeting_scoreboard_v2";


export const DEFAULT_ACTIVITY_REASONS: ActivityReason[] = [
  { id: "ar-1", text: "حضور مبكر والتزام في الموعد", category: "حضور والتزام", points: 30, icon: "⏰" },
  { id: "ar-2", text: "الفوز في مسابقة الإنجيل وحفظ الآية", category: "مسابقة روحية", points: 50, icon: "📖" },
  { id: "ar-3", text: "المشاركة الفعالة في النشاط والتحدي الجماعي", category: "نشاط وتحدي", points: 40, icon: "🎯" },
  { id: "ar-4", text: "روح التعاون والخدمة والمحبة", category: "خدمة ومحبة", points: 25, icon: "❤️" },
  { id: "ar-5", text: "إجابة ذكية وسريعة في السؤال التفاعلي", category: "تحدي فوري", points: 20, icon: "💡" },
  { id: "ar-6", text: "تقديم فقرة متميزة أو إبداعية في الاجتماع", category: "إبداع ومواهب", points: 60, icon: "✨" },
  { id: "ar-7", text: "الفوز بالدوري الرياضي / تنس اليد", category: "دوري رياضي", points: 50, icon: "🏓" },
  { id: "ar-8", text: "حفظ ترنيمة أو لحن كنسي جديد", category: "ألحان وترانيم", points: 35, icon: "🎵" },
];

const DEFAULT_CONFIG: MeetingConfig = {
  meetingName: "أسرة الشهيد العظيم أبي سيفين وتماف إيريني",
  subTitle: "اجتماع شباب جامعة • لوحة الشرف الكبرى والتنافس الروحي",
  churchName: "كنيسة الشهيد العظيم أبي سيفين وتماف إيريني",
  seasonName: "موسم النهضة الروحية ٢٠٢٦",
  enableSounds: true,
  autoIdleSeconds: 50,
  hideAdminButtonFromPublic: false,
  meetingLogoUrl: "/assets/aistudio/_______________________55ad5e73.png",
  dailyChallenge: {
    id: "dc-today-01",
    title: "تحدي حفظ آية اللقاء والاشتراك الجماعي",
    description: "حفظ ومشاركة آية اليوم مع الفريق والوصول بنسبة حضور المجموعة إلى 100% قبل نهاية وقت الاجتماع!",
    pointsReward: 100,
    icon: "🔥",
    category: "تحدي اليوم المميز",
    endsAt: new Date(Date.now() + 4 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
    isActive: true,
  },
  meetingStartTime: new Date().toISOString(),
  meetingEndTime: new Date(Date.now() + 2 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
  qrScanOpenTime: "17:00",
  qrScanCloseTime: "19:00",
  isQrScanManuallyLocked: false,
  isQrScanManuallyOpened: false,
};

export const DEFAULT_TEAMS: CustomTeam[] = [
  { id: "team-1", name: "فريق مارمرقس", icon: "🦁", color: "#EAB308", slogan: "كاروز الديار المصرية", leaderName: "أنطونيوس إدوار", points: 0, previousRank: 0, avatarUrl: "https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=400&auto=format&fit=crop&q=80" },
  { id: "team-2", name: "فريق أثناسيوس", icon: "⚔️", color: "#3B82F6", slogan: "حامي الإيمان المستقيم", leaderName: "مينا شهيد", points: 0, previousRank: 0, avatarUrl: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=400&auto=format&fit=crop&q=80" },
  { id: "team-3", name: "فريق الأنبا شنودة", icon: "📜", color: "#10B981", slogan: "رئيس المتوحدين", leaderName: "د. مينا ماهر", points: 0, previousRank: 0, avatarUrl: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&auto=format&fit=crop&q=80" },
  { id: "team-4", name: "فريق أمير الشهداء مارجرجس", icon: "🛡️", color: "#EF4444", slogan: "سريع الندهة والبطل المغوار", leaderName: "بيشوي عاطف", points: 0, previousRank: 0, avatarUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&auto=format&fit=crop&q=80" },
  { id: "team-5", name: "فريق الأنبا بيشوي", icon: "🕊️", color: "#06B6D4", slogan: "الرجل الكامل وحبيب مخلصنا الصالح", leaderName: "فادي سامح", points: 0, previousRank: 0, avatarUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&auto=format&fit=crop&q=80" },
  { id: "team-6", name: "فريق الأمير تادرس", icon: "🏹", color: "#8B5CF6", slogan: "قائد جند المسيح الأمين", leaderName: "كيرلس مجدي", points: 0, previousRank: 0, avatarUrl: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&auto=format&fit=crop&q=80" },
  { id: "team-7", name: "فريق البابا كيرلس", icon: "⛵", color: "#EC4899", slogan: "كن مطمئناً جداً جداً", leaderName: "مارك رأفت", points: 0, previousRank: 0, avatarUrl: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=400&auto=format&fit=crop&q=80" },
  { id: "team-8", name: "فريق الشهيد أبي سيفين", icon: "👑", color: "#F97316", slogan: "حامل السيفين الغالب بقوة الصليب", leaderName: "يوسف مجدي", points: 0, previousRank: 0, avatarUrl: "/assets/aistudio/_______________________55ad5e73.png" },
  { id: "team-9", name: "فريق الأنبا أنطونيوس", icon: "🔥", color: "#6366F1", slogan: "أب جميع الرهبان وكوكب البرية", leaderName: "مينا عادل", points: 0, previousRank: 0, avatarUrl: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&auto=format&fit=crop&q=80" },
  { id: "team-10", name: "فريق القديسة دميانة", icon: "🌟", color: "#14B8A6", slogan: "عفيفة وقوية مع الأربعين عذراء", leaderName: "مارينا سامي", points: 0, previousRank: 0, avatarUrl: "https://images.unsplash.com/photo-1500485035595-cbe6f645feb1?w=400&auto=format&fit=crop&q=80" },
];

export const DEFAULT_MEMBERS: CustomMember[] = [
  { id: "mem-1", name: "أبونا افرايم رياض", teamId: "team-1", role: "admin", roleLabel: "مدير النظام", points: 0, accessCode: "7777", permissions: getRoleDefaultPermissions("admin") },
  { id: "mem-2", name: "مينا شهيد", teamId: "team-2", role: "leader", roleLabel: "قائد المجموعة", points: 0, accessCode: "1234", permissions: getRoleDefaultPermissions("leader") },
];

export const DEFAULT_EVENTS: EventSession[] = [
  {
    id: "evt-01",
    title: "لقاء الجمعة الروحي والدراسي - إنجيل يوحنا",
    date: new Date().toISOString().slice(0, 10),
    description: "حضور اللقاء العام والتسبيح ودراسة الكلمة المقدسة والأنشطة المشتركة",
    qrCode: "EVT-FRIDAY-JOHN-2026",
    attendancePoints: 30,
    startTime: "18:00",
    punctualityBonusPoints: 15,
    isActive: true,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    createdBy: "الخادم المسؤول",
  },
  {
    id: "evt-02",
    title: "دوري المنافسات والتحديات الكنسية",
    date: new Date().toISOString().slice(0, 10),
    description: "حضور وتنافس الفرق في الألعاب والتحديات الفورية",
    qrCode: "EVT-CHALLENGE-2026",
    attendancePoints: 25,
    startTime: "19:30",
    punctualityBonusPoints: 10,
    isActive: true,
    createdAt: new Date(Date.now() - 43200000).toISOString(),
    createdBy: "الخادم المسؤول",
  },
];

const DEFAULT_TRANSACTIONS: ScoreTransaction[] = [];

const DEFAULT_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: "aud-1",
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    userId: "super-admin-01",
    userName: "الخادم المسؤول",
    userRole: "admin",
    action: "award_points",
    targetType: "team",
    targetId: "team-1",
    targetName: "فريق مارمرقس الرسول",
    details: "إضافة +100 XP لمسابقة الإنجيل",
    status: "success",
  },
];

class MeetingStore {
  private data: MeetingData;
  private listeners: Set<() => void> = new Set();
  private initialized: boolean = false;
  private isLoading: boolean = true;

  constructor() {
    this.data = this.getFallbackData();
    this.initFirestore();
  }

  private getCachedTeams(): CustomTeam[] {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("meeting_teams_persistent_cache_v3");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  }

  public saveTeamsToStorage(teams: CustomTeam[]): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("meeting_teams_persistent_cache_v3", JSON.stringify(teams));
    } catch {}
  }

  private getCachedMembers(): CustomMember[] {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("meeting_members_persistent_cache_v2");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {}
    return [];
  }

  public saveMembersToStorage(members: CustomMember[]): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("meeting_members_persistent_cache_v2", JSON.stringify(members));
    } catch {}
  }

  private getCachedAttendance(): AttendanceRecord[] {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("meeting_attendance_persistent_cache_v3");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  }

  public saveAttendanceToStorage(attendance: AttendanceRecord[]): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("meeting_attendance_persistent_cache_v3", JSON.stringify(attendance));
    } catch {}
  }

  private getCachedTransactions(): ScoreTransaction[] {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("meeting_transactions_persistent_cache_v3");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  }

  public saveTransactionsToStorage(transactions: ScoreTransaction[]): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("meeting_transactions_persistent_cache_v3", JSON.stringify(transactions));
    } catch {}
  }

  private getFallbackData(): MeetingData {
    return {
      config: DEFAULT_CONFIG,
      // Keep ONLY user-created teams (never inject fake DEFAULT_TEAMS)
      teams: this.getCachedTeams(),
      members: this.getCachedMembers(),
      transactions: this.getCachedTransactions(),
      activityReasons: DEFAULT_ACTIVITY_REASONS,
      events: [],
      attendance: this.getCachedAttendance(),
      auditLogs: [],
      visitationHistory: [],
      lastSaved: new Date().toISOString(),
    };
  }

  private async initFirestore() {
    if (typeof window === "undefined") return;

    // 1. Ensure ONLY core config/meeting & activityReasons exist if brand new.
    // CRITICAL: NEVER auto-seed DEFAULT_TEAMS or auto-run importFridayLogs(),
    // so only the user's own teams exist in Firestore.
    try {
      const configRef = doc(db, "config", "meeting");
      const configSnap = await getDoc(configRef);
      if (!configSnap.exists()) {
        await setDoc(configRef, stripUndefined(DEFAULT_CONFIG), { merge: true });
      }
      const reasonsSnap = await getDocs(query(collection(db, "activityReasons"), limit(1)));
      if (reasonsSnap.empty) {
        const batch = writeBatch(db);
        DEFAULT_ACTIVITY_REASONS.forEach((reason) =>
          batch.set(doc(db, "activityReasons", reason.id), stripUndefined(reason), { merge: true })
        );
        await batch.commit();
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, "config/meeting", { silent: true });
    }

    // 2. Setup Real-Time Snapshot Listeners with structured error handlers
    // Listen to Config
    onSnapshot(
      doc(db, "config", "meeting"),
      (docSnap) => {
        if (docSnap.exists()) {
          const remoteConfig = docSnap.data() as MeetingConfig;
          this.data.config = { ...DEFAULT_CONFIG, ...remoteConfig };
          this.notify();
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, "config/meeting", { silent: true });
      }
    );

    // Listen to Teams (Authoritative user-created teams ONLY)
    onSnapshot(
      collection(db, "teams"),
      (querySnap) => {
        const teams: CustomTeam[] = [];
        querySnap.forEach((docItem) => {
          teams.push({ ...docItem.data(), id: docItem.id } as CustomTeam);
        });
        this.data.teams = teams;
        this.saveTeamsToStorage(teams);
        this.isLoading = false;
        this.initialized = true;
        this.notify();
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "teams", { silent: true });
        this.isLoading = false;
        this.notify();
      }
    );

    // Listen to Members
    onSnapshot(
      collection(db, "members"),
      (querySnap) => {
        const members: CustomMember[] = [];
        querySnap.forEach((docItem) => {
          const m = docItem.data() as any;
          const defaults = getRoleDefaultPermissions(m.role || "member");
          members.push({
            ...m,
            id: docItem.id,
            points: Number(m.points) || 0,
            avatarUrl: m.avatarUrl || "",
            permissions: { ...defaults, ...(m.permissions || {}) },
          } as CustomMember);
        });
        this.data.members = members;
        this.saveMembersToStorage(members);
        this.notify();
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "members", { silent: true });
      }
    );

    // Listen to ALL Transactions (NO 500-item truncation so every Friday's scores accumulate!)
    const qTransactions = query(collection(db, "transactions"), orderBy("timestamp", "desc"));
    onSnapshot(
      qTransactions,
      (querySnap) => {
        const txs: ScoreTransaction[] = [];
        querySnap.forEach((docItem) => {
          const d = docItem.data() as any;
          txs.push({
            ...d,
            id: docItem.id,
            points: Number(d.points) || 0,
          } as ScoreTransaction);
        });
        this.data.transactions = txs;
        this.saveTransactionsToStorage(txs);
        this.notify();
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "transactions", { silent: true });
      }
    );

    // Listen to Events
    onSnapshot(
      collection(db, "events"),
      (querySnap) => {
        const evts: EventSession[] = [];
        querySnap.forEach((docItem) => {
          evts.push({ ...docItem.data(), id: docItem.id } as EventSession);
        });
        evts.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
        this.data.events = evts;
        this.notify();
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "events", { silent: true });
      }
    );

    // Listen to ALL Attendance Records (Preserves EVERY QR scan across ALL Fridays!)
    onSnapshot(
      collection(db, "attendance"),
      (querySnap) => {
        const atts: AttendanceRecord[] = [];
        querySnap.forEach((docItem) => {
          atts.push({ ...docItem.data(), id: docItem.id } as AttendanceRecord);
        });
        atts.sort(
          (a, b) =>
            new Date(b.scannedAt || 0).getTime() - new Date(a.scannedAt || 0).getTime()
        );
        this.data.attendance = atts;
        this.saveAttendanceToStorage(atts);
        this.notify();
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "attendance", { silent: true });
      }
    );

    // Listen to Audit Logs
    const qAudit = query(collection(db, "auditLogs"), orderBy("timestamp", "desc"), limit(500));
    onSnapshot(
      qAudit,
      (querySnap) => {
        const logs: AuditLogEntry[] = [];
        querySnap.forEach((docItem) => {
          logs.push({ ...docItem.data(), id: docItem.id } as AuditLogEntry);
        });
        this.data.auditLogs = logs;
        this.notify();
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "auditLogs", { silent: true });
      }
    );

    // Listen to Activity Reasons / Bonus Guide Rubrics
    onSnapshot(
      collection(db, "activityReasons"),
      (querySnap) => {
        const reasons: ActivityReason[] = [];
        querySnap.forEach((docItem) => {
          reasons.push({ ...docItem.data(), id: docItem.id } as ActivityReason);
        });
        if (reasons.length > 0) {
          this.data.activityReasons = reasons;
        }
        this.notify();
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "activityReasons", { silent: true });
      }
    );

    // Listen to Visitation History
    const qVisitation = query(collection(db, "visitationHistory"), orderBy("visitedAt", "desc"), limit(500));
    onSnapshot(
      qVisitation,
      (querySnap) => {
        const records: VisitationRecord[] = [];
        querySnap.forEach((docItem) => {
          records.push({ ...docItem.data(), id: docItem.id } as VisitationRecord);
        });
        this.data.visitationHistory = records;
        this.notify();
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "visitationHistory", { silent: true });
      }
    );

    this.isLoading = false;
    this.initialized = true;
    this.notify();
  }

  private notify(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (e) {
        console.error("Error in store listener:", e);
      }
    });
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getData(): MeetingData {
    return this.data;
  }

  getIsLoading(): boolean {
    return this.isLoading;
  }

  getConfig(): MeetingConfig {
    return this.data.config;
  }

  async updateConfig(updates: Partial<MeetingConfig>): Promise<void> {
    this.data.config = { ...this.data.config, ...updates };
    try {
      await setDoc(doc(db, "config", "meeting"), updates, { merge: true });
    } catch (e) {
      console.warn("Could not save config to Firestore:", e);
    }
  }

  // --- Audit Log Logging ---
  async logAudit(entry: Omit<AuditLogEntry, "id" | "timestamp">): Promise<AuditLogEntry> {
    const id = "aud-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const newEntry: AuditLogEntry = {
      id,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    this.data.auditLogs = [newEntry, ...this.data.auditLogs.slice(0, 499)];
    await setDoc(doc(db, "auditLogs", id), newEntry);
    this.triggerAutoSync();
    return newEntry;
  }

  getAuditLogs(): AuditLogEntry[] {
    return this.data.auditLogs || [];
  }

  clearAuditLogs(executor?: SystemUser): boolean {
    if (executor && executor.role !== "admin" && !executor.permissions.canClearLogs) {
      // ... logAudit logic remains ...
      this.logAudit({
        userId: executor.id,
        userName: executor.name,
        userRole: executor.role,
        action: "security_block",
        targetType: "system",
        targetId: "audit_logs",
        targetName: "سجل المراجعة والأمان",
        details: "محاولة غير مصرح بها لمسح سجل المراجعة",
        status: "denied",
      });
      return false;
    }
    const batch = writeBatch(db);
    this.data.auditLogs.forEach(log => batch.delete(doc(db, "auditLogs", log.id)));
    batch.commit();
    this.data.auditLogs = [];
    return true;
  }

  private isAttendanceTransaction(tx: ScoreTransaction): boolean {
    const reason = tx.reason || "";
    return (
      reason.includes("تسجيل حضور") ||
      (tx.category === "حضور والتزام" && tx.targetType === "member" && reason.includes("حضور"))
    );
  }

  /**
   * Returns chronologically sorted event IDs that have attendance records (oldest -> newest Friday)
   */
  private getChronologicalAttendanceEventIds(): string[] {
    const attendance = this.data.attendance || [];
    const events = this.data.events || [];
    const eventTimeMap = new Map<string, number>();

    attendance.forEach((a) => {
      if (!a.eventId) return;
      const evt = events.find((e) => e.id === a.eventId);
      const evtTime = evt?.date
        ? new Date(evt.date + "T12:00:00").getTime()
        : new Date(a.scannedAt || 0).getTime();
      const prev = eventTimeMap.get(a.eventId);
      if (prev === undefined || (Number.isFinite(evtTime) && evtTime < prev)) {
        eventTimeMap.set(a.eventId, Number.isFinite(evtTime) ? evtTime : 0);
      }
    });

    return Array.from(eventTimeMap.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([eventId]) => eventId);
  }

  /**
   * Returns per-Friday attendance breakdown for a given team (cumulative across all Fridays)
   */
  getTeamFridayBreakdown(teamId: string): Array<{
    eventId: string;
    eventTitle: string;
    date: string;
    presentCount: number;
    totalMembers: number;
    percentage: number;
    xp: number;
  }> {
    const attendance = this.data.attendance || [];
    const events = this.data.events || [];
    const teamMembers = this.data.members.filter((m) => m.teamId === teamId);
    const teamMemberIds = new Set(teamMembers.map((m) => m.id));
    const sortedEventIds = this.getChronologicalAttendanceEventIds();

    return sortedEventIds.map((eventId) => {
      const presentSet = new Set<string>();
      attendance.forEach((a) => {
        if (a.eventId === eventId && (teamMemberIds.has(a.memberId) || a.teamId === teamId)) {
          presentSet.add(a.memberId);
        }
      });
      const presentCount = presentSet.size;
      const effectiveTotal = Math.max(teamMembers.length, presentCount);
      const { percentage, xp } = calculateTeamXP(effectiveTotal, presentCount);
      const evt = events.find((e) => e.id === eventId);
      const sampleAtt = attendance.find((a) => a.eventId === eventId);
      return {
        eventId,
        eventTitle: evt?.title || sampleAtt?.eventTitle || eventId,
        date: evt?.date || (sampleAtt?.scannedAt ? sampleAtt.scannedAt.slice(0, 10) : ""),
        presentCount,
        totalMembers: effectiveTotal,
        percentage,
        xp,
      };
    });
  }

  private computeTeamCanonicalPoints(teamId: string): {
    totalPoints: number;
    cumulativeAttendanceXp: number;
    manualPoints: number;
    latestPresentCount: number;
    latestAttendanceRate: number;
  } {
    const teamMembers = this.data.members.filter((m) => m.teamId === teamId);
    const teamMemberIds = new Set(teamMembers.map((m) => m.id));
    const attendance = this.data.attendance || [];
    const sortedEventIds = this.getChronologicalAttendanceEventIds();

    // 1. Cumulative attendance XP across ALL Fridays (كل جمعة بتتجمع على اللي قبلها)
    let cumulativeAttendanceXp = 0;
    let latestPresentCount = 0;
    let latestAttendanceRate = 0;

    sortedEventIds.forEach((eventId, idx) => {
      const presentSet = new Set<string>();
      attendance.forEach((a) => {
        if (a.eventId === eventId && (teamMemberIds.has(a.memberId) || a.teamId === teamId)) {
          presentSet.add(a.memberId);
        }
      });
      const presentForFriday = presentSet.size;
      const effectiveTotal = Math.max(teamMembers.length, presentForFriday);
      const { xp } = calculateTeamXP(effectiveTotal, presentForFriday);
      cumulativeAttendanceXp += xp;

      if (idx === sortedEventIds.length - 1) {
        latestPresentCount = presentForFriday;
        latestAttendanceRate =
          effectiveTotal > 0 ? Number(((presentForFriday / effectiveTotal) * 100).toFixed(1)) : 0;
      }
    });

    // 2. Cumulative manual & competition points for this team AND its individual members
    const manualTxs = (this.data.transactions || []).filter((tx) => {
      if (this.isAttendanceTransaction(tx)) return false;
      if (tx.targetType === "team" && tx.targetId === teamId) return true;
      if (tx.targetType === "member" && (tx.teamId === teamId || teamMemberIds.has(tx.targetId))) {
        return true;
      }
      return false;
    });
    const manualPoints = manualTxs.reduce((sum, tx) => sum + (Number(tx.points) || 0), 0);

    const totalPoints = Math.max(0, cumulativeAttendanceXp + manualPoints);
    return {
      totalPoints,
      cumulativeAttendanceXp,
      manualPoints,
      latestPresentCount,
      latestAttendanceRate,
    };
  }

  getProcessedTeams(): ProcessedMeetingTeam[] {
    const teams = [...this.data.teams];
    const members = this.data.members;

    const list: ProcessedMeetingTeam[] = teams.map((team) => {
      const teamMembers = members.filter((m) => m.teamId === team.id);

      // ترتيب أعضاء الفريق: القائد أولاً ثم الخادم ثم المخدومين
      const getRolePriority = (role?: RoleType): number => {
        if (role === "leader" || role === "admin" || role === "priest") return 1;
        if (role === "servant") return 2;
        return 3;
      };
      teamMembers.sort((a, b) => {
        const pA = getRolePriority(a.role);
        const pB = getRolePriority(b.role);
        if (pA !== pB) return pA - pB;
        return (b.points || 0) - (a.points || 0);
      });

      const leadersCount = teamMembers.filter(
        (m) => m.role === "leader" || m.role === "admin" || m.role === "priest"
      ).length;
      const servantsCount = teamMembers.filter((m) => m.role === "servant").length;
      const makhdoumeenCount = teamMembers.filter((m) => m.role === "member" || !m.role).length;

      const {
        totalPoints,
        cumulativeAttendanceXp,
        latestPresentCount,
        latestAttendanceRate,
      } = this.computeTeamCanonicalPoints(team.id);

      return {
        ...team,
        points: totalPoints,
        rank: 0,
        membersCount: teamMembers.length,
        presentMembersCount: latestPresentCount,
        attendanceRate: latestAttendanceRate,
        attendanceXpBonus: cumulativeAttendanceXp,
        leadersCount,
        servantsCount,
        makhdoumeenCount,
        members: teamMembers,
        isTied: false,
      };
    });

    // ترتيب الفرق تنازلياً حسب إجمالي النقاط
    list.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.attendanceRate !== a.attendanceRate) return b.attendanceRate - a.attendanceRate;
      return a.name.localeCompare(b.name, "ar");
    });

    const topPoints = list[0]?.points ?? 0;
    const isTopTied = list.filter((t) => t.points === topPoints).length > 1;

    list.forEach((t, i) => {
      t.rank = i + 1;
      t.isTied = isTopTied && t.points === topPoints;
    });

    return list;
  }

  // --- Team Operations ---
  async addTeam(
    teamData: {
      name: string;
      icon?: string;
      color?: string;
      slogan?: string;
      description?: string;
      leaderName?: string;
      initialPoints?: number;
      avatarUrl?: string;
    },
    executor?: SystemUser
  ): Promise<{ success: boolean; team?: CustomTeam; error?: string }> {
    if (executor && !executor.permissions.canEditTeams && executor.role !== "admin") {
      this.logAudit({
        userId: executor.id,
        userName: executor.name,
        userRole: executor.role,
        action: "security_block",
        targetType: "team",
        targetId: "new",
        targetName: teamData.name,
        details: "محاولة غير مصرح بها لإنشاء فريق جديد",
        status: "denied",
      });
      return { success: false, error: "غير مصرح لك بإضافة فرق جديدة" };
    }

    const id = "team-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const initialPts = Number(teamData.initialPoints) || 0;
    const newTeam: CustomTeam = {
      id,
      name: teamData.name.trim(),
      icon: teamData.icon?.trim() || "🏆",
      color: teamData.color || "#3B82F6",
      slogan: teamData.slogan?.trim() || "",
      description: teamData.description?.trim() || "",
      points: initialPts,
      leaderName: teamData.leaderName?.trim() || "",
      avatarUrl: (teamData as any).avatarUrl?.trim() || "",
    };
    this.data.teams = [...this.data.teams, newTeam];

    const batch = writeBatch(db);
    batch.set(doc(db, "teams", id), stripUndefined(newTeam), { merge: true });

    // Record initialPoints as an official transaction so it IMMEDIATELY reflects on the scoreboard
    if (initialPts !== 0) {
      const initTx: ScoreTransaction = {
        id: "tx-init-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        timestamp: new Date().toISOString(),
        targetType: "team",
        targetId: newTeam.id,
        targetName: newTeam.name,
        teamId: newTeam.id,
        teamName: newTeam.name,
        points: initialPts,
        reason: "رصيد افتتاحي عند إنشاء الفريق",
        category: "رصيد افتتاحي",
        notes: "",
        executorId: executor?.id || "admin",
        executorName: executor?.name || "المسؤول المختص",
        executorRole: executor?.role || "admin",
      };
      this.data.transactions = [initTx, ...this.data.transactions];
      this.saveTransactionsToStorage(this.data.transactions);
      batch.set(doc(db, "transactions", initTx.id), stripUndefined(initTx));
    }

    this.saveTeamsToStorage(this.data.teams);
    this.notify();

    if (executor) {
      this.logAudit({
        userId: executor.id,
        userName: executor.name,
        userRole: executor.role,
        action: "edit_team",
        targetType: "team",
        targetId: newTeam.id,
        targetName: newTeam.name,
        details: `إنشاء فريق جديد: ${newTeam.name}`,
        status: "success",
      }).catch(() => {});
    }

    try {
      await batch.commit();
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `teams/${id}`, { silent: true });
      return { success: false, error: "تعذر حفظ الفريق في قاعدة البيانات، حاول مرة أخرى" };
    }
    this.triggerAutoSync();
    return { success: true, team: newTeam };
  }

  async updateTeam(
    teamId: string,
    updates: Partial<CustomTeam>,
    executor?: SystemUser
  ): Promise<{ success: boolean; error?: string }> {
    if (executor && !executor.permissions.canEditTeams && executor.role !== "admin") {
      this.logAudit({
        userId: executor.id,
        userName: executor.name,
        userRole: executor.role,
        action: "security_block",
        targetType: "team",
        targetId: teamId,
        targetName: updates.name || teamId,
        details: "محاولة غير مصرح بها لتعديل بيانات الفريق",
        status: "denied",
      }).catch(() => {});
      return { success: false, error: "غير مصرح لك بتعديل بيانات الفرق" };
    }

    const idx = this.data.teams.findIndex((t) => t.id === teamId);
    if (idx !== -1) {
      const oldTeam = this.data.teams[idx];
      const oldName = oldTeam.name;
      const batch = writeBatch(db);

      // If admin explicitly edited team.points, create a reconciliation ScoreTransaction
      // so the new total IMMEDIATELY reflects on the scoreboard!
      if (typeof updates.points === "number" && Number.isFinite(updates.points)) {
        const currentCanonical = this.computeTeamCanonicalPoints(teamId).totalPoints;
        const targetPoints = Math.max(0, Math.round(updates.points));
        const delta = targetPoints - currentCanonical;
        if (delta !== 0) {
          const adjTx: ScoreTransaction = {
            id: "tx-adj-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            timestamp: new Date().toISOString(),
            targetType: "team",
            targetId: teamId,
            targetName: updates.name?.trim() || oldName,
            teamId: teamId,
            teamName: updates.name?.trim() || oldName,
            points: delta,
            reason: "تعديل رصيد الفريق يدوياً من الإدارة",
            category: "تعديل درجات",
            notes: `تعديل الرصيد من ${currentCanonical} إلى ${targetPoints} XP`,
            executorId: executor?.id || "admin",
            executorName: executor?.name || "المسؤول المختص",
            executorRole: executor?.role || "admin",
          };
          this.data.transactions = [adjTx, ...this.data.transactions];
          this.saveTransactionsToStorage(this.data.transactions);
          batch.set(doc(db, "transactions", adjTx.id), stripUndefined(adjTx));
        }
      }

      this.data.teams[idx] = { ...oldTeam, ...updates };
      const syncedPoints = this.computeTeamCanonicalPoints(teamId).totalPoints;
      this.data.teams[idx].points = syncedPoints;
      this.saveTeamsToStorage(this.data.teams);
      this.notify();

      if (executor) {
        this.logAudit({
          userId: executor.id,
          userName: executor.name,
          userRole: executor.role,
          action: "edit_team",
          targetType: "team",
          targetId: teamId,
          targetName: this.data.teams[idx].name,
          details: `تعديل بيانات فريق: ${oldName}`,
          status: "success",
        }).catch(() => {});
      }

      try {
        batch.set(
          doc(db, "teams", teamId),
          stripUndefined({ ...updates, points: syncedPoints }),
          { merge: true }
        );
        await batch.commit();
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `teams/${teamId}`, { silent: true });
        return { success: false, error: "تعذر حفظ تعديلات الفريق في قاعدة البيانات" };
      }
      this.triggerAutoSync();
      return { success: true };
    }
    return { success: false, error: "الفريق غير موجود" };
  }

  /**
   * دالة مخصصة لتحديث درجات الفرق مباشرة مع المزامنة اللحظية
   */
  async updateTeamPoints(
    teamId: string,
    points: number,
    reason: string,
    executor: SystemUser
  ): Promise<{ success: boolean; error?: string }> {
    const res = await this.awardPoints({
      targetType: "team",
      targetId: teamId,
      points,
      reason,
      category: "تعديل درجات",
    }, executor);

    return res ? { success: true } : { success: false, error: "فشل في تحديث النقاط" };
  }

  async deleteTeam(teamId: string, executor?: SystemUser): Promise<{ success: boolean; error?: string }> {
    if (executor && !executor.permissions.canEditTeams && executor.role !== "admin") {
      this.logAudit({
        userId: executor.id,
        userName: executor.name,
        userRole: executor.role,
        action: "security_block",
        targetType: "team",
        targetId: teamId,
        targetName: teamId,
        details: "محاولة غير مصرح بها لحذف الفريق",
        status: "denied",
      }).catch(() => {});
      return { success: false, error: "غير مصرح لك بحذف الفرق" };
    }

    const team = this.data.teams.find((t) => t.id === teamId);
    if (!team) return { success: false, error: "الفريق غير موجود" };

    // Capture members BEFORE filtering local state so they are actually deleted from Firestore!
    const membersToDelete = this.data.members.filter((m) => m.teamId === teamId);

    this.data.teams = this.data.teams.filter((t) => t.id !== teamId);
    this.data.members = this.data.members.filter((m) => m.teamId !== teamId);
    this.saveTeamsToStorage(this.data.teams);
    this.saveMembersToStorage(this.data.members);
    this.notify();

    if (executor) {
      this.logAudit({
        userId: executor.id,
        userName: executor.name,
        userRole: executor.role,
        action: "delete_team",
        targetType: "team",
        targetId: teamId,
        targetName: team.name,
        details: `حذف الفريق وأعضائه: ${team.name}`,
        status: "success",
      }).catch(() => {});
    }

    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "teams", teamId));
      membersToDelete.forEach((m) => {
        batch.delete(doc(db, "members", m.id));
      });
      await batch.commit();
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `teams/${teamId}`, { silent: true });
      return { success: false, error: "تعذر حذف الفريق من قاعدة البيانات" };
    }
    this.triggerAutoSync();
    return { success: true };
  }

  // --- Member Operations ---
  async addMember(
    memberData: {
      name: string;
      nameEn?: string;
      teamId: string;
      role?: RoleType;
      roleLabel?: string;
      phone?: string;
      notes?: string;
      avatarUrl?: string;
      initialPoints?: number;
      accessCode?: string;
      permissions?: Partial<MemberPermissions>;
    },
    executor?: SystemUser
  ): Promise<{ success: boolean; member?: CustomMember; error?: string }> {
    if (executor && !executor.permissions.canEditMembers && executor.role !== "admin") {
      this.logAudit({
        userId: executor.id,
        userName: executor.name,
        userRole: executor.role,
        action: "security_block",
        targetType: "member",
        targetId: "new",
        targetName: memberData.name,
        details: "محاولة غير مصرح بها لإضافة عضو جديد",
        status: "denied",
      });
      return { success: false, error: "غير مصرح لك بإضافة أعضاء جدد" };
    }

    const id = "m-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const role: RoleType = memberData.role || "member";
    const defaults = getRoleDefaultPermissions(role);
    const accessCode =
      memberData.accessCode?.trim() ||
      Math.floor(1000 + Math.random() * 9000).toString();

    const newMember: CustomMember = {
      id,
      name: memberData.name.trim(),
      nameEn: memberData.nameEn?.trim() || "",
      teamId: memberData.teamId,
      role,
      roleLabel:
        memberData.roleLabel?.trim() ||
        (role === "leader"
          ? "قائد الفريق"
          : role === "servant"
          ? "خادم"
          : role === "priest"
          ? "أب كاهن"
          : "مشارك"),
      points: memberData.initialPoints || 0,
      phone: memberData.phone?.trim() || "",
      notes: memberData.notes?.trim() || "",
      avatarUrl: memberData.avatarUrl || "",
      accessCode,
      permissions: {
        ...defaults,
        ...(memberData.permissions || {}),
      },
    };

    const batch = writeBatch(db);
    batch.set(doc(db, "members", id), stripUndefined(newMember), { merge: true });

    this.data.members = [...this.data.members, newMember];
    this.saveMembersToStorage(this.data.members);

    if (memberData.initialPoints && memberData.initialPoints > 0) {
      const team = this.data.teams.find((t) => t.id === memberData.teamId);
      const initTx: ScoreTransaction = {
        id: "tx-mem-init-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        timestamp: new Date().toISOString(),
        targetType: "member",
        targetId: newMember.id,
        targetName: newMember.name,
        teamId: newMember.teamId,
        teamName: team ? team.name : "عام",
        points: memberData.initialPoints,
        reason: `رصيد افتتاحي للعضو: ${newMember.name}`,
        category: "رصيد افتتاحي",
        notes: "",
        executorId: executor?.id || "admin",
        executorName: executor?.name || "المسؤول المختص",
        executorRole: executor?.role || "admin",
      };
      this.data.transactions = [initTx, ...this.data.transactions];
      this.saveTransactionsToStorage(this.data.transactions);
      batch.set(doc(db, "transactions", initTx.id), stripUndefined(initTx));

      if (team) {
        const syncedTeamPoints = this.computeTeamCanonicalPoints(team.id).totalPoints;
        team.points = syncedTeamPoints;
        batch.set(doc(db, "teams", team.id), { points: syncedTeamPoints }, { merge: true });
      }
    }

    this.notify();

    try {
      await batch.commit();
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `members/${id}`, { silent: true });
    }

    this.triggerAutoSync();

    if (executor) {
      this.logAudit({
        userId: executor.id,
        userName: executor.name,
        userRole: executor.role,
        action: "edit_member",
        targetType: "member",
        targetId: newMember.id,
        targetName: newMember.name,
        details: `إضافة عضو جديد: ${newMember.name} بكود مرور [${newMember.accessCode}]`,
        status: "success",
      });
    }

    return { success: true, member: newMember };
  }

  async updateMember(
    memberId: string,
    updates: Partial<CustomMember>,
    executor?: SystemUser
  ): Promise<{ success: boolean; error?: string }> {
    if (executor && !executor.permissions.canEditMembers && executor.role !== "admin") {
      this.logAudit({
        userId: executor.id,
        userName: executor.name,
        userRole: executor.role,
        action: "security_block",
        targetType: "member",
        targetId: memberId,
        targetName: updates.name || memberId,
        details: "محاولة غير مصرح بها لتعديل بيانات العضو",
        status: "denied",
      });
      return { success: false, error: "غير مصرح لك بتعديل بيانات الأعضاء" };
    }

    const idx = this.data.members.findIndex((m) => m.id === memberId);
    if (idx !== -1) {
      const old = this.data.members[idx];
      this.data.members[idx] = {
        ...this.data.members[idx],
        ...updates,
      };

      if (executor) {
        this.logAudit({
          userId: executor.id,
          userName: executor.name,
          userRole: executor.role,
          action: "edit_member",
          targetType: "member",
          targetId: memberId,
          targetName: this.data.members[idx].name,
          details: `تحديث بيانات العضو: ${old.name}`,
          status: "success",
        });
      }

      this.saveMembersToStorage(this.data.members);
      this.notify();
      try {
        await setDoc(doc(db, "members", memberId), stripUndefined(updates), { merge: true });
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `members/${memberId}`, { silent: true });
      }
      this.triggerAutoSync();
      return { success: true };
    }
    return { success: false, error: "العضو غير موجود" };
  }

  async updateAdminAvatar(avatarUrl: string, executor?: SystemUser): Promise<{ success: boolean; error?: string }> {
    const adminMember = this.data.members.find((m) => m.id === "mem-1" || m.role === "admin");
    if (adminMember) {
      adminMember.avatarUrl = avatarUrl;
      try {
        await setDoc(doc(db, "members", adminMember.id), { avatarUrl }, { merge: true });
      } catch (e) {
        console.warn("Could not update doc in Firestore:", e);
      }
    }
    this.saveMembersToStorage(this.data.members);
    SUPER_ADMIN_USER.avatarUrl = avatarUrl;
    authStore.updateCurrentUserAvatar(avatarUrl);
    this.triggerAutoSync();

    this.logAudit({
      userId: executor?.id || "mem-1",
      userName: executor?.name || "مدير النظام",
      userRole: "admin",
      action: "edit_member",
      targetType: "member",
      targetId: adminMember?.id || "mem-1",
      targetName: adminMember?.name || "مدير النظام",
      details: "تحديث وتعيين الصورة الشخصية لمدير النظام",
      status: "success",
    });

    return { success: true };
  }

  async deleteMember(memberId: string, executor?: SystemUser): Promise<{ success: boolean; error?: string }> {
    if (executor && !executor.permissions.canEditMembers && executor.role !== "admin") {
      this.logAudit({
        userId: executor.id,
        userName: executor.name,
        userRole: executor.role,
        action: "security_block",
        targetType: "member",
        targetId: memberId,
        targetName: memberId,
        details: "محاولة غير مصرح بها لحذف العضو",
        status: "denied",
      });
      return { success: false, error: "غير مصرح لك بحذف الأعضاء" };
    }

    const mem = this.data.members.find((m) => m.id === memberId);
    if (!mem) return { success: false, error: "العضو غير موجود" };

    this.data.members = this.data.members.filter((m) => m.id !== memberId);

    if (executor) {
      this.logAudit({
        userId: executor.id,
        userName: executor.name,
        userRole: executor.role,
        action: "edit_member",
        targetType: "member",
        targetId: memberId,
        targetName: mem.name,
        details: `حذف العضو: ${mem.name}`,
        status: "success",
      });
    }

    await deleteDoc(doc(db, "members", memberId));
    this.saveMembersToStorage(this.data.members);
    this.triggerAutoSync();
    return { success: true };
  }

  // --- Permissions Management ---
  async updateMemberPermissions(
    memberId: string,
    params: {
      role?: RoleType;
      roleLabel?: string;
      accessCode?: string;
      permissions: Partial<MemberPermissions>;
    },
    executor: SystemUser
  ): Promise<{ success: boolean; error?: string }> {
    if (executor.role !== "admin" && !executor.permissions.canManagePermissions) {
      await this.logAudit({
        userId: executor.id,
        userName: executor.name,
        userRole: executor.role,
        action: "security_block",
        targetType: "member",
        targetId: memberId,
        targetName: memberId,
        details: "محاولة غير مصرح بها لتعديل الصلاحيات وأكواد الدخول",
        status: "denied",
      });
      return { success: false, error: "هذه الصلاحية مقصورة على مسؤول النظام فقط" };
    }

    const mem = this.data.members.find((m) => m.id === memberId);
    if (!mem) return { success: false, error: "العضو غير موجود" };

    if (params.role) mem.role = params.role;
    if (params.roleLabel) mem.roleLabel = params.roleLabel;
    if (params.accessCode && params.accessCode.trim()) {
      mem.accessCode = params.accessCode.trim();
    }
    mem.permissions = {
      ...(mem.permissions || getRoleDefaultPermissions(mem.role)),
      ...params.permissions,
    };

    await this.logAudit({
      userId: executor.id,
      userName: executor.name,
      userRole: executor.role,
      action: "permission_change",
      targetType: "member",
      targetId: memberId,
      targetName: mem.name,
      details: `تحديث صلاحيات وكود وصول [${mem.accessCode}] للعضو ${mem.name} (الدور: ${mem.role})`,
      status: "success",
    });

    this.saveMembersToStorage(this.data.members);
    this.notify();
    try {
      await setDoc(
        doc(db, "members", memberId),
        stripUndefined({
          role: mem.role,
          roleLabel: mem.roleLabel,
          accessCode: mem.accessCode,
          permissions: mem.permissions,
        }),
        { merge: true }
      );
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `members/${memberId}`, { silent: true });
    }
    this.triggerAutoSync();
    return { success: true };
  }

  // --- Strict Backend-Enforced Points Awarding ---
  async awardPoints(
    params: {
      targetType: "team" | "member";
      targetId: string;
      points: number;
      reason: string;
      category?: string;
      timestamp?: string;
      notes?: string;
    },
    executor?: SystemUser
  ): Promise<ScoreTransaction | null> {
    const { targetType, targetId, points, reason, category, timestamp, notes } = params;
    if (points === 0) return null;

    // Backend Security Verification: Members / Makhdoumeen / Anonymous users cannot award points under any circumstances
    const activeExecutor = executor || authStore.getCurrentUser();
    if (
      !activeExecutor ||
      activeExecutor.role === "member" ||
      (!activeExecutor.permissions?.canAwardPoints && activeExecutor.role !== "admin" && activeExecutor.role !== "servant")
    ) {
      this.logAudit({
        userId: activeExecutor?.id || "guest",
        userName: activeExecutor?.name || "مستخدم عام",
        userRole: activeExecutor?.role || "guest",
        action: "security_block",
        targetType,
        targetId,
        targetName: targetId,
        details: `محاولة محظورة من مخدوم/عضو لرصد نقاط (${points > 0 ? "+" : ""}${points} XP). تم الرفض أمنياً.`,
        status: "denied",
      });
      return null;
    }

    let targetName = "";
    let teamId = "";
    let teamName = "";
    let pointsPerMember = 0;
    let distributedMembersCount = 0;

    if (targetType === "team") {
      const team = this.data.teams.find((t) => t.id === targetId);
      if (!team) return null;
      team.points = Math.max(0, team.points + points);
      targetName = team.name;
      teamId = team.id;
      teamName = team.name;

      // تقسيم سكور الفريق بالتساوي على جميع أعضاء الفريق
      // مثال: إذا أُعطي الفريق 100 XP وكان به 10 أعضاء، يحصل كل عضو على 10 XP
      const teamMembers = this.data.members.filter((m) => m.teamId === team.id);
      distributedMembersCount = teamMembers.length;
      if (distributedMembersCount > 0) {
        pointsPerMember = points >= 0
          ? Math.max(points > 0 ? 1 : 0, Math.round(points / distributedMembersCount))
          : Math.min(points < 0 ? -1 : 0, -Math.round(Math.abs(points) / distributedMembersCount));

        if (pointsPerMember !== 0) {
          teamMembers.forEach((member) => {
            member.points = Math.max(0, (member.points || 0) + pointsPerMember);
          });
        }
      }
    } else {
      const member = this.data.members.find((m) => m.id === targetId);
      if (!member) return null;
      member.points = Math.max(0, member.points + points);
      targetName = member.name;
      teamId = member.teamId;

      const team = this.data.teams.find((t) => t.id === teamId);
      if (team) {
        team.points = Math.max(0, team.points + points);
        teamName = team.name;
      } else {
        teamName = "عام";
      }
    }

    const txNotes = notes || (targetType === "team" && distributedMembersCount > 0
      ? `تم تقسيم السكور بالتساوي: (${pointsPerMember > 0 ? "+" : ""}${pointsPerMember} XP لكل عضو من أعضاء الفريق الـ ${distributedMembersCount})`
      : "");

    const tx: ScoreTransaction = {
      id: "tx-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      timestamp: timestamp || new Date().toISOString(),
      targetType,
      targetId,
      targetName,
      teamId,
      teamName,
      points,
      reason,
      category: category || "عام",
      notes: txNotes,
      executorId: activeExecutor?.id || "admin",
      executorName: activeExecutor?.name || "المسؤول المختص",
      executorRole: activeExecutor?.role || "admin",
    };

    // Keep FULL transaction history (no 500-item truncation!)
    this.data.transactions = [tx, ...this.data.transactions];
    this.saveTransactionsToStorage(this.data.transactions);

    // Sync canonical team score immediately so every screen displays the exact same live balance
    const affectedTeam = this.data.teams.find((t) => t.id === teamId);
    const syncedTeamPoints = affectedTeam
      ? this.computeTeamCanonicalPoints(affectedTeam.id).totalPoints
      : 0;
    if (affectedTeam) {
      affectedTeam.points = syncedTeamPoints;
      this.saveTeamsToStorage(this.data.teams);
    }
    this.saveMembersToStorage(this.data.members);

    // Immediate optimistic UI update so points reflect ("يسمع") right away!
    this.notify();

    // Collect all Firestore writes using merge sets (NEVER batch.update which fails if a doc is missing!)
    const writeOps: Array<{ ref: ReturnType<typeof doc>; payload: Record<string, unknown>; merge: boolean }> = [
      { ref: doc(db, "transactions", tx.id), payload: stripUndefined(tx) as unknown as Record<string, unknown>, merge: false },
    ];

    if (affectedTeam) {
      writeOps.push({
        ref: doc(db, "teams", affectedTeam.id),
        payload: { points: syncedTeamPoints },
        merge: true,
      });
    }

    if (targetType === "team") {
      const teamMembers = this.data.members.filter((m) => m.teamId === targetId);
      if (teamMembers.length > 0 && pointsPerMember !== 0) {
        teamMembers.forEach((mem) => {
          writeOps.push({
            ref: doc(db, "members", mem.id),
            payload: { points: mem.points },
            merge: true,
          });
        });
      }
    } else {
      const member = this.data.members.find((m) => m.id === targetId);
      if (member) {
        writeOps.push({
          ref: doc(db, "members", member.id),
          payload: { points: member.points },
          merge: true,
        });
      }
    }

    // Commit in safe chunks of 400 (well under Firestore's 500 write limit)
    try {
      const CHUNK_SIZE = 400;
      for (let i = 0; i < writeOps.length; i += CHUNK_SIZE) {
        const chunk = writeOps.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach((op) => {
          if (op.merge) {
            batch.set(op.ref, op.payload, { merge: true });
          } else {
            batch.set(op.ref, op.payload);
          }
        });
        await batch.commit();
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `transactions/${tx.id}`, { silent: true });
      return null;
    }

    this.logAudit({
      userId: activeExecutor?.id || "admin",
      userName: activeExecutor?.name || "المسؤول المختص",
      userRole: activeExecutor?.role || "admin",
      action: "award_points",
      targetType,
      targetId,
      targetName,
      details:
        targetType === "team" && distributedMembersCount > 0
          ? `رصد ${points > 0 ? "+" : ""}${points} XP لفريق ${targetName} وتم تقسيمها بالتساوي (${pointsPerMember > 0 ? "+" : ""}${pointsPerMember} XP لكل عضو من الـ ${distributedMembersCount} أعضاء): ${reason}`
          : `رصد ${points > 0 ? "+" : ""}${points} XP [${category || "عام"}] لـ ${targetName}: ${reason}`,
      status: "success",
    }).catch(() => {});

    this.triggerAutoSync();
    return tx;
  }

  // --- Events and QR Code Management ---
  getEvents(): EventSession[] {
    return this.data.events || [];
  }

  async createEvent(
    eventData: {
      title: string;
      description?: string;
      attendancePoints?: number;
      date?: string; // New: Custom date
      startTime?: string;
      punctualityBonusPoints?: number;
      qrCode?: string;
    },
    executor: SystemUser
  ): Promise<{ success: boolean; event?: EventSession; error?: string }> {
    if (executor.role !== "admin" && !executor.permissions.canCreateEvents) {
      this.logAudit({
        userId: executor.id,
        userName: executor.name,
        userRole: executor.role,
        action: "security_block",
        targetType: "event",
        targetId: "new",
        targetName: eventData.title,
        details: "محاولة غير مصرح بها لإنشاء فعالية جديدة",
        status: "denied",
      });
      return { success: false, error: "غير مصرح لك بإنشاء فعاليات" };
    }

    const id = "evt-" + Date.now().toString(36);
    const qrCode =
      eventData.qrCode?.trim() ||
      `EVT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const newEvent: EventSession = {
      id,
      title: eventData.title.trim(),
      date: eventData.date || formatLocalDate(new Date()),
      description: eventData.description?.trim() || "",
      qrCode,
      attendancePoints: eventData.attendancePoints ?? 30,
      startTime: eventData.startTime || "17:00",
      punctualityBonusPoints: eventData.punctualityBonusPoints ?? 15,
      isActive: true,
      createdAt: new Date().toISOString(),
      createdBy: executor.name,
    };

    if (!this.data.events) this.data.events = [];
    this.data.events = [newEvent, ...this.data.events];
    this.notify();

    if (executor) {
      this.logAudit({
        userId: executor.id,
        userName: executor.name,
        userRole: executor.role,
        action: "create_event",
        targetType: "event",
        targetId: newEvent.id,
        targetName: newEvent.title,
        details: `إنشاء فعالية حضور جديدة [${newEvent.title}] برمز QR: ${newEvent.qrCode} ونقاط: ${newEvent.attendancePoints} XP`,
        status: "success",
      }).catch(() => {});
    }

    try {
      await setDoc(doc(db, "events", newEvent.id), stripUndefined(newEvent), { merge: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `events/${newEvent.id}`, { silent: true });
    }
    this.triggerAutoSync();
    return { success: true, event: newEvent };
  }

  toggleEventStatus(eventId: string, executor: SystemUser): { success: boolean; error?: string } {
    if (executor.role !== "admin" && !executor.permissions.canCreateEvents) {
      return { success: false, error: "غير مصرح لك بتعديل حالة الفعالية" };
    }
    const evt = this.data.events.find((e) => e.id === eventId);
    if (!evt) return { success: false, error: "الفعالية غير موجودة" };

    evt.isActive = !evt.isActive;
    updateDoc(doc(db, "events", eventId), { isActive: evt.isActive });
    return { success: true };
  }

  deleteEvent(eventId: string, executor: SystemUser): { success: boolean; error?: string } {
    if (executor.role !== "admin" && !executor.permissions.canCreateEvents) {
      return { success: false, error: "غير مصرح لك بحذف الفعاليات" };
    }
    deleteDoc(doc(db, "events", eventId));
    return { success: true };
  }

  // --- Strict QR Scan Schedule Evaluator (Every Friday 5:00 PM - 7:00 PM; otherwise closed) ---
  getQRScanStatus(nowInput?: Date): {
    isOpen: boolean;
    reason: "open_scheduled" | "open_manual" | "closed_manual" | "closed_wrong_day" | "closed_before_open" | "closed_after_close";
    openTime: string;
    closeTime: string;
    openTimeAr: string;
    closeTimeAr: string;
    title: string;
    message: string;
    nextOpenDate: Date;
    closeDate: Date | null;
  } {
    const now = nowInput || new Date();
    const config = this.data.config;
    const openTime = config.qrScanOpenTime || "17:00";
    const closeTime = config.qrScanCloseTime || "19:00";

    const parseTime = (t: string, fallbackH: number, fallbackM: number) => {
      const parts = t.split(":").map(Number);
      const h = Number.isFinite(parts[0]) ? parts[0] : fallbackH;
      const m = Number.isFinite(parts[1]) ? parts[1] : fallbackM;
      return { h, m, totalMinutes: h * 60 + m };
    };

    const formatAr12 = (h: number, m: number) => {
      const period = h >= 12 ? "م" : "ص";
      const h12 = h % 12 === 0 ? 12 : h % 12;
      const mStr = m === 0 ? "00" : String(m).padStart(2, "0");
      return `${h12}:${mStr} ${period}`;
    };

    const openObj = parseTime(openTime, 17, 0);
    const closeObj = parseTime(closeTime, 19, 0);
    const openTimeAr = formatAr12(openObj.h, openObj.m);
    const closeTimeAr = formatAr12(closeObj.h, closeObj.m);

    const currentDay = now.getDay(); // 5 === Friday
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Calculate next Friday opening timestamp
    const nextOpenDate = new Date(now);
    let daysUntilFriday = (5 - currentDay + 7) % 7;
    if (daysUntilFriday === 0 && currentMinutes >= openObj.totalMinutes) {
      daysUntilFriday = 7;
    }
    nextOpenDate.setDate(now.getDate() + daysUntilFriday);
    nextOpenDate.setHours(openObj.h, openObj.m, 0, 0);

    // Calculate today's closing timestamp when today is Friday
    let closeDate: Date | null = null;
    if (currentDay === 5) {
      closeDate = new Date(now);
      closeDate.setHours(closeObj.h, closeObj.m, 0, 0);
    }

    if (config.isQrScanManuallyLocked) {
      return {
        isOpen: false,
        reason: "closed_manual",
        openTime,
        closeTime,
        openTimeAr,
        closeTimeAr,
        title: "تم إغلاق مسح الـ QR يدوياً",
        message: "تم إغلاق نظام مسح الـ QR يدوياً من الإدارة العامة.",
        nextOpenDate,
        closeDate,
      };
    }

    if (config.isQrScanManuallyOpened) {
      return {
        isOpen: true,
        reason: "open_manual",
        openTime,
        closeTime,
        openTimeAr,
        closeTimeAr,
        title: "مسح الـ QR مفتوح استثنائياً",
        message: "تم فتح مسح الـ QR استثنائياً من الإدارة (الموعد الرسمي كل جمعة من 5:00 م إلى 7:00 م).",
        nextOpenDate,
        closeDate,
      };
    }

    if (currentDay !== 5) {
      return {
        isOpen: false,
        reason: "closed_wrong_day",
        openTime,
        closeTime,
        openTimeAr,
        closeTimeAr,
        title: "مسح الـ QR مغلق حالياً",
        message: `مسح الـ QR متاح فقط أثناء وقت الاجتماع كل يوم جمعة من الساعة ${openTimeAr} إلى ${closeTimeAr} — غير ذلك يكون مغلقاً.`,
        nextOpenDate,
        closeDate: null,
      };
    }

    if (currentMinutes < openObj.totalMinutes) {
      return {
        isOpen: false,
        reason: "closed_before_open",
        openTime,
        closeTime,
        openTimeAr,
        closeTimeAr,
        title: "لم يبدأ موعد مسح الـ QR بعد",
        message: `يفتح مسح الـ QR اليوم (الجمعة) من الساعة ${openTimeAr} وحتى الساعة ${closeTimeAr}.`,
        nextOpenDate,
        closeDate,
      };
    }

    if (currentMinutes >= closeObj.totalMinutes) {
      return {
        isOpen: false,
        reason: "closed_after_close",
        openTime,
        closeTime,
        openTimeAr,
        closeTimeAr,
        title: "فترة تسجيل الحضور قد انتهت",
        message: `فترة تسجيل الحضور قد انتهت. تم غلق مسح الـ QR تلقائياً الساعة ${closeTimeAr} (متاح كل جمعة من ${openTimeAr} إلى ${closeTimeAr}).`,
        nextOpenDate,
        closeDate,
      };
    }

    return {
      isOpen: true,
      reason: "open_scheduled",
      openTime,
      closeTime,
      openTimeAr,
      closeTimeAr,
      title: "مسح الـ QR مفتوح الآن",
      message: `متاح الآن تسجيل الحضور بالـ QR أثناء وقت الاجتماع (كل جمعة من ${openTimeAr} إلى ${closeTimeAr}).`,
      nextOpenDate,
      closeDate,
    };
  }

  // --- Strict QR Attendance Recording with Duplicate Prevention ---
  async recordQRAttendance(params: {
    eventIdOrCode: string;
    memberId: string;
    isPunctual?: boolean;
    executor: SystemUser;
    manualBonusPoints?: number;
    manualBonusReason?: string;
  }): Promise<{
    success: boolean;
    record?: AttendanceRecord;
    error?: string;
    pointsAwarded?: number;
    member?: CustomMember;
    event?: EventSession;
  }> {
    const { eventIdOrCode, memberId, isPunctual, executor, manualBonusPoints, manualBonusReason } = params;

    // 1. Permission check (Admin, Priest, Leader, and Servant)
    const canScan =
      executor.role === "admin" ||
      executor.role === "priest" ||
      executor.role === "servant" ||
      executor.permissions?.canScanAttendance;

    if (!canScan) {
      this.logAudit({
        userId: executor.id,
        userName: executor.name,
        userRole: executor.role,
        action: "security_block",
        targetType: "member",
        targetId: memberId,
        targetName: memberId,
        details: "محاولة مسح QR للحضور دون امتلاك صلاحية خادم أو مسؤول",
        status: "denied",
      });
      return { success: false, error: "غير مصرح لك بمسح QR؛ يرجى تسجيل الدخول بحساب خادم أو مسؤول" };
    }

    // 1.5 Strict QR Scan Time Validation (Every Friday 5:00 PM – 7:00 PM; otherwise closed)
    const qrStatus = this.getQRScanStatus();
    if (!qrStatus.isOpen) {
      this.logAudit({
        userId: executor.id,
        userName: executor.name,
        userRole: executor.role,
        action: "security_block",
        targetType: "member",
        targetId: memberId,
        targetName: memberId,
        details: `محاولة مسح QR خارج الموعد المسموح: ${qrStatus.message}`,
        status: "denied",
      });
      return { success: false, error: qrStatus.message };
    }

    // 2. Resolve Event (Clean & Case-insensitive) - Fallback to auto-linked Friday event
    let event: EventSession | undefined;
    const cleanEventId = (eventIdOrCode || "").trim().toLowerCase();
    if (cleanEventId) {
      event = this.data.events.find(
        (e) =>
          e.id.toLowerCase() === cleanEventId ||
          e.qrCode.trim().toLowerCase() === cleanEventId
      );
    }

    // If event not specified or not found, automatically bind to this week's Friday meeting
    if (!event) {
      event = this.ensureFridayMeetingEvent();
    }

    if (!event.isActive) {
      return { success: false, error: `اللقاء [${event.title}] غير نشط حالياً ولا يقبل تسجيل الحضور` };
    }

    // 3. Find Member (by ID, Access Code, or URL link)
    let cleanMemberCode = (memberId || "").trim();
    if (cleanMemberCode.includes("?")) {
      try {
        const queryPart = cleanMemberCode.split("?")[1] || "";
        const urlParams = new URLSearchParams(queryPart);
        const extracted = urlParams.get("code") || urlParams.get("member") || urlParams.get("id");
        if (extracted) {
          cleanMemberCode = extracted.trim();
        }
      } catch {
        const urlMatch = cleanMemberCode.match(/[?&](?:code|member|id)=([^&#]+)/);
        if (urlMatch && urlMatch[1]) {
          cleanMemberCode = decodeURIComponent(urlMatch[1]).trim();
        }
      }
    }
    const lowerMemberCode = cleanMemberCode.toLowerCase();

    const member = this.data.members.find(
      (m) =>
        m.id.toLowerCase() === lowerMemberCode ||
        (m.accessCode && m.accessCode.trim().toLowerCase() === lowerMemberCode)
    );
    if (!member) {
      return { success: false, error: `العضو صاحب الكود (${cleanMemberCode}) غير موجود في قاعدة البيانات` };
    }

    const team = this.data.teams.find((t) => t.id === member.teamId);
    const teamName = team ? team.name : "الفريق";

    // 4. DUPLICATE CHECK: Prevent duplicate attendance or awarding points twice
    if (!this.data.attendance) this.data.attendance = [];
    const alreadyAttended = this.data.attendance.find(
      (a) => a.eventId === event.id && a.memberId === member.id
    );

    if (alreadyAttended) {
      return {
        success: false,
        error: `تم تسجيل حضور (${member.name}) في هذا اللقاء مسبقاً! يمنع النظام تكرار احتساب النقاط مرتين في نفس اليوم.`,
      };
    }

    // 5. Individual Attendance Registration (Points awarded per scan for member & cumulative Friday XP for team)
    let baseAttendancePoints = event.attendancePoints || 30;
    let punctualityStatus = " (تسجيل حضور منتظم)";
    const effectivePunctual = !!isPunctual;

    if (effectivePunctual && event.punctualityBonusPoints) {
      baseAttendancePoints += event.punctualityBonusPoints;
      punctualityStatus = " (تسجيل حضور مبكر + بونص الالتزام بالموعد ⏰)";
    }

    // Optional Extra Manual Bonus from Servant / Admin
    const extraBonus = Number(manualBonusPoints) || 0;
    const pointsAwarded = baseAttendancePoints + (extraBonus > 0 ? extraBonus : 0);

    // Update member points
    member.points = (member.points || 0) + pointsAwarded;

    // 6. Record Attendance Score Transaction (for member statement)
    const nowIso = new Date().toISOString();
    const reasonText = `تسجيل حضور تلقائي بالـ QR في [${event.title}]${punctualityStatus}`;

    const tx: ScoreTransaction = {
      id: "tx-qr-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      timestamp: nowIso,
      targetType: "member",
      targetId: member.id,
      targetName: member.name,
      teamId: member.teamId,
      teamName: teamName,
      points: baseAttendancePoints,
      reason: reasonText,
      category: "حضور والتزام",
      notes: "",
      executorId: executor.id,
      executorName: executor.name,
      executorRole: executor.role,
    };

    // If servant/admin entered an extra manual bonus during QR scan, save it as a separate
    // bonus transaction so it ALSO adds immediately to the team's scoreboard total!
    let extraBonusTx: ScoreTransaction | null = null;
    if (extraBonus > 0) {
      extraBonusTx = {
        id: "tx-qrbonus-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        timestamp: nowIso,
        targetType: "member",
        targetId: member.id,
        targetName: member.name,
        teamId: member.teamId,
        teamName: teamName,
        points: extraBonus,
        reason: manualBonusReason?.trim() || `بونص تشجيعي مع حضور QR (${member.name})`,
        category: "بونص حضور",
        notes: `رُصد مع مسح QR في ${event.title}`,
        executorId: executor.id,
        executorName: executor.name,
        executorRole: executor.role,
      };
    }

    // 7. Record Attendance (Preserved permanently for EVERY QR scan!)
    const attendanceRecord: AttendanceRecord = {
      id: "att-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      eventId: event.id,
      eventTitle: event.title,
      memberId: member.id,
      memberName: member.name,
      teamId: member.teamId,
      teamName: teamName,
      scannedAt: nowIso,
      scannedByUserId: executor.id,
      scannedByUserName: executor.name,
      pointsAwarded,
      isPunctual: effectivePunctual,
    };

    this.data.attendance = [attendanceRecord, ...(this.data.attendance || [])];
    this.data.transactions = extraBonusTx
      ? [extraBonusTx, tx, ...this.data.transactions]
      : [tx, ...this.data.transactions];

    // Recalculate cumulative team score (all Fridays + all manual/member bonuses)
    const syncedTeamPoints = team
      ? this.computeTeamCanonicalPoints(team.id).totalPoints
      : 0;
    if (team) {
      team.points = syncedTeamPoints;
      this.saveTeamsToStorage(this.data.teams);
    }

    // Persist local backups immediately & notify UI before awaiting network commit
    this.saveAttendanceToStorage(this.data.attendance);
    this.saveTransactionsToStorage(this.data.transactions);
    this.saveMembersToStorage(this.data.members);
    this.notify();

    // 8. Atomic Firestore Write Batch (Event + Attendance + Transactions + Member + Team)
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, "events", event.id), stripUndefined(event), { merge: true });
      batch.set(doc(db, "attendance", attendanceRecord.id), stripUndefined(attendanceRecord));
      batch.set(doc(db, "transactions", tx.id), stripUndefined(tx));
      if (extraBonusTx) {
        batch.set(doc(db, "transactions", extraBonusTx.id), stripUndefined(extraBonusTx));
      }
      batch.set(doc(db, "members", member.id), { points: member.points }, { merge: true });
      if (team) {
        batch.set(doc(db, "teams", team.id), { points: syncedTeamPoints }, { merge: true });
      }
      await batch.commit();
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `attendance/${attendanceRecord.id}`, { silent: true });
      return {
        success: false,
        error: "حدث خطأ أثناء حفظ مسح الـ QR في قاعدة البيانات، يرجى المحاولة مرة أخرى.",
      };
    }

    // 9. Log Audit under Servant / Admin name
    this.logAudit({
      userId: executor.id,
      userName: executor.name,
      userRole: executor.role,
      action: "attendance_scan",
      targetType: "member",
      targetId: member.id,
      targetName: member.name,
      details: `تسجيل حضور عبر QR للعضو [${member.name}] في [${event.title}] بواسطة الخادم [${executor.name}]. +${pointsAwarded} XP`,
      status: "success",
    }).catch(() => {});

    this.triggerAutoSync();

    return {
      success: true,
      record: attendanceRecord,
      pointsAwarded,
      member,
      event,
    };
  }

  getAttendanceRecords(eventId?: string): AttendanceRecord[] {
    const list = this.data.attendance || [];
    if (!eventId) return list;
    return list.filter((a) => a.eventId === eventId);
  }

  async recalculateTeamsByAttendanceOnly(executor?: SystemUser): Promise<{ success: boolean; error?: string }> {
    if (executor && executor.role !== "admin" && !executor.permissions?.canClearLogs) {
      return { success: false, error: "غير مصرح لك بإدارة النقاط" };
    }
    return { success: true };
  }

  /**
   * يربط لقاء الجمعة تلقائياً بتاريخ الجهاز الحالي بدون الحاجة لتحديده يدوياً
   */
  ensureFridayMeetingEvent(dateStr?: string): EventSession {
    const targetDate = dateStr || getCurrentOrNearestFridayDate();
    const existing = this.data.events.find(
      (e) => e.date === targetDate || e.id === `evt-friday-${targetDate}` || e.title.includes(targetDate)
    );
    if (existing) return existing;

    const d = new Date(targetDate);
    const arabicDate = !isNaN(d.getTime())
      ? d.toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
      : targetDate;

    const newEvent: EventSession = {
      id: `evt-friday-${targetDate}`,
      title: `لقاء الجمعة الروحي والدراسي (${arabicDate})`,
      date: targetDate,
      description: `اللقاء الأسبوعي لشباب جامعة - صلاة وتسبيح ودراسة الكلمة ومسابقات المجموعات لـ ${arabicDate}`,
      qrCode: `EVT-FRIDAY-${targetDate.replace(/-/g, "")}`,
      attendancePoints: 30,
      punctualityBonusPoints: 15,
      startTime: "18:00",
      isActive: true,
      createdAt: new Date().toISOString(),
      createdBy: "النظام التلقائي لاجتماع الشباب (تاريخ الجهاز)",
    };

    this.data.events.unshift(newEvent);
    try {
      setDoc(doc(db, "events", newEvent.id), newEvent).catch(() => {});
    } catch {}
    setTimeout(() => this.notify(), 0);
    return newEvent;
  }

  async setMemberAttendance(params: {
    eventId: string;
    memberId: string;
    isPresent: boolean;
    isPunctual?: boolean;
    executor: SystemUser;
  }): Promise<{ success: boolean; record?: AttendanceRecord; error?: string }> {
    const { eventId, memberId, isPresent, isPunctual = true, executor } = params;

    const event = this.data.events.find((e) => e.id === eventId);
    if (!event) return { success: false, error: "الفعالية أو اللقاء غير موجود" };

    const member = this.data.members.find((m) => m.id === memberId);
    if (!member) return { success: false, error: "العضو غير موجود" };

    const team = this.data.teams.find((t) => t.id === member.teamId);
    const teamName = team ? team.name : "الفريق";

    if (!this.data.attendance) this.data.attendance = [];
    const existingIndex = this.data.attendance.findIndex(
      (a) => a.eventId === event.id && a.memberId === member.id
    );

    const batch = writeBatch(db);

    if (isPresent) {
      if (existingIndex !== -1) {
        const existing = this.data.attendance[existingIndex];
        if (existing.isPunctual !== isPunctual) {
          const delta = isPunctual
            ? (event.punctualityBonusPoints || 15)
            : -(event.punctualityBonusPoints || 15);
          existing.isPunctual = isPunctual;
          existing.pointsAwarded = Math.max(0, existing.pointsAwarded + delta);
          member.points = Math.max(0, (member.points || 0) + delta);
          const syncedTeamPoints = team
            ? this.computeTeamCanonicalPoints(team.id).totalPoints
            : 0;
          if (team) {
            team.points = syncedTeamPoints;
            batch.set(doc(db, "teams", team.id), { points: syncedTeamPoints }, { merge: true });
          }
          batch.set(doc(db, "attendance", existing.id), stripUndefined(existing), { merge: true });
          batch.set(doc(db, "members", member.id), { points: member.points }, { merge: true });
          this.saveAttendanceToStorage(this.data.attendance);
          this.saveMembersToStorage(this.data.members);
          this.notify();
          try {
            await batch.commit();
          } catch (e) {
            handleFirestoreError(e, OperationType.WRITE, `attendance/${existing.id}`, { silent: true });
          }
          this.triggerAutoSync();
        }
        return { success: true, record: existing };
      }

      let pointsAwarded = event.attendancePoints || 30;
      if (isPunctual && event.punctualityBonusPoints) {
        pointsAwarded += event.punctualityBonusPoints;
      }

      member.points = (member.points || 0) + pointsAwarded;

      const nowIso = new Date().toISOString();
      const tx: ScoreTransaction = {
        id: "tx-att-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        timestamp: nowIso,
        targetType: "member",
        targetId: member.id,
        targetName: member.name,
        teamId: member.teamId,
        teamName: teamName,
        points: pointsAwarded,
        reason: `تسجيل حضور: ${event.title}${isPunctual ? " (في الموعد)" : ""}`,
        category: "حضور والتزام",
        notes: "",
        executorId: executor.id,
        executorName: executor.name,
        executorRole: executor.role,
      };

      const record: AttendanceRecord = {
        id: "att-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        eventId: event.id,
        eventTitle: event.title,
        memberId: member.id,
        memberName: member.name,
        teamId: member.teamId,
        teamName: teamName,
        scannedAt: nowIso,
        scannedByUserId: executor.id,
        scannedByUserName: executor.name,
        pointsAwarded,
        isPunctual,
      };

      this.data.attendance = [record, ...this.data.attendance];
      this.data.transactions = [tx, ...this.data.transactions];

      const syncedTeamPoints = team
        ? this.computeTeamCanonicalPoints(team.id).totalPoints
        : 0;
      if (team) {
        team.points = syncedTeamPoints;
        this.saveTeamsToStorage(this.data.teams);
        batch.set(doc(db, "teams", team.id), { points: syncedTeamPoints }, { merge: true });
      }

      this.saveAttendanceToStorage(this.data.attendance);
      this.saveTransactionsToStorage(this.data.transactions);
      this.saveMembersToStorage(this.data.members);
      this.notify();

      batch.set(doc(db, "events", event.id), stripUndefined(event), { merge: true });
      batch.set(doc(db, "attendance", record.id), stripUndefined(record));
      batch.set(doc(db, "transactions", tx.id), stripUndefined(tx));
      batch.set(doc(db, "members", member.id), { points: member.points }, { merge: true });

      try {
        await batch.commit();
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `attendance/${record.id}`, { silent: true });
        return { success: false, error: "تعذر حفظ الحضور في قاعدة البيانات" };
      }

      this.logAudit({
        userId: executor.id,
        userName: executor.name,
        userRole: executor.role,
        action: "attendance_scan",
        targetType: "member",
        targetId: member.id,
        targetName: member.name,
        details: `تسجيل حضور يدوي للعضو [${member.name}] في [${event.title}]. +${pointsAwarded} XP`,
        status: "success",
      }).catch(() => {});

      this.triggerAutoSync();
      return { success: true, record };
    } else {
      if (existingIndex !== -1) {
        const existing = this.data.attendance[existingIndex];
        const pts = existing.pointsAwarded || 0;
        member.points = Math.max(0, (member.points || 0) - pts);

        this.data.attendance.splice(existingIndex, 1);

        // Also remove the matching attendance transaction for this event+member if present
        const matchingAttTx = this.data.transactions.find(
          (t) =>
            t.targetType === "member" &&
            t.targetId === member.id &&
            this.isAttendanceTransaction(t) &&
            (t.reason.includes(event.title) ||
              Math.abs(new Date(t.timestamp).getTime() - new Date(existing.scannedAt).getTime()) < 60000)
        );
        if (matchingAttTx) {
          this.data.transactions = this.data.transactions.filter((t) => t.id !== matchingAttTx.id);
          batch.delete(doc(db, "transactions", matchingAttTx.id));
        }

        const syncedTeamPoints = team
          ? this.computeTeamCanonicalPoints(team.id).totalPoints
          : 0;
        if (team) {
          team.points = syncedTeamPoints;
          this.saveTeamsToStorage(this.data.teams);
          batch.set(doc(db, "teams", team.id), { points: syncedTeamPoints }, { merge: true });
        }

        batch.delete(doc(db, "attendance", existing.id));
        batch.set(doc(db, "members", member.id), { points: member.points }, { merge: true });

        this.saveAttendanceToStorage(this.data.attendance);
        this.saveTransactionsToStorage(this.data.transactions);
        this.saveMembersToStorage(this.data.members);
        this.notify();

        try {
          await batch.commit();
        } catch (e) {
          handleFirestoreError(e, OperationType.DELETE, `attendance/${existing.id}`, { silent: true });
        }

        this.logAudit({
          userId: executor.id,
          userName: executor.name,
          userRole: executor.role,
          action: "attendance_scan",
          targetType: "member",
          targetId: member.id,
          targetName: member.name,
          details: `إلغاء تسجيل حضور العضو [${member.name}] واسترجاع ${pts} XP`,
          status: "success",
        }).catch(() => {});

        this.triggerAutoSync();
      }
      return { success: true };
    }
  }

  async batchSetAttendance(params: {
    eventId: string;
    memberIds: string[];
    isPresent: boolean;
    executor: SystemUser;
  }): Promise<{ success: boolean; count: number }> {
    let count = 0;
    for (const memberId of params.memberIds) {
      const res = await this.setMemberAttendance({
        eventId: params.eventId,
        memberId,
        isPresent: params.isPresent,
        isPunctual: true,
        executor: params.executor,
      });
      if (res.success) count++;
    }
    return { success: true, count };
  }

  getTeamTransactions(teamId: string): ScoreTransaction[] {
    return this.data.transactions.filter(
      (tx) => tx.teamId === teamId || (tx.targetType === "team" && tx.targetId === teamId)
    );
  }

  async clearTeamTransactions(teamId: string): Promise<void> {
    const txsToDelete = this.data.transactions.filter(
      (tx) => tx.teamId === teamId || (tx.targetType === "team" && tx.targetId === teamId)
    );
    const batch = writeBatch(db);
    txsToDelete.forEach(tx => batch.delete(doc(db, "transactions", tx.id)));
    await batch.commit();
  }

  async clearAllTransactions(): Promise<void> {
    const batch = writeBatch(db);
    this.data.transactions.forEach(tx => batch.delete(doc(db, "transactions", tx.id)));
    await batch.commit();
  }

  async undoTransaction(transactionId: string): Promise<boolean> {
    const tx = this.data.transactions.find((t) => t.id === transactionId);
    if (!tx) return false;

    this.data.transactions = this.data.transactions.filter((t) => t.id !== transactionId);
    this.saveTransactionsToStorage(this.data.transactions);

    const writeOps: Array<{ type: "set" | "delete"; ref: ReturnType<typeof doc>; payload?: Record<string, unknown> }> = [
      { type: "delete", ref: doc(db, "transactions", transactionId) },
    ];

    if (tx.targetType === "team") {
      const team = this.data.teams.find((t) => t.id === tx.targetId);
      if (team) {
        team.points = this.computeTeamCanonicalPoints(team.id).totalPoints;
        writeOps.push({ type: "set", ref: doc(db, "teams", team.id), payload: { points: team.points } });
      }
      const teamMembers = this.data.members.filter((m) => m.teamId === tx.targetId);
      if (teamMembers.length > 0) {
        const pointsPerMember =
          tx.points >= 0
            ? Math.max(tx.points > 0 ? 1 : 0, Math.round(tx.points / teamMembers.length))
            : Math.min(tx.points < 0 ? -1 : 0, -Math.round(Math.abs(tx.points) / teamMembers.length));

        if (pointsPerMember !== 0) {
          teamMembers.forEach((mem) => {
            mem.points = Math.max(0, (mem.points || 0) - pointsPerMember);
            writeOps.push({ type: "set", ref: doc(db, "members", mem.id), payload: { points: mem.points } });
          });
        }
        this.saveMembersToStorage(this.data.members);
      }
    } else {
      const member = this.data.members.find((m) => m.id === tx.targetId);
      if (member) {
        member.points = Math.max(0, member.points - tx.points);
        writeOps.push({ type: "set", ref: doc(db, "members", member.id), payload: { points: member.points } });
      }
      const team = this.data.teams.find((t) => t.id === tx.teamId);
      if (team) {
        team.points = this.computeTeamCanonicalPoints(team.id).totalPoints;
        writeOps.push({ type: "set", ref: doc(db, "teams", team.id), payload: { points: team.points } });
      }
      this.saveMembersToStorage(this.data.members);
    }

    this.saveTeamsToStorage(this.data.teams);
    this.notify();

    try {
      const CHUNK_SIZE = 400;
      for (let i = 0; i < writeOps.length; i += CHUNK_SIZE) {
        const chunk = writeOps.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach((op) => {
          if (op.type === "delete") {
            batch.delete(op.ref);
          } else if (op.payload) {
            batch.set(op.ref, op.payload, { merge: true });
          }
        });
        await batch.commit();
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `transactions/${transactionId}`, { silent: true });
      return false;
    }

    this.triggerAutoSync();
    return true;
  }

  // --- Activity Reasons Operations ---
  getActivityReasons(): ActivityReason[] {
    return this.data.activityReasons || DEFAULT_ACTIVITY_REASONS;
  }

  async addActivityReason(reasonData: {
    text: string;
    category?: string;
    points?: number;
    icon?: string;
    description?: string;
    howToAward?: string;
  }): Promise<ActivityReason> {
    const id = "ar-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const newReason: ActivityReason = {
      id,
      text: reasonData.text.trim(),
      category: reasonData.category?.trim() || "نشاط وتحدي",
      points: typeof reasonData.points === "number" ? reasonData.points : 30,
      icon: reasonData.icon || "🎯",
      description: reasonData.description?.trim() || "",
      howToAward: reasonData.howToAward?.trim() || "",
    };
    if (!this.data.activityReasons) {
      this.data.activityReasons = [...DEFAULT_ACTIVITY_REASONS];
    }
    this.data.activityReasons.unshift(newReason);
    this.notify();
    await setDoc(doc(db, "activityReasons", id), newReason);
    this.triggerAutoSync();
    return newReason;
  }

  async updateActivityReason(id: string, updates: Partial<ActivityReason>): Promise<void> {
    if (!this.data.activityReasons) {
      this.data.activityReasons = [...DEFAULT_ACTIVITY_REASONS];
    }
    const idx = this.data.activityReasons.findIndex((r) => r.id === id);
    if (idx !== -1) {
      this.data.activityReasons[idx] = {
        ...this.data.activityReasons[idx],
        ...updates,
      };
      this.notify();
      await updateDoc(doc(db, "activityReasons", id), updates);
      this.triggerAutoSync();
    }
  }

  async deleteActivityReason(id: string): Promise<void> {
    if (!this.data.activityReasons) {
      this.data.activityReasons = [...DEFAULT_ACTIVITY_REASONS];
    }
    this.data.activityReasons = this.data.activityReasons.filter((r) => r.id !== id);
    this.notify();
    await deleteDoc(doc(db, "activityReasons", id));
    this.triggerAutoSync();
  }

  async resetActivityReasonsToDefault(): Promise<void> {
    const batch = writeBatch(db);
    // Delete existing
    this.data.activityReasons.forEach((r) => batch.delete(doc(db, "activityReasons", r.id)));
    // Add default
    DEFAULT_ACTIVITY_REASONS.forEach((r) => batch.set(doc(db, "activityReasons", r.id), r));
    this.data.activityReasons = [...DEFAULT_ACTIVITY_REASONS];
    this.notify();
    await batch.commit();
    this.triggerAutoSync();
  }

  async resetScoresOnly(): Promise<void> {
    const ops: Array<{ type: "set" | "delete"; ref: ReturnType<typeof doc>; payload?: Record<string, unknown> }> = [];
    this.data.teams.forEach((t) => {
      t.points = 0;
      ops.push({ type: "set", ref: doc(db, "teams", t.id), payload: { points: 0 } });
    });
    this.data.members.forEach((m) => {
      m.points = 0;
      ops.push({ type: "set", ref: doc(db, "members", m.id), payload: { points: 0 } });
    });
    (this.data.transactions || []).forEach((tx) => {
      ops.push({ type: "delete", ref: doc(db, "transactions", tx.id) });
    });
    // Preserve ALL QR attendance scans even when resetting scores!
    this.data.transactions = [];
    this.saveTeamsToStorage(this.data.teams);
    this.saveMembersToStorage(this.data.members);
    this.saveTransactionsToStorage([]);
    this.notify();

    try {
      const CHUNK_SIZE = 400;
      for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
        const chunk = ops.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach((op) => {
          if (op.type === "delete") {
            batch.delete(op.ref);
          } else if (op.payload) {
            batch.set(op.ref, op.payload, { merge: true });
          }
        });
        await batch.commit();
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, "resetScoresOnly", { silent: true });
    }
    this.triggerAutoSync();
  }

  async resetToDefaults(): Promise<void> {
    // CRITICAL: Preserve user's teams, members, and QR attendance scans!
    // Only reset meeting config to defaults without ever injecting fake DEFAULT_TEAMS.
    this.data.config = { ...DEFAULT_CONFIG };
    this.notify();
    try {
      await setDoc(doc(db, "config", "meeting"), stripUndefined(DEFAULT_CONFIG), { merge: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, "config/meeting", { silent: true });
    }
  }

  async updateDailyChallenge(
    challengeUpdates: Partial<DailyChallenge>,
    executor?: SystemUser
  ): Promise<{ success: boolean; error?: string }> {
    if (executor && !executor.permissions.canEditTeams && executor.role !== "admin") {
      return { success: false, error: "ليس لديك صلاحية تعديل تحدي اليوم" };
    }

    const currentConfig = this.data.config;
    const currentChallenge = currentConfig.dailyChallenge || {
      id: `dc-${Date.now()}`,
      title: "تحدي اليوم المميز",
      description: "",
      pointsReward: 100,
      icon: "🔥",
      category: "تحدي اليوم",
      endsAt: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
      isActive: true,
    };

    const updatedChallenge: DailyChallenge = {
      ...currentChallenge,
      ...challengeUpdates,
    };

    const updatedConfig: MeetingConfig = {
      ...currentConfig,
      dailyChallenge: updatedChallenge,
    };

    this.data.config = updatedConfig;
    this.notify();

    await setDoc(doc(db, "config", "meeting"), updatedConfig, { merge: true });
    return { success: true };
  }

  exportDataJson(): string {
    return JSON.stringify(this.data, null, 2);
  }

  async importDataJson(jsonStr: string): Promise<{ success: boolean; error?: string }> {
    try {
      const parsed = JSON.parse(jsonStr) as MeetingData;
      if (!parsed || !parsed.teams || !parsed.members) {
        return { success: false, error: "تنسيق الملف غير صالح" };
      }

      // Collect all operations
      const ops: Array<{ ref: any; data: any; type: "set" | "delete" }> = [];

      // 1. Settings
      if (parsed.config) {
        ops.push({ ref: doc(db, "config", "meeting"), data: parsed.config, type: "set" });
      }

      // 2. Teams
      parsed.teams.forEach((t) => {
        ops.push({ ref: doc(db, "teams", t.id), data: t, type: "set" });
      });

      // 3. Members
      parsed.members.forEach((m) => {
        ops.push({ ref: doc(db, "members", m.id), data: m, type: "set" });
      });

      // 4. Activity Reasons
      if (parsed.activityReasons) {
        parsed.activityReasons.forEach((r) => {
          ops.push({ ref: doc(db, "activityReasons", r.id), data: r, type: "set" });
        });
      }

      // 5. Events
      if (parsed.events) {
        parsed.events.forEach((e) => {
          ops.push({ ref: doc(db, "events", e.id), data: e, type: "set" });
        });
      }

      // 6. Transactions
      if (parsed.transactions) {
        parsed.transactions.forEach((tx) => {
          ops.push({ ref: doc(db, "transactions", tx.id), data: tx, type: "set" });
        });
      }

      // 7. Attendance
      if (parsed.attendance) {
        parsed.attendance.forEach((a) => {
          ops.push({ ref: doc(db, "attendance", a.id), data: a, type: "set" });
        });
      }

      // 8. Audit Logs
      if (parsed.auditLogs) {
        parsed.auditLogs.forEach((log) => {
          ops.push({ ref: doc(db, "auditLogs", log.id), data: log, type: "set" });
        });
      }

      // Commit in chunks of 500 (Firestore limit)
      const CHUNK_SIZE = 450;
      for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
        const chunk = ops.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach((op) => {
          if (op.type === "set") {
            batch.set(op.ref, op.data);
          } else {
            batch.delete(op.ref);
          }
        });
        await batch.commit();
      }

      // Update local data too
      this.data = {
        ...this.data,
        ...parsed,
        lastSaved: new Date().toISOString()
      };
      this.notify();

      return { success: true };
    } catch (e: any) {
      console.error("Failed to import json:", e);
      return { success: false, error: e.message };
    }
  }
  /**
   * مزامنة كافة البيانات الحالية إلى ملف جوجل شيت المرتبط
   */
  async syncToSheets(): Promise<{ success: boolean; error?: string }> {
    try {
      const spreadsheetId = googleSheets.getSpreadsheetId();
      if (!spreadsheetId) {
        return { success: false, error: "لم يتم ربط ملف جوجل شيت بعد" };
      }

      // 1. Teams
      const teamValues = this.data.teams.map(t => [
        t.id, t.name, t.icon, t.color, t.slogan || "", t.leaderName || "", t.points
      ]);
      await googleSheets.updateSheetData("Teams!A2", teamValues);

      // 2. Members
      const memberValues = this.data.members.map(m => [
        m.id, m.name, m.teamId, m.role, m.roleLabel || "", m.points, m.accessCode, m.phone || "", m.notes || "", JSON.stringify(m.permissions || {}), m.nameEn || ""
      ]);
      await googleSheets.updateSheetData("Members!A2", memberValues);

      // 3. Transactions
      const txValues = this.data.transactions.slice(0, 100).map(tx => [
        tx.id, tx.timestamp, tx.targetType, tx.targetId, tx.targetName, tx.teamId, tx.teamName, tx.points, tx.reason, tx.category || "", tx.executorName || "", tx.executorRole || ""
      ]);
      await googleSheets.updateSheetData("Transactions!A2", txValues);

      // 4. Config
      const configValues = [
        ["meetingName", this.data.config.meetingName],
        ["churchName", this.data.config.churchName],
        ["seasonName", this.data.config.seasonName],
        ["subTitle", this.data.config.subTitle],
      ];
      await googleSheets.updateSheetData("Config!A2", configValues);

      return { success: true };
    } catch (error: any) {
      console.error("Sync to sheets failed:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * جلب البيانات من ملف جوجل شيت وتحديث الحالة المحلية
   */
  async syncFromSheets(): Promise<{ success: boolean; error?: string }> {
    try {
      const spreadsheetId = googleSheets.getSpreadsheetId();
      if (!spreadsheetId) {
        return { success: false, error: "لم يتم ربط ملف جوجل شيت بعد" };
      }

      // 1. Teams
      const teamRows = await googleSheets.readSheetData("Teams!A2:G");
      const teams: CustomTeam[] = teamRows.map((row: any) => ({
        id: row[0],
        name: row[1],
        icon: row[2],
        color: row[3],
        slogan: row[4],
        leaderName: row[5],
        points: parseInt(row[6]) || 0,
      }));

      // 2. Members
      const memberRows = await googleSheets.readSheetData("Members!A2:K");
      const members: CustomMember[] = memberRows.map((row: any) => ({
        id: row[0],
        name: row[1],
        teamId: row[2],
        role: row[3] as RoleType,
        roleLabel: row[4],
        points: parseInt(row[5]) || 0,
        accessCode: row[6],
        phone: row[7],
        notes: row[8],
        permissions: row[9] ? JSON.parse(row[9]) : {},
        nameEn: row[10],
      }));

      if (teams.length > 0) this.data.teams = teams;
      if (members.length > 0) this.data.members = members;

      this.notify();
      return { success: true };
    } catch (error: any) {
      console.error("Sync from sheets failed:", error);
      return { success: false, error: error.message };
    }
  }

  // --- Visitation & Absence Management ---
  async recordVisitation(params: {
    memberId: string;
    servant: SystemUser;
    notes?: string;
  }): Promise<{ success: boolean; record?: VisitationRecord; error?: string }> {
    const member = this.data.members.find((m) => m.id === params.memberId);
    if (!member) return { success: false, error: "العضو غير موجود" };

    const team = this.data.teams.find((t) => t.id === member.teamId);
    const id = "vis-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    
    const record: VisitationRecord = {
      id,
      memberId: member.id,
      memberName: member.name,
      teamId: member.teamId,
      teamName: team ? team.name : "الفريق",
      visitedAt: new Date().toISOString(),
      servantId: params.servant.id,
      servantName: params.servant.name,
      notes: params.notes || "افتقاد وتواصل أسبوعي مع الغائبين",
    };

    if (!this.data.visitationHistory) this.data.visitationHistory = [];
    this.data.visitationHistory = [record, ...this.data.visitationHistory];

    try {
      await setDoc(doc(db, "visitationHistory", id), record);
    } catch (e) {
      console.warn("Could not save visitation record to Firestore:", e);
    }

    this.logAudit({
      userId: params.servant.id,
      userName: params.servant.name,
      userRole: params.servant.role,
      action: "edit_member",
      targetType: "member",
      targetId: member.id,
      targetName: member.name,
      details: `تسجيل افتقاد للعضو [${member.name}] بواسطة الخادم [${params.servant.name}]`,
      status: "success",
    });

    this.triggerAutoSync();
    return { success: true, record };
  }

  getVisitationHistory(): VisitationRecord[] {
    return this.data.visitationHistory || [];
  }

  async importFridayLogs(executor?: SystemUser): Promise<{ success: boolean; count: number; error?: string }> {
    const activeExecutor = executor || authStore.getCurrentUser();
    if (activeExecutor.role !== "admin" && activeExecutor.role !== "servant" && !activeExecutor.permissions?.canScanAttendance) {
      return { success: false, count: 0, error: "غير مصرح لك باستيراد السجلات" };
    }

    const batch = writeBatch(db);
    let addedCount = 0;

    // CRITICAL: NEVER create any new teams during import — only match strictly against user's existing teams!
    const findExistingTeam = (teamName: string): CustomTeam | undefined => {
      const normalized = teamName.trim().toLowerCase();
      return this.data.teams.find(
        (t) =>
          t.name.trim().toLowerCase().includes(normalized) ||
          normalized.includes(t.name.trim().toLowerCase())
      );
    };

    const manualBonuses = [
      { teamName: "تاريخ الكنيسة والأبائيات", points: 50, reason: "رصد بونص ونقاط نشاط", executor: "أبونا افرايم رياض" },
      { teamName: "الطقس والعقيدة", points: 100, reason: "رصد بونص ونقاط نشاط", executor: "أبونا افرايم رياض" },
      { teamName: "الكتاب المقدس", points: 100, reason: "رصد بونص ونقاط نشاط", executor: "أبونا افرايم رياض" },
    ];

    manualBonuses.forEach((b) => {
      const team = findExistingTeam(b.teamName);
      if (!team) return;

      const tx: ScoreTransaction = {
        id: "tx-import-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        timestamp: "2026-11-07T12:00:00Z",
        targetType: "team",
        targetId: team.id,
        targetName: team.name,
        teamId: team.id,
        teamName: team.name,
        points: b.points,
        reason: b.reason,
        category: "نشاط جماعي",
        notes: "",
        executorName: b.executor,
        executorRole: "admin",
      };
      this.data.transactions.unshift(tx);
      batch.set(doc(db, "transactions", tx.id), stripUndefined(tx));
      team.points = this.computeTeamCanonicalPoints(team.id).totalPoints;
      batch.set(doc(db, "teams", team.id), { points: team.points }, { merge: true });
      addedCount++;
    });

    const attendeesList = [
      { name: "إيرينى أشرف دانيال", team: "الطقس والعقيدة", time: "2026-11-06T19:19:00Z", scannedBy: "ايناس صابر باشا" },
      { name: "كيرلس فادي", team: "الكتاب المقدس", time: "2026-11-06T18:08:00Z", scannedBy: "ايناس صابر باشا" },
      { name: "مينا شهيد", team: "الطقس والعقيدة", time: "2026-11-06T18:05:00Z", scannedBy: "ايناس صابر باشا" },
      { name: "كيرلس نبيل", team: "الكتاب المقدس", time: "2026-11-06T18:05:00Z", scannedBy: "ايناس صابر باشا" },
      { name: "فيولا عادل", team: "تاريخ الكنيسة والأبائيات", time: "2026-11-06T18:05:00Z", scannedBy: "ايناس صابر باشا" },
      { name: "دميانة ماهر", team: "تاريخ الكنيسة والأبائيات", time: "2026-11-06T18:04:00Z", scannedBy: "ايناس صابر باشا" },
      { name: "جومانا وائل لطفي", team: "تاريخ الكنيسة والأبائيات", time: "2026-11-06T18:10:00Z", scannedBy: "ايناس صابر باشا" },
      { name: "ميلان ماجد", team: "الطقس والعقيدة", time: "2026-11-06T18:11:00Z", scannedBy: "ايناس صابر باشا" },
      { name: "فرونيا الأمير", team: "الطقس والعقيدة", time: "2026-11-06T18:12:00Z", scannedBy: "ايناس صابر باشا" },
      { name: "بسنت زكريا", team: "الطقس والعقيدة", time: "2026-11-06T18:13:00Z", scannedBy: "ايناس صابر باشا" },
      { name: "بيشوى مجدى صبحى", team: "الطقس والعقيدة", time: "2026-11-06T18:14:00Z", scannedBy: "ايناس صابر باشا" },
      { name: "جرجس مجدى فتحى", team: "الطقس والعقيدة", time: "2026-11-06T18:15:00Z", scannedBy: "ايناس صابر باشا" },
      { name: "نورا الامير لوندي", team: "الثقافية (شبابيات)", time: "2026-11-06T18:16:00Z", scannedBy: "ايناس صابر باشا" },
      { name: "جوليانا هاني ثابت", team: "الثقافية (شبابيات)", time: "2026-11-06T18:17:00Z", scannedBy: "ايناس صابر باشا" },
      { name: "مريم فوزي لطيف", team: "الثقافية (شبابيات)", time: "2026-11-06T18:18:00Z", scannedBy: "ايناس صابر باشا" },
      { name: "نورهان ميلاد", team: "الكتاب المقدس", time: "2026-11-06T18:19:00Z", scannedBy: "ايناس صابر باشا" },
      { name: "كيرلس تواضرواس", team: "الكتاب المقدس", time: "2026-11-06T18:20:00Z", scannedBy: "ايناس صابر باشا" },
      { name: "جومانا سامح عادل", team: "الكتاب المقدس", time: "2026-11-06T18:21:00Z", scannedBy: "ايناس صابر باشا" },
      { name: "جومانا وائل ناجح", team: "الكتاب المقدس", time: "2026-11-06T18:22:00Z", scannedBy: "ايناس صابر باشا" },
      { name: "إيريني ايمن", team: "تاريخ الكنيسة والأبائيات", time: "2026-11-06T18:23:00Z", scannedBy: "ايناس صابر باشا" },
      { name: "مهراثيل ماجد", team: "الكتاب المقدس", time: "2026-11-06T18:24:00Z", scannedBy: "ايناس صابر باشا" },
      { name: "يسى روماني يسى", team: "الكتاب المقدس", time: "2026-11-06T18:25:00Z", scannedBy: "ايناس صابر باشا" },
      { name: "ريموندا روماني", team: "الكتاب المقدس", time: "2026-11-06T18:26:00Z", scannedBy: "ايناس صابر باشا" },
      { name: "مارفي راي", team: "الكتاب المقدس", time: "2026-11-06T18:27:00Z", scannedBy: "ايناس صابر باشا" },
      { name: "لوجي عصام", team: "الكتاب المقدس", time: "2026-11-06T18:28:00Z", scannedBy: "ايناس صابر باشا" },
      { name: "مايفيل ماجد", team: "الكتاب المقدس", time: "2026-11-06T18:29:00Z", scannedBy: "ايناس صابر باشا" },
      { name: "جوليانا هاني ثابت", team: "الكتاب المقدس", time: "2026-11-06T18:30:00Z", scannedBy: "ايناس صابر باشا" },
      { name: "مايفيل ماجد منير", team: "الكتاب المقدس", time: "2026-11-06T18:31:00Z", scannedBy: "ايناس صابر باشا" },
      { name: "انطون زاخر نعيم", team: "الكتاب المقدس", time: "2026-11-06T18:32:00Z", scannedBy: "ايناس صابر باشا" },
      { name: "ماريان روماني", team: "الكتاب المقدس", time: "2026-11-06T18:33:00Z", scannedBy: "ايناس صابر باشا" },
      { name: "مينا جمال", team: "الكتاب المقدس", time: "2026-11-06T18:34:00Z", scannedBy: "ايناس صابر باشا" },
      { name: "سيمون نشأت راضى", team: "الكتاب المقدس", time: "2026-11-06T18:35:00Z", scannedBy: "ايناس صابر باشا" },
      { name: "ايناس صابر باشا", team: "الكتاب المقدس", time: "2026-11-06T18:36:00Z", scannedBy: "ايناس صابر باشا" },
      { name: "جرجس منتصر فتحى", team: "الكتاب المقدس", time: "2026-11-06T18:37:00Z", scannedBy: "ايناس صابر باشا" },
      { name: "جومانا سامى", team: "الكتاب المقدس", time: "2026-11-06T18:38:00Z", scannedBy: "ايناس صابر باشا" },
      { name: "مورين اسكندر ظريف", team: "الكتاب المقدس", time: "2026-11-06T18:39:00Z", scannedBy: "ايناس صابر باشا" },
      { name: "دميانة مجدى", team: "تاريخ الكنيسة والأبائيات", time: "2026-11-06T18:40:00Z", scannedBy: "مريم اشرف حلمى" },
      { name: "ماريان عزت", team: "تاريخ الكنيسة والأبائيات", time: "2026-11-06T18:41:00Z", scannedBy: "مريم اشرف حلمى" },
      { name: "كيرلس عيسى صباح", team: "تاريخ الكنيسة والأبائيات", time: "2026-11-06T18:42:00Z", scannedBy: "مريم اشرف حلمى" },
      { name: "مايكل عماد", team: "تاريخ الكنيسة والأبائيات", time: "2026-11-06T18:43:00Z", scannedBy: "مريم اشرف حلمى" },
      { name: "كيرلس اسكندر ظريف", team: "تاريخ الكنيسة والأبائيات", time: "2026-11-06T18:44:00Z", scannedBy: "مريم اشرف حلمى" },
      { name: "امجد مجدى فكره", team: "تاريخ الكنيسة والأبائيات", time: "2026-11-06T18:45:00Z", scannedBy: "مريم اشرف حلمى" },
      { name: "مينا تواضروس", team: "تاريخ الكنيسة والأبائيات", time: "2026-11-06T18:46:00Z", scannedBy: "مريم اشرف حلمى" },
      { name: "مايكل عماد", team: "تاريخ الكنيسة والأبائيات", time: "2026-11-06T18:47:00Z", scannedBy: "مريم اشرف حلمى" },
      { name: "كيرلس عيسى", team: "تاريخ الكنيسة والأبائيات", time: "2026-11-06T18:48:00Z", scannedBy: "مريم اشرف حلمى" },
      { name: "فيلوباتير سامح", team: "تاريخ الكنيسة والأبائيات", time: "2026-11-06T18:49:00Z", scannedBy: "مريم اشرف حلمى" },
      { name: "مارتينا اشرف حلمى", team: "تاريخ الكنيسة والأبائيات", time: "2026-11-06T18:50:00Z", scannedBy: "مريم اشرف حلمى" },
      { name: "مريم اشرف حلمى", team: "تاريخ الكنيسة والأبائيات", time: "2026-11-06T18:51:00Z", scannedBy: "مريم اشرف حلمى" },
    ];

    const event = this.ensureFridayMeetingEvent("2026-11-06");
    batch.set(doc(db, "events", event.id), stripUndefined(event), { merge: true });

    attendeesList.forEach((att) => {
      const team = findExistingTeam(att.team);
      if (!team) return; // Keep ONLY user's existing teams!

      let member = this.data.members.find((m) => m.name.trim() === att.name.trim());
      if (!member) {
        const memId = "mem-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        member = {
          id: memId,
          name: att.name,
          teamId: team.id,
          role: "member",
          roleLabel: "مخدوم",
          points: 0,
          accessCode: Math.floor(1000 + Math.random() * 9000).toString(),
          permissions: getRoleDefaultPermissions("member"),
        };
        this.data.members.push(member);
        batch.set(doc(db, "members", member.id), stripUndefined(member), { merge: true });
      }

      // Skip if attendance already exists for this Friday + member
      const alreadyExists = (this.data.attendance || []).some(
        (a) => a.eventId === event.id && a.memberId === member!.id
      );
      if (alreadyExists) return;

      const pointsAwarded = 37;
      member.points = (member.points || 0) + pointsAwarded;
      batch.set(doc(db, "members", member.id), { points: member.points }, { merge: true });

      const tx: ScoreTransaction = {
        id: "tx-import-att-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        timestamp: att.time,
        targetType: "member",
        targetId: member.id,
        targetName: member.name,
        teamId: team.id,
        teamName: team.name,
        points: pointsAwarded,
        reason: `تسجيل حضور تلقائي بالـ QR في [${event.title}] (تسجيل حضور منتظم)`,
        category: "حضور والتزام",
        notes: "",
        executorName: att.scannedBy,
        executorRole: "leader",
      };
      this.data.transactions.unshift(tx);
      batch.set(doc(db, "transactions", tx.id), stripUndefined(tx));

      const attRecord: AttendanceRecord = {
        id: "att-import-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        eventId: event.id,
        eventTitle: event.title,
        memberId: member.id,
        memberName: member.name,
        teamId: team.id,
        teamName: team.name,
        scannedAt: att.time,
        scannedByUserId: "import-user",
        scannedByUserName: att.scannedBy,
        pointsAwarded,
        isPunctual: true,
      };
      if (!this.data.attendance) this.data.attendance = [];
      this.data.attendance.unshift(attRecord);
      batch.set(doc(db, "attendance", attRecord.id), stripUndefined(attRecord));

      team.points = this.computeTeamCanonicalPoints(team.id).totalPoints;
      batch.set(doc(db, "teams", team.id), { points: team.points }, { merge: true });

      addedCount++;
    });

    this.saveTeamsToStorage(this.data.teams);
    this.saveMembersToStorage(this.data.members);
    this.saveAttendanceToStorage(this.data.attendance);
    this.saveTransactionsToStorage(this.data.transactions);
    this.notify();

    try {
      await batch.commit();
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, "importFridayLogs", { silent: true });
      return { success: false, count: 0, error: "تعذر حفظ السجل في قاعدة البيانات" };
    }
    this.triggerAutoSync();
    return { success: true, count: addedCount };
  }

  private autoSyncTimer: any = null;
  private triggerAutoSync() {
    if (this.autoSyncTimer) clearTimeout(this.autoSyncTimer);
    this.autoSyncTimer = setTimeout(() => {
      if (googleSheets.getSpreadsheetId() && authStore.hasAccessToken()) {
        this.syncToSheets();
      }
    }, 15000); // Sync every 15 seconds after last change
  }
}

export const meetingStore = new MeetingStore();
