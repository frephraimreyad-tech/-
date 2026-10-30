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
} from "../types";
import { type SystemUser, SUPER_ADMIN_USER, getRoleDefaultPermissions, authStore } from "./authStore";
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
};

export const DEFAULT_TEAMS: CustomTeam[] = [
  { id: "team-1", name: "فريق مارمرقس", icon: "🦁", color: "#EAB308", slogan: "كاروز الديار المصرية", leaderName: "أنطونيوس إدوار", points: 1250, previousRank: 2, avatarUrl: "https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=400&auto=format&fit=crop&q=80" },
  { id: "team-2", name: "فريق أثناسيوس", icon: "⚔️", color: "#3B82F6", slogan: "حامي الإيمان المستقيم", leaderName: "مينا شهيد", points: 1120, previousRank: 1, avatarUrl: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=400&auto=format&fit=crop&q=80" },
  { id: "team-3", name: "فريق الأنبا شنودة", icon: "📜", color: "#10B981", slogan: "رئيس المتوحدين", leaderName: "د. مينا ماهر", points: 980, previousRank: 3, avatarUrl: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&auto=format&fit=crop&q=80" },
  { id: "team-4", name: "فريق أمير الشهداء مارجرجس", icon: "🛡️", color: "#EF4444", slogan: "سريع الندهة والبطل المغوار", leaderName: "بيشوي عاطف", points: 940, previousRank: 5, avatarUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&auto=format&fit=crop&q=80" },
  { id: "team-5", name: "فريق الأنبا بيشوي", icon: "🕊️", color: "#06B6D4", slogan: "الرجل الكامل وحبيب مخلصنا الصالح", leaderName: "فادي سامح", points: 890, previousRank: 4, avatarUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&auto=format&fit=crop&q=80" },
  { id: "team-6", name: "فريق الأمير تادرس", icon: "🏹", color: "#8B5CF6", slogan: "قائد جند المسيح الأمين", leaderName: "كيرلس مجدي", points: 830, previousRank: 6, avatarUrl: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&auto=format&fit=crop&q=80" },
  { id: "team-7", name: "فريق البابا كيرلس", icon: "⛵", color: "#EC4899", slogan: "كن مطمئناً جداً جداً", leaderName: "مارك رأفت", points: 790, previousRank: 8, avatarUrl: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=400&auto=format&fit=crop&q=80" },
  { id: "team-8", name: "فريق الشهيد أبي سيفين", icon: "👑", color: "#F97316", slogan: "حامل السيفين الغالب بقوة الصليب", leaderName: "يوسف مجدي", points: 750, previousRank: 7, avatarUrl: "/assets/aistudio/_______________________55ad5e73.png" },
  { id: "team-9", name: "فريق الأنبا أنطونيوس", icon: "🔥", color: "#6366F1", slogan: "أب جميع الرهبان وكوكب البرية", leaderName: "مينا عادل", points: 710, previousRank: 10, avatarUrl: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&auto=format&fit=crop&q=80" },
  { id: "team-10", name: "فريق القديسة دميانة", icon: "🌟", color: "#14B8A6", slogan: "عفيفة وقوية مع الأربعين عذراء", leaderName: "مارينا سامي", points: 680, previousRank: 9, avatarUrl: "https://images.unsplash.com/photo-1500485035595-cbe6f645feb1?w=400&auto=format&fit=crop&q=80" },
];

export const DEFAULT_MEMBERS: CustomMember[] = [
  { id: "mem-1", name: "أبونا افرايم رياض", teamId: "team-1", role: "admin", roleLabel: "مدير النظام", points: 150, accessCode: "7777", permissions: getRoleDefaultPermissions("admin") },
  { id: "mem-2", name: "مينا شهيد", teamId: "team-2", role: "leader", roleLabel: "قائد المجموعة", points: 100, accessCode: "1234", permissions: getRoleDefaultPermissions("leader") },
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

const DEFAULT_TRANSACTIONS: ScoreTransaction[] = [
  {
    id: "tx-1",
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    targetType: "team",
    targetId: "team-1",
    targetName: "فريق مارمرقس الرسول",
    teamId: "team-1",
    teamName: "فريق مارمرقس الرسول",
    points: 100,
    reason: "الفوز بالمركز الأول في مسابقة الإنجيل الأسبوعية",
    category: "مسابقة روحية",
    executorId: "super-admin-01",
    executorName: "الخادم المسؤول",
    executorRole: "admin",
  },
  {
    id: "tx-2",
    timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
    targetType: "team",
    targetId: "team-2",
    targetName: "فريق أمير الشهداء مارجرجس",
    teamId: "team-2",
    teamName: "فريق أمير الشهداء مارجرجس",
    points: 80,
    reason: "تسجيل حضور جماعي ومبكر لأعضاء الفريق",
    category: "حضور والتزام",
    executorId: "super-admin-01",
    executorName: "الخادم المسؤول",
    executorRole: "admin",
  },
];

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
      lastSaved: new Date().toISOString(),
    };
  }

  private async initFirestore() {
    if (typeof window === "undefined") return;

    console.log("Initializing Firestore listeners...");

    // 1. Check if database needs seeding (once)
    try {
      const configDoc = await getDocs(query(collection(db, "config"), limit(1)));
      if (configDoc.empty) {
        console.log("Database empty, seeding defaults...");
        await this.seedDatabase();
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
    await updateDoc(doc(db, "config", "meeting"), updates);
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

      return {
        ...team,
        rank: 0,
        membersCount: teamMembers.length,
        leadersCount,
        servantsCount,
        makhdoumeenCount,
        members: teamMembers,
        isTied: false,
      };
    });

    list.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
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

      await updateDoc(doc(db, "teams", teamId), updates);
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

    if (targetType === "team") {
      const team = this.data.teams.find((t) => t.id === targetId);
      if (!team) return null;
      team.points = Math.max(0, team.points + points);
      targetName = team.name;
      teamId = team.id;
      teamName = team.name;
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
      notes: notes || "",
      executorId: executor?.id || "admin",
      executorName: executor?.name || "المسؤول المختص",
      executorRole: executor?.role || "admin",
    };

    const batch = writeBatch(db);
    batch.set(doc(db, "transactions", tx.id), tx);

    if (targetType === "team") {
      const team = this.data.teams.find((t) => t.id === targetId);
      if (team) {
        batch.update(doc(db, "teams", team.id), { points: team.points });
      }
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
      details: `رصد ${points > 0 ? "+" : ""}${points} XP [${category || "عام"}] لـ ${targetName}: ${reason}`,
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

    // 1. Permission check
    if (executor.role !== "admin" && !executor.permissions.canScanAttendance) {
      this.logAudit({
        userId: executor.id,
        userName: executor.name,
        userRole: executor.role,
        action: "security_block",
        targetType: "member",
        targetId: memberId,
        targetName: memberId,
        details: "محاولة مسح QR للحضور دون امتلاك صلاحية المسح",
        status: "denied",
      });
      return { success: false, error: "غير مصرح لك بمسح QR لتسجيل الحضور" };
    }

    // 2. Find Event by ID or QR Code (Clean & Case-insensitive)
    const cleanEventId = (eventIdOrCode || "").trim().toLowerCase();
    const event = this.data.events.find(
      (e) =>
        e.id.toLowerCase() === cleanEventId ||
        e.qrCode.trim().toLowerCase() === cleanEventId
    );
    if (!event) {
      return { success: false, error: "رمز الفعالية غير صالح أو الفعالية غير موجودة" };
    }

    if (!event.isActive) {
      return { success: false, error: "هذه الفعالية غير نشطة حالياً ولا تقبل تسجيل الحضور" };
    }

    // 3. Find Member (by ID or Access Code or URL)
    let cleanMemberCode = (memberId || "").trim();
    if (cleanMemberCode.includes("?code=") || cleanMemberCode.includes("&code=")) {
      try {
        const urlMatch = cleanMemberCode.match(/[?&]code=([^&#]+)/);
        if (urlMatch && urlMatch[1]) {
          cleanMemberCode = decodeURIComponent(urlMatch[1]).trim();
        }
      } catch {}
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

    // Leader restriction check: if leader, check if member is in their team (optional check, or leader registering for their team)
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
        error: `تم تسجيل حضور العضو (${member.name}) في هذه الفعالية مسبقاً! يمنع النظام تكرار احتساب النقاط مرتين في نفس الفعالية.`,
      };
    }

    // 5. Automatic Points Calculation with Time-Based Punctuality
    let pointsAwarded = event.attendancePoints;
    let punctualityStatus = "";
    let effectivePunctual = !!isPunctual;

    if (event.startTime && event.punctualityBonusPoints > 0) {
      const now = new Date();
      const [startHour, startMin] = event.startTime.split(":").map(Number);
      const eventStartTime = new Date(now);
      eventStartTime.setHours(startHour, startMin, 0, 0);

      const diffMs = now.getTime() - eventStartTime.getTime();
      const diffMins = diffMs / (1000 * 60);

      if (diffMins <= 15) {
        // Full bonus if within first 15 mins (or before start)
        pointsAwarded += event.punctualityBonusPoints;
        punctualityStatus = " (بونص كامل - حضور مبكر)";
        effectivePunctual = true;
      } else {
        // Half bonus after 15 mins
        const halfBonus = Math.floor(event.punctualityBonusPoints / 2);
        pointsAwarded += halfBonus;
        punctualityStatus = ` (نصف بونص - تأخير ${Math.floor(diffMins)} دقيقة)`;
        effectivePunctual = halfBonus > 0;
      }
    } else if (isPunctual && event.punctualityBonusPoints > 0) {
      pointsAwarded += event.punctualityBonusPoints;
      punctualityStatus = " (بونص الالتزام المبكر)";
    }

    // Optional Extra Manual Bonus from Servant / Admin
    const extraBonus = Number(manualBonusPoints) || 0;
    if (extraBonus > 0) {
      pointsAwarded += extraBonus;
      punctualityStatus += ` + بونص يدوي (+${extraBonus} XP: ${manualBonusReason?.trim() || "تشجيع وتفوق"})`;
    }

    // Update member points
    member.points += pointsAwarded;
    // Update team points
    if (team) {
      team.points += pointsAwarded;
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

    // 8. Log Audit
    if (executor) {
      this.logAudit({
        userId: executor.id,
        userName: executor.name,
        userRole: executor.role,
        action: "attendance_scan",
        targetType: "member",
        targetId: member.id,
        targetName: member.name,
        details: `تسجيل حضور عبر QR للعضو [${member.name}] في فعالية [${event.title}]. احتساب تلقائي: +${pointsAwarded} XP`,
        status: "success",
      });
    }

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
        batch.update(doc(db, "teams", team.id), { points: Math.max(0, team.points - tx.points) });
      }
    } else {
      const member = this.data.members.find((m) => m.id === tx.targetId);
      if (member) {
        batch.update(doc(db, "members", member.id), { points: Math.max(0, member.points - tx.points) });
      }
      const team = this.data.teams.find((t) => t.id === tx.teamId);
      if (team) {
        batch.update(doc(db, "teams", team.id), { points: Math.max(0, team.points - tx.points) });
      }
    }

    await batch.commit();
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
    this.data.transactions.forEach(tx => batch.delete(doc(db, "transactions", tx.id)));
    await batch.commit();
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
