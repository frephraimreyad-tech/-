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
import { getCurrentOrNearestFridayDate } from "./fridaySchedule";
import { db } from "./firebase";
import { googleSheets } from "./googleSheets";
import { 
  doc, 
  collection, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  addDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  limit, 
  getDocs,
  writeBatch,
  Timestamp
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

  private getCachedMembers(): CustomMember[] {
    if (typeof window === "undefined") return DEFAULT_MEMBERS;
    try {
      const saved = localStorage.getItem("meeting_members_persistent_cache_v2");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
    return DEFAULT_MEMBERS;
  }

  public saveMembersToStorage(members: CustomMember[]): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("meeting_members_persistent_cache_v2", JSON.stringify(members));
    } catch {}
  }

  private getFallbackData(): MeetingData {
    return {
      config: DEFAULT_CONFIG,
      teams: DEFAULT_TEAMS,
      members: this.getCachedMembers(),
      transactions: DEFAULT_TRANSACTIONS,
      activityReasons: DEFAULT_ACTIVITY_REASONS,
      events: DEFAULT_EVENTS,
      attendance: [],
      auditLogs: DEFAULT_AUDIT_LOGS,
      visitationHistory: [],
      lastSaved: new Date().toISOString(),
    };
  }

  private async initFirestore() {
    if (typeof window === "undefined") return;

    console.log("Initializing Firestore listeners...");

    // 1. Check if database needs seeding or Friday import
    try {
      const configDoc = await getDocs(query(collection(db, "config"), limit(1)));
      if (configDoc.empty) {
        console.log("Database empty, seeding defaults...");
        await this.seedDatabase();
        await this.importFridayLogs();
      } else {
        const txSnap = await getDocs(query(collection(db, "transactions"), limit(5)));
        if (txSnap.empty) {
          console.log("Auto-importing Friday logs to combine old and new scores...");
          await this.importFridayLogs();
        }
      }
    } catch (e) {
      console.error("Error checking database state:", e);
    }

    // 2. Setup Snapshots
    // Listen to Config
    onSnapshot(doc(db, "config", "meeting"), (docSnap) => {
      if (docSnap.exists()) {
        const remoteConfig = docSnap.data() as MeetingConfig;
        this.data.config = { ...DEFAULT_CONFIG, ...remoteConfig };
        this.notify();
      }
    });

    // Listen to Teams
    onSnapshot(collection(db, "teams"), (querySnap) => {
      const teams: CustomTeam[] = [];
      querySnap.forEach((doc) => {
        teams.push({ ...doc.data(), id: doc.id } as CustomTeam);
      });
      this.data.teams = teams;
      this.notify();
    });

    // Listen to Members
    onSnapshot(collection(db, "members"), (querySnap) => {
      const members: CustomMember[] = [];
      querySnap.forEach((doc) => {
        const m = doc.data() as any;
        const defaults = getRoleDefaultPermissions(m.role || "member");
        members.push({
          ...m,
          id: doc.id,
          avatarUrl: m.avatarUrl || "",
          permissions: { ...defaults, ...(m.permissions || {}) }
        } as CustomMember);
      });
      if (members.length > 0) {
        this.data.members = members;
        this.saveMembersToStorage(members);
      }
      this.notify();
    });

    // Listen to Transactions
    const qTransactions = query(collection(db, "transactions"), orderBy("timestamp", "desc"), limit(500));
    onSnapshot(qTransactions, (querySnap) => {
      const txs: ScoreTransaction[] = [];
      querySnap.forEach((doc) => {
        txs.push({ ...doc.data(), id: doc.id } as ScoreTransaction);
      });
      this.data.transactions = txs;
      this.notify();
    });

    // Listen to Events
    onSnapshot(collection(db, "events"), (querySnap) => {
      const evts: EventSession[] = [];
      querySnap.forEach((doc) => {
        evts.push({ ...doc.data(), id: doc.id } as EventSession);
      });
      this.data.events = evts;
      this.notify();
    });

    // Listen to Attendance
    onSnapshot(collection(db, "attendance"), (querySnap) => {
      const atts: AttendanceRecord[] = [];
      querySnap.forEach((doc) => {
        atts.push({ ...doc.data(), id: doc.id } as AttendanceRecord);
      });
      this.data.attendance = atts;
      this.notify();
    });

    // Listen to Audit Logs
    const qAudit = query(collection(db, "auditLogs"), orderBy("timestamp", "desc"), limit(500));
    onSnapshot(qAudit, (querySnap) => {
      const logs: AuditLogEntry[] = [];
      querySnap.forEach((doc) => {
        logs.push({ ...doc.data(), id: doc.id } as AuditLogEntry);
      });
      this.data.auditLogs = logs;
      this.notify();
    });

    // Listen to Activity Reasons / Bonus Guide Rubrics
    onSnapshot(collection(db, "activityReasons"), (querySnap) => {
      const reasons: ActivityReason[] = [];
      querySnap.forEach((doc) => {
        reasons.push({ ...doc.data(), id: doc.id } as ActivityReason);
      });
      if (reasons.length > 0) {
        this.data.activityReasons = reasons;
      }
      this.notify();
    });

    // Listen to Visitation History
    const qVisitation = query(collection(db, "visitationHistory"), orderBy("visitedAt", "desc"), limit(500));
    onSnapshot(qVisitation, (querySnap) => {
      const records: VisitationRecord[] = [];
      querySnap.forEach((doc) => {
        records.push({ ...doc.data(), id: doc.id } as VisitationRecord);
      });
      this.data.visitationHistory = records;
      this.notify();
    });

    this.isLoading = false;
    this.initialized = true;
    this.notify();
  }

  private async seedDatabase() {
    const batch = writeBatch(db);
    batch.set(doc(db, "config", "meeting"), DEFAULT_CONFIG);
    DEFAULT_TEAMS.forEach(team => batch.set(doc(db, "teams", team.id), team));
    DEFAULT_MEMBERS.forEach(member => batch.set(doc(db, "members", member.id), member));
    DEFAULT_EVENTS.forEach(event => batch.set(doc(db, "events", event.id), event));
    DEFAULT_ACTIVITY_REASONS.forEach(reason => batch.set(doc(db, "activityReasons", reason.id), reason));
    await batch.commit();
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

  getProcessedTeams(): ProcessedMeetingTeam[] {
    const teams = [...this.data.teams];
    const members = this.data.members;
    const attendance = this.data.attendance || [];

    const eventIds = Array.from(new Set(attendance.map(a => a.eventId)));

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

      const leadersCount = teamMembers.filter((m) => m.role === "leader" || m.role === "admin" || m.role === "priest").length;
      const servantsCount = teamMembers.filter((m) => m.role === "servant").length;
      const makhdoumeenCount = teamMembers.filter((m) => m.role === "member" || !m.role).length;

      const teamMemberIds = new Set(teamMembers.map(m => m.id));
      
      const latestEventId = eventIds[eventIds.length - 1];
      const presentCount = latestEventId 
        ? attendance.filter(a => a.eventId === latestEventId && teamMemberIds.has(a.memberId)).length
        : attendance.filter(a => teamMemberIds.has(a.memberId)).length;

      const attendanceRate = teamMembers.length > 0 ? Number(((presentCount / teamMembers.length) * 100).toFixed(1)) : 0;
      const { xp: attendanceXp } = calculateTeamXP(teamMembers.length, presentCount);

      // إضافة النقاط اليدوية غير المتعلقة بالحضور (مثل المسابقات والتحديات)
      const manualTxs = (this.data.transactions || []).filter(tx => tx.targetId === team.id && !tx.reason.includes("تسجيل حضور"));
      const manualPoints = manualTxs.reduce((sum, tx) => sum + tx.points, 0);

      const finalTeamPoints = attendanceXp + manualPoints;

      return {
        ...team,
        points: Math.max(0, finalTeamPoints),
        rank: 0,
        membersCount: teamMembers.length,
        presentMembersCount: presentCount,
        attendanceRate: attendanceRate,
        attendanceXpBonus: attendanceXp,
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
    const newTeam: CustomTeam = {
      id,
      name: teamData.name.trim(),
      icon: teamData.icon?.trim() || "🏆",
      color: teamData.color || "#3B82F6",
      slogan: teamData.slogan?.trim() || "",
      description: teamData.description?.trim() || "",
      points: teamData.initialPoints || 0,
      leaderName: teamData.leaderName?.trim() || "",
      avatarUrl: (teamData as any).avatarUrl?.trim() || "",
    };
    this.data.teams.push(newTeam);

    if (executor) {
      this.logAudit({
        // ... audit log params ...
        userId: executor.id,
        userName: executor.name,
        userRole: executor.role,
        action: "edit_team",
        targetType: "team",
        targetId: newTeam.id,
        targetName: newTeam.name,
        details: `إنشاء فريق جديد: ${newTeam.name}`,
        status: "success",
      });
    }

    await setDoc(doc(db, "teams", id), newTeam);
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
      });
      return { success: false, error: "غير مصرح لك بتعديل بيانات الفرق" };
    }

    const idx = this.data.teams.findIndex((t) => t.id === teamId);
    if (idx !== -1) {
      const oldName = this.data.teams[idx].name;
      this.data.teams[idx] = { ...this.data.teams[idx], ...updates };

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
        });
      }

      try {
        await setDoc(doc(db, "teams", teamId), updates, { merge: true });
      } catch (e) {
        console.warn("Could not save team updates to Firestore:", e);
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
      });
      return { success: false, error: "غير مصرح لك بحذف الفرق" };
    }

    const team = this.data.teams.find((t) => t.id === teamId);
    if (!team) return { success: false, error: "الفريق غير موجود" };

    this.data.teams = this.data.teams.filter((t) => t.id !== teamId);
    this.data.members = this.data.members.filter((m) => m.teamId !== teamId);

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
      });
    }

    const batch = writeBatch(db);
    batch.delete(doc(db, "teams", teamId));
    this.data.members.filter(m => m.teamId === teamId).forEach(m => {
      batch.delete(doc(db, "members", m.id));
    });
    await batch.commit();
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

    await setDoc(doc(db, "members", id), newMember, { merge: true });
    this.data.members.push(newMember);
    this.saveMembersToStorage(this.data.members);

    if (memberData.initialPoints && memberData.initialPoints > 0) {
      const team = this.data.teams.find((t) => t.id === memberData.teamId);
      if (team) {
        await updateDoc(doc(db, "teams", team.id), { points: team.points + memberData.initialPoints });
      }
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

      try {
        await setDoc(doc(db, "members", memberId), updates, { merge: true });
      } catch (e) {
        console.warn("Could not set member in Firestore:", e);
      }
      this.saveMembersToStorage(this.data.members);
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

    await updateDoc(doc(db, "members", memberId), {
      role: mem.role,
      roleLabel: mem.roleLabel,
      accessCode: mem.accessCode,
      permissions: mem.permissions
    });
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
      executorId: executor?.id || "admin",
      executorName: executor?.name || "المسؤول المختص",
      executorRole: executor?.role || "admin",
    };

    this.data.transactions = [tx, ...this.data.transactions.slice(0, 499)];

    const batch = writeBatch(db);
    batch.set(doc(db, "transactions", tx.id), tx);

    if (targetType === "team") {
      const team = this.data.teams.find((t) => t.id === targetId);
      if (team) {
        batch.update(doc(db, "teams", team.id), { points: team.points });
      }
      // مزامنة نقاط أعضاء الفريق في قاعدة البيانات
      const teamMembers = this.data.members.filter((m) => m.teamId === targetId);
      if (teamMembers.length > 0 && pointsPerMember !== 0) {
        teamMembers.forEach((mem) => {
          batch.update(doc(db, "members", mem.id), { points: mem.points });
        });
      }
      this.saveMembersToStorage(this.data.members);
    } else {
      const member = this.data.members.find((m) => m.id === targetId);
      if (member) {
        batch.update(doc(db, "members", member.id), { points: member.points });
        const team = this.data.teams.find((t) => t.id === member.teamId);
        if (team) {
          batch.update(doc(db, "teams", team.id), { points: team.points });
        }
      }
      this.saveMembersToStorage(this.data.members);
    }

    this.logAudit({
      userId: executor?.id || "admin",
      userName: executor?.name || "المسؤول المختص",
      userRole: executor?.role || "admin",
      action: "award_points",
      targetType,
      targetId,
      targetName,
      details: targetType === "team" && distributedMembersCount > 0
        ? `رصد ${points > 0 ? "+" : ""}${points} XP لفريق ${targetName} وتم تقسيمها بالتساوي (${pointsPerMember > 0 ? "+" : ""}${pointsPerMember} XP لكل عضو من الـ ${distributedMembersCount} أعضاء): ${reason}`
        : `رصد ${points > 0 ? "+" : ""}${points} XP [${category || "عام"}] لـ ${targetName}: ${reason}`,
      status: "success",
    });

    await batch.commit();
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
      date: eventData.date || new Date().toISOString().slice(0, 10),
      description: eventData.description?.trim() || "",
      qrCode,
      attendancePoints: eventData.attendancePoints ?? 30,
      startTime: eventData.startTime,
      punctualityBonusPoints: eventData.punctualityBonusPoints ?? 15,
      isActive: true,
      createdAt: new Date().toISOString(),
      createdBy: executor.name,
    };

    if (!this.data.events) this.data.events = [];
    this.data.events.unshift(newEvent);

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
      });
    }

    await setDoc(doc(db, "events", newEvent.id), newEvent);
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

    // 1.5 Enhanced QR Scan Time Validation & Configurable Opening/Closing Windows
    const config = this.data.config;
    const isAdminOrPriest = executor.role === "admin" || executor.role === "priest";

    if (config.isQrScanManuallyLocked && !isAdminOrPriest) {
      this.logAudit({
        userId: executor.id,
        userName: executor.name,
        userRole: executor.role,
        action: "security_block",
        targetType: "member",
        targetId: memberId,
        targetName: memberId,
        details: "محاولة مسح QR بينما النظام مقفل يدوياً من الإدارة",
        status: "denied",
      });
      return { success: false, error: "تم إغلاق نظام مسح الـ QR يدوياً من الإدارة العامة." };
    }

    if (!config.isQrScanManuallyOpened && !isAdminOrPriest) {
      const now = new Date();
      const currentDay = now.getDay(); // 5 is Friday
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTimeMinutes = currentHour * 60 + currentMinute;

      const openParts = (config.qrScanOpenTime || "17:00").split(":").map(Number);
      const openMinutes = (openParts[0] || 17) * 60 + (openParts[1] || 0);

      const closeParts = (config.qrScanCloseTime || "19:00").split(":").map(Number);
      const closeMinutes = (closeParts[0] || 19) * 60 + (closeParts[1] || 0);

      if (currentDay !== 5) {
        return { success: false, error: "عذراً، مسح كود الحضور متاح فقط يوم الجمعة موعد الاجتماع الأسبوعي." };
      }
      if (currentTimeMinutes < openMinutes) {
        return { success: false, error: `لم تبدأ فترة تسجيل الحضور بعد. موعد فتح المسح يبدأ في تمام الساعة ${config.qrScanOpenTime || "17:00"}.` };
      }
      if (currentTimeMinutes > closeMinutes) {
        return { success: false, error: `فترة تسجيل الحضور قد انتهت. تم غلق المسح تلقائياً مع حلول ميعاد الاجتماع (الساعة ${config.qrScanCloseTime || "19:00"} مساءً).` };
      }
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

    // 5. Individual Attendance Registration (Points awarded per scan for member and team)
    let pointsAwarded = event.attendancePoints || 30;
    let punctualityStatus = " (تسجيل حضور منتظم)";
    let effectivePunctual = !!isPunctual;

    if (effectivePunctual && event.punctualityBonusPoints) {
      pointsAwarded += event.punctualityBonusPoints;
      punctualityStatus = " (تسجيل حضور مبكر + بونص الالتزام بالموعد ⏰)";
    }

    // Optional Extra Manual Bonus from Servant / Admin
    const extraBonus = Number(manualBonusPoints) || 0;
    if (extraBonus > 0) {
      pointsAwarded += extraBonus;
      punctualityStatus += ` + بونص يدوي (+${extraBonus} XP: ${manualBonusReason?.trim() || "تشجيع وتفوق"})`;
    }

    // Update member points
    member.points = (member.points || 0) + pointsAwarded;
    // Update team points
    if (team) {
      team.points = (team.points || 0) + pointsAwarded;
    }

    // 6. Record Score Transaction
    const reasonText = `تسجيل حضور تلقائي بالـ QR في [${event.title}]${punctualityStatus}`;

    const tx: ScoreTransaction = {
      id: "tx-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      timestamp: new Date().toISOString(),
      targetType: "member",
      targetId: member.id,
      targetName: member.name,
      teamId: member.teamId,
      teamName: teamName,
      points: pointsAwarded,
      reason: reasonText,
      category: "حضور والتزام",
      executorId: executor.id,
      executorName: executor.name,
      executorRole: executor.role,
    };
    this.data.transactions = [tx, ...this.data.transactions.slice(0, 499)];

    // 7. Record Attendance
    const attendanceRecord: AttendanceRecord = {
      id: "att-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      eventId: event.id,
      eventTitle: event.title,
      memberId: member.id,
      memberName: member.name,
      teamId: member.teamId,
      teamName: teamName,
      scannedAt: new Date().toISOString(),
      scannedByUserId: executor.id,
      scannedByUserName: executor.name,
      pointsAwarded,
      isPunctual: effectivePunctual,
    };
    this.data.attendance.unshift(attendanceRecord);

    // 8. Log Audit under Servant / Admin name
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
    });

    const batch = writeBatch(db);
    batch.set(doc(db, "attendance", attendanceRecord.id), attendanceRecord);
    batch.set(doc(db, "transactions", tx.id), tx);
    batch.update(doc(db, "members", member.id), { points: member.points });
    if (team) {
      batch.update(doc(db, "teams", team.id), { points: team.points });
    }
    await batch.commit();
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
          if (team) {
            team.points = Math.max(0, (team.points || 0) + delta);
            batch.update(doc(db, "teams", team.id), { points: team.points });
          }
          batch.update(doc(db, "attendance", existing.id), existing);
          batch.update(doc(db, "members", member.id), { points: member.points });
          await batch.commit();
          this.triggerAutoSync();
        }
        return { success: true, record: existing };
      }

      let pointsAwarded = event.attendancePoints || 30;
      if (isPunctual && event.punctualityBonusPoints) {
        pointsAwarded += event.punctualityBonusPoints;
      }

      member.points = (member.points || 0) + pointsAwarded;
      if (team) {
        team.points = (team.points || 0) + pointsAwarded;
        batch.update(doc(db, "teams", team.id), { points: team.points });
      }

      const tx: ScoreTransaction = {
        id: "tx-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        timestamp: new Date().toISOString(),
        targetType: "member",
        targetId: member.id,
        targetName: member.name,
        teamId: member.teamId,
        teamName: teamName,
        points: pointsAwarded,
        reason: `تسجيل حضور: ${event.title}${isPunctual ? " (في الموعد)" : ""}`,
        category: "حضور والتزام",
        executorId: executor.id,
        executorName: executor.name,
        executorRole: executor.role,
      };
      this.data.transactions = [tx, ...this.data.transactions.slice(0, 499)];

      const record: AttendanceRecord = {
        id: "att-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        eventId: event.id,
        eventTitle: event.title,
        memberId: member.id,
        memberName: member.name,
        teamId: member.teamId,
        teamName: teamName,
        scannedAt: new Date().toISOString(),
        scannedByUserId: executor.id,
        scannedByUserName: executor.name,
        pointsAwarded,
        isPunctual,
      };
      this.data.attendance.unshift(record);

      batch.set(doc(db, "attendance", record.id), record);
      batch.set(doc(db, "transactions", tx.id), tx);
      batch.update(doc(db, "members", member.id), { points: member.points });

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
      });

      await batch.commit();
      this.triggerAutoSync();
      return { success: true, record };
    } else {
      if (existingIndex !== -1) {
        const existing = this.data.attendance[existingIndex];
        const pts = existing.pointsAwarded || 0;
        member.points = Math.max(0, (member.points || 0) - pts);
        if (team) {
          team.points = Math.max(0, (team.points || 0) - pts);
          batch.update(doc(db, "teams", team.id), { points: team.points });
        }
        batch.delete(doc(db, "attendance", existing.id));
        batch.update(doc(db, "members", member.id), { points: member.points });

        this.data.attendance.splice(existingIndex, 1);

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
        });

        await batch.commit();
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

    const batch = writeBatch(db);
    batch.delete(doc(db, "transactions", transactionId));

    if (tx.targetType === "team") {
      const team = this.data.teams.find((t) => t.id === tx.targetId);
      if (team) {
        team.points = Math.max(0, team.points - tx.points);
        batch.update(doc(db, "teams", team.id), { points: team.points });
      }
      const teamMembers = this.data.members.filter((m) => m.teamId === tx.targetId);
      if (teamMembers.length > 0) {
        const pointsPerMember = tx.points >= 0
          ? Math.max(tx.points > 0 ? 1 : 0, Math.round(tx.points / teamMembers.length))
          : Math.min(tx.points < 0 ? -1 : 0, -Math.round(Math.abs(tx.points) / teamMembers.length));

        if (pointsPerMember !== 0) {
          teamMembers.forEach((mem) => {
            mem.points = Math.max(0, (mem.points || 0) - pointsPerMember);
            batch.update(doc(db, "members", mem.id), { points: mem.points });
          });
        }
        this.saveMembersToStorage(this.data.members);
      }
    } else {
      const member = this.data.members.find((m) => m.id === tx.targetId);
      if (member) {
        member.points = Math.max(0, member.points - tx.points);
        batch.update(doc(db, "members", member.id), { points: member.points });
      }
      const team = this.data.teams.find((t) => t.id === tx.teamId);
      if (team) {
        team.points = Math.max(0, team.points - tx.points);
        batch.update(doc(db, "teams", team.id), { points: team.points });
      }
      this.saveMembersToStorage(this.data.members);
    }

    this.data.transactions = this.data.transactions.filter((t) => t.id !== transactionId);
    await batch.commit();
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
    const batch = writeBatch(db);
    this.data.teams.forEach(t => batch.update(doc(db, "teams", t.id), { points: 0 }));
    this.data.members.forEach(m => batch.update(doc(db, "members", m.id), { points: 0 }));
    (this.data.transactions || []).forEach(tx => batch.delete(doc(db, "transactions", tx.id)));
    (this.data.attendance || []).forEach(att => batch.delete(doc(db, "attendance", att.id)));
    this.data.transactions = [];
    this.data.attendance = [];
    await batch.commit();
    this.notify();
    this.triggerAutoSync();
  }

  async resetToDefaults(): Promise<void> {
    const batch = writeBatch(db);
    
    // 1. Reset Config
    batch.set(doc(db, "config", "meeting"), DEFAULT_CONFIG);
    
    // 2. Clear and Reset Teams
    this.data.teams.forEach(t => batch.delete(doc(db, "teams", t.id)));
    DEFAULT_TEAMS.forEach(t => batch.set(doc(db, "teams", t.id), t));
    
    // 3. Clear and Reset Members
    this.data.members.forEach(m => batch.delete(doc(db, "members", m.id)));
    DEFAULT_MEMBERS.forEach(m => batch.set(doc(db, "members", m.id), m));
    
    // 4. Clear Transactions and Attendance
    this.data.transactions.forEach(tx => batch.delete(doc(db, "transactions", tx.id)));
    await batch.commit();
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

    const ensureTeam = (teamName: string) => {
      let team = this.data.teams.find(t => t.name.includes(teamName) || teamName.includes(t.name));
      if (!team) {
        const newTeamId = `team-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
        team = {
          id: newTeamId,
          name: teamName,
          icon: "🛡️",
          color: "#3B82F6",
          slogan: "فريق كنسي مبارك",
          leaderName: "خادم المسؤول",
          points: 0,
          previousRank: 0,
          avatarUrl: "https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=400&auto=format&fit=crop&q=80"
        };
        this.data.teams.push(team);
        batch.set(doc(db, "teams", team.id), team);
      }
      return team;
    };

    const manualBonuses = [
      { teamName: "تاريخ الكنيسة والأبائيات", points: 50, reason: "رصد بونص ونقاط نشاط", executor: "أبونا افرايم رياض" },
      { teamName: "الطقس والعقيدة", points: 100, reason: "رصد بونص ونقاط نشاط", executor: "أبونا افرايم رياض" },
      { teamName: "الكتاب المقدس", points: 100, reason: "رصد بونص ونقاط نشاط", executor: "أبونا افرايم رياض" },
    ];

    manualBonuses.forEach(b => {
      const team = ensureTeam(b.teamName);
      team.points = (team.points || 0) + b.points;
      batch.update(doc(db, "teams", team.id), { points: team.points });

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
        executorName: b.executor,
        executorRole: "admin"
      };
      this.data.transactions.unshift(tx);
      batch.set(doc(db, "transactions", tx.id), tx);
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

    attendeesList.forEach(att => {
      const team = ensureTeam(att.team);
      let member = this.data.members.find(m => m.name.trim() === att.name.trim());
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
          permissions: getRoleDefaultPermissions("member")
        };
        this.data.members.push(member);
        batch.set(doc(db, "members", member.id), member);
      }

      const pointsAwarded = 37;
      member.points = (member.points || 0) + pointsAwarded;
      batch.update(doc(db, "members", member.id), { points: member.points });

      team.points = (team.points || 0) + pointsAwarded;
      batch.update(doc(db, "teams", team.id), { points: team.points });

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
        executorName: att.scannedBy,
        executorRole: "leader"
      };
      this.data.transactions.unshift(tx);
      batch.set(doc(db, "transactions", tx.id), tx);

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
        isPunctual: true
      };
      if (!this.data.attendance) this.data.attendance = [];
      this.data.attendance.unshift(attRecord);
      batch.set(doc(db, "attendance", attRecord.id), attRecord);

      addedCount++;
    });

    await batch.commit();
    this.notify();
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
