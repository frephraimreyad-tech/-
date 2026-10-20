import type {
  ActivityReason,
  AttendanceRecord,
  AuditLogEntry,
  CustomMember,
  CustomTeam,
  EventSession,
  MeetingConfig,
  MeetingData,
  MemberPermissions,
  ProcessedMeetingTeam,
  RoleType,
  ScoreTransaction,
} from "../types";
import { type SystemUser, SUPER_ADMIN_USER, getRoleDefaultPermissions } from "./authStore";
import { db } from "./firebase";
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
  meetingName: "اجتماع الشباب والجامعيين",
  subTitle: "دوري التحديات والأنشطة الأسبوعي",
  churchName: "كنيسة القديس مارمرقس الرسول",
  seasonName: "موسم صيف وخريف ٢٠٢٦",
  enableSounds: true,
  autoIdleSeconds: 50,
};

const DEFAULT_TEAMS: CustomTeam[] = [
  {
    id: "team-1",
    name: "فريق مارمرقس الرسول",
    icon: "🦁",
    color: "#EAB308",
    slogan: "كاروز الديار المصرية وبشير الإنجيل",
    description: "فريق الكرازة والخدمة وروح العمل الواحد",
    points: 1250,
    leaderName: "مينا عادل",
  },
  {
    id: "team-2",
    name: "فريق أمير الشهداء مارجرجس",
    icon: "⚔️",
    color: "#EF4444",
    slogan: "البطل الروماني صانع المعجزات",
    description: "فريق الشجاعة والإقدام والتحدي الروحي",
    points: 1180,
    leaderName: "بيتر سمير",
  },
  {
    id: "team-3",
    name: "فريق القديس أثناسيوس الرسولي",
    icon: "📜",
    color: "#3B82F6",
    slogan: "حامي الإيمان القويم والعقيدة",
    description: "فريق دراسة كلمة الله والمسابقات الكتابية",
    points: 1040,
    leaderName: "مارينا هاني",
  },
  {
    id: "team-4",
    name: "فريق الشهيد أبانوب النهيسي",
    icon: "🕊️",
    color: "#10B981",
    slogan: "القلب النقي الطاهر المحب للمسيح",
    description: "فريق البساطة والحب الأخوي والشركة",
    points: 980,
    leaderName: "كيرلس ماجد",
  },
  {
    id: "team-5",
    name: "فريق القديس أنطونيوس الكبير",
    icon: "⭐",
    color: "#8B5CF6",
    slogan: "أبو الرهبان وكوكب البرية الشرقية",
    description: "فريق الصلاة وحفظ المزامير والهدوء",
    points: 890,
    leaderName: "سارة رفعت",
  },
  {
    id: "team-6",
    name: "فريق الشهيدة دميانة والأربعين عذراء",
    icon: "👑",
    color: "#EC4899",
    slogan: "الثبات والإكليل السماوي المضيء",
    description: "فريق الأنشطة الإبداعية والكورال والمسرح",
    points: 840,
    leaderName: "يوستينا وجدي",
  },
];

export const DEFAULT_MEMBERS: CustomMember[] = [
  // Team 1
  {
    id: "m-101",
    name: "مينا عادل فخري",
    teamId: "team-1",
    role: "leader",
    roleLabel: "قائد الفريق",
    points: 340,
    phone: "01200000001",
    accessCode: "1010",
    permissions: getRoleDefaultPermissions("leader"),
  },
  {
    id: "m-102",
    name: "فادي سامي نبيل",
    teamId: "team-1",
    role: "member",
    roleLabel: "مشارك",
    points: 280,
    accessCode: "1020",
    permissions: getRoleDefaultPermissions("member"),
  },
  {
    id: "m-103",
    name: "مريم عصام نجيب",
    teamId: "team-1",
    role: "member",
    roleLabel: "مشارك",
    points: 310,
    accessCode: "1030",
    permissions: getRoleDefaultPermissions("member"),
  },
  {
    id: "m-104",
    name: "جورج رفعت بطرس",
    teamId: "team-1",
    role: "servant",
    roleLabel: "خادم رفيق",
    points: 320,
    accessCode: "1040",
    permissions: getRoleDefaultPermissions("servant"),
  },

  // Team 2
  {
    id: "m-201",
    name: "بيتر سمير جرجس",
    teamId: "team-2",
    role: "leader",
    roleLabel: "قائد الفريق",
    points: 350,
    accessCode: "2010",
    permissions: getRoleDefaultPermissions("leader"),
  },
  {
    id: "m-202",
    name: "أندرو منير كمال",
    teamId: "team-2",
    role: "member",
    roleLabel: "مشارك",
    points: 290,
    accessCode: "2020",
    permissions: getRoleDefaultPermissions("member"),
  },
  {
    id: "m-203",
    name: "مارتينا إيهاب شحاتة",
    teamId: "team-2",
    role: "member",
    roleLabel: "مشارك",
    points: 270,
    accessCode: "2030",
    permissions: getRoleDefaultPermissions("member"),
  },
  {
    id: "m-204",
    name: "بولا نبيل زكي",
    teamId: "team-2",
    role: "member",
    roleLabel: "مشارك",
    points: 270,
    accessCode: "2040",
    permissions: getRoleDefaultPermissions("member"),
  },

  // Team 3
  {
    id: "m-301",
    name: "مارينا هاني فؤاد",
    teamId: "team-3",
    role: "leader",
    roleLabel: "قائدة الفريق",
    points: 320,
    accessCode: "3010",
    permissions: getRoleDefaultPermissions("leader"),
  },
  {
    id: "m-302",
    name: "توماس عاطف رشدي",
    teamId: "team-3",
    role: "member",
    roleLabel: "مشارك",
    points: 240,
    accessCode: "3020",
    permissions: getRoleDefaultPermissions("member"),
  },
  {
    id: "m-303",
    name: "كريستين وجيه فهيم",
    teamId: "team-3",
    role: "member",
    roleLabel: "مشارك",
    points: 260,
    accessCode: "3030",
    permissions: getRoleDefaultPermissions("member"),
  },
  {
    id: "m-304",
    name: "ديفيد صبحي مراد",
    teamId: "team-3",
    role: "member",
    roleLabel: "مشارك",
    points: 220,
    accessCode: "3040",
    permissions: getRoleDefaultPermissions("member"),
  },

  // Team 4
  {
    id: "m-401",
    name: "كيرلس ماجد فايق",
    teamId: "team-4",
    role: "leader",
    roleLabel: "قائد الفريق",
    points: 300,
    accessCode: "4010",
    permissions: getRoleDefaultPermissions("leader"),
  },
  {
    id: "m-402",
    name: "ساندرا نبيل شكري",
    teamId: "team-4",
    role: "member",
    roleLabel: "مشارك",
    points: 240,
    accessCode: "4020",
    permissions: getRoleDefaultPermissions("member"),
  },
  {
    id: "m-403",
    name: "مينا هاني فريد",
    teamId: "team-4",
    role: "member",
    roleLabel: "مشارك",
    points: 230,
    accessCode: "4030",
    permissions: getRoleDefaultPermissions("member"),
  },
  {
    id: "m-404",
    name: "ستيفن كمال عزيز",
    teamId: "team-4",
    role: "member",
    roleLabel: "مشارك",
    points: 210,
    accessCode: "4040",
    permissions: getRoleDefaultPermissions("member"),
  },

  // Team 5
  {
    id: "m-501",
    name: "سارة رفعت كامل",
    teamId: "team-5",
    role: "leader",
    roleLabel: "قائدة الفريق",
    points: 280,
    accessCode: "5010",
    permissions: getRoleDefaultPermissions("leader"),
  },
  {
    id: "m-502",
    name: "رامي سمير مسعود",
    teamId: "team-5",
    role: "member",
    roleLabel: "مشارك",
    points: 210,
    accessCode: "5020",
    permissions: getRoleDefaultPermissions("member"),
  },
  {
    id: "m-503",
    name: "إيريني سمير فرج",
    teamId: "team-5",
    role: "member",
    roleLabel: "مشارك",
    points: 200,
    accessCode: "5030",
    permissions: getRoleDefaultPermissions("member"),
  },
  {
    id: "m-504",
    name: "مارك ممدوح صليب",
    teamId: "team-5",
    role: "member",
    roleLabel: "مشارك",
    points: 200,
    accessCode: "5040",
    permissions: getRoleDefaultPermissions("member"),
  },

  // Team 6
  {
    id: "m-601",
    name: "يوستينا وجدي صادق",
    teamId: "team-6",
    role: "leader",
    roleLabel: "قائدة الفريق",
    points: 260,
    accessCode: "6010",
    permissions: getRoleDefaultPermissions("leader"),
  },
  {
    id: "m-602",
    name: "جون أشرف زكي",
    teamId: "team-6",
    role: "member",
    roleLabel: "مشارك",
    points: 200,
    accessCode: "6020",
    permissions: getRoleDefaultPermissions("member"),
  },
  {
    id: "m-603",
    name: "ماريز عماد شفيق",
    teamId: "team-6",
    role: "member",
    roleLabel: "مشارك",
    points: 190,
    accessCode: "6030",
    permissions: getRoleDefaultPermissions("member"),
  },
  {
    id: "m-604",
    name: "أنطونيوس أمجد سعد",
    teamId: "team-6",
    role: "member",
    roleLabel: "مشارك",
    points: 190,
    accessCode: "6040",
    permissions: getRoleDefaultPermissions("member"),
  },
];

export const DEFAULT_EVENTS: EventSession[] = [
  {
    id: "evt-01",
    title: "لقاء الجمعة الروحي والدراسي - إنجيل يوحنا",
    date: new Date().toISOString().slice(0, 10),
    description: "حضور اللقاء العام والتسبيح ودراسة الكلمة المقدسة والأنشطة المشتركة",
    qrCode: "EVT-FRIDAY-JOHN-2026",
    attendancePoints: 30,
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

  constructor() {
    this.data = this.getFallbackData();
    this.initFirestore();
  }

  private getFallbackData(): MeetingData {
    return {
      config: DEFAULT_CONFIG,
      teams: DEFAULT_TEAMS,
      members: DEFAULT_MEMBERS,
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

    // Listen to Config
    onSnapshot(doc(db, "settings", "meeting"), (docSnap) => {
      if (docSnap.exists()) {
        const remoteConfig = docSnap.data() as MeetingConfig;
        this.data.config = { ...DEFAULT_CONFIG, ...remoteConfig };
        this.notify();
      } else {
        setDoc(doc(db, "settings", "meeting"), DEFAULT_CONFIG);
      }
    });

    // Listen to Teams
    onSnapshot(collection(db, "teams"), (querySnap) => {
      const teams: CustomTeam[] = [];
      querySnap.forEach((doc) => {
        teams.push({ ...doc.data(), id: doc.id } as CustomTeam);
      });
      if (teams.length > 0) {
        this.data.teams = teams;
        this.notify();
      } else if (!this.initialized) {
        // Seed if first time and empty
        DEFAULT_TEAMS.forEach(team => {
          setDoc(doc(db, "teams", team.id), team);
        });
      }
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
          permissions: { ...defaults, ...(m.permissions || {}) }
        } as CustomMember);
      });
      if (members.length > 0) {
        this.data.members = members;
        this.notify();
      } else if (!this.initialized) {
        DEFAULT_MEMBERS.forEach(member => {
          setDoc(doc(db, "members", member.id), member);
        });
      }
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

    this.initialized = true;
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

  getConfig(): MeetingConfig {
    return this.data.config;
  }

  updateConfig(updates: Partial<MeetingConfig>): void {
    this.data.config = { ...this.data.config, ...updates };
    updateDoc(doc(db, "settings", "meeting"), updates);
  }

  // --- Audit Log Logging ---
  logAudit(entry: Omit<AuditLogEntry, "id" | "timestamp">): AuditLogEntry {
    const id = "aud-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const newEntry: AuditLogEntry = {
      id,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    this.data.auditLogs = [newEntry, ...this.data.auditLogs.slice(0, 499)];
    setDoc(doc(db, "auditLogs", id), newEntry);
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
      const leadersCount = teamMembers.filter((m) => m.role === "leader").length;

      return {
        ...team,
        rank: 0,
        membersCount: teamMembers.length,
        leadersCount,
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
  addTeam(
    teamData: {
      name: string;
      icon?: string;
      color?: string;
      slogan?: string;
      description?: string;
      leaderName?: string;
      initialPoints?: number;
    },
    executor?: SystemUser
  ): { success: boolean; team?: CustomTeam; error?: string } {
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

    setDoc(doc(db, "teams", id), newTeam);
    return { success: true, team: newTeam };
  }

  updateTeam(
    teamId: string,
    updates: Partial<CustomTeam>,
    executor?: SystemUser
  ): { success: boolean; error?: string } {
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

      updateDoc(doc(db, "teams", teamId), updates);
      return { success: true };
    }
    return { success: false, error: "الفريق غير موجود" };
  }

  deleteTeam(teamId: string, executor?: SystemUser): { success: boolean; error?: string } {
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
    batch.commit();
    return { success: true };
  }

  // --- Member Operations ---
  addMember(
    memberData: {
      name: string;
      nameEn?: string;
      teamId: string;
      role?: RoleType;
      roleLabel?: string;
      phone?: string;
      notes?: string;
      initialPoints?: number;
      accessCode?: string;
      permissions?: Partial<MemberPermissions>;
    },
    executor?: SystemUser
  ): { success: boolean; member?: CustomMember; error?: string } {
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
      nameEn: memberData.nameEn?.trim(),
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
      phone: memberData.phone?.trim(),
      notes: memberData.notes?.trim(),
      accessCode,
      permissions: {
        ...defaults,
        ...(memberData.permissions || {}),
      },
    };

    setDoc(doc(db, "members", id), newMember);

    if (memberData.initialPoints && memberData.initialPoints > 0) {
      const team = this.data.teams.find((t) => t.id === memberData.teamId);
      if (team) {
        updateDoc(doc(db, "teams", team.id), { points: team.points + memberData.initialPoints });
      }
    }

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

  updateMember(
    memberId: string,
    updates: Partial<CustomMember>,
    executor?: SystemUser
  ): { success: boolean; error?: string } {
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

      updateDoc(doc(db, "members", memberId), updates);
      return { success: true };
    }
    return { success: false, error: "العضو غير موجود" };
  }

  deleteMember(memberId: string, executor?: SystemUser): { success: boolean; error?: string } {
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

    deleteDoc(doc(db, "members", memberId));
    return { success: true };
  }

  // --- Permissions Management ---
  updateMemberPermissions(
    memberId: string,
    params: {
      role?: RoleType;
      roleLabel?: string;
      accessCode?: string;
      permissions: Partial<MemberPermissions>;
    },
    executor: SystemUser
  ): { success: boolean; error?: string } {
    if (executor.role !== "admin" && !executor.permissions.canManagePermissions) {
      this.logAudit({
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

    this.logAudit({
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

    updateDoc(doc(db, "members", memberId), {
      role: mem.role,
      roleLabel: mem.roleLabel,
      accessCode: mem.accessCode,
      permissions: mem.permissions
    });
    return { success: true };
  }

  // --- Strict Backend-Enforced Points Awarding ---
  awardPoints(
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
  ): ScoreTransaction | null {
    const { targetType, targetId, points, reason, category, timestamp, notes } = params;
    if (points === 0) return null;

    // Backend Security Verification
    if (executor && !executor.permissions.canAwardPoints && executor.role !== "admin") {
      this.logAudit({
        userId: executor.id,
        userName: executor.name,
        userRole: executor.role,
        action: "security_block",
        targetType,
        targetId,
        targetName: targetId,
        details: `محاولة غير مصرح بها لرصد نقاط (${points > 0 ? "+" : ""}${points} XP) لـ ${targetId}. تم الرفض أمنياً.`,
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
      notes: notes || undefined,
      executorId: executor?.id || "admin",
      executorName: executor?.name || "المسؤول المختص",
      executorRole: executor?.role || "admin",
    };

    const batch = writeBatch(db);
    batch.set(doc(db, "transactions", tx.id), tx);

    if (targetType === "team") {
      const team = this.data.teams.find((t) => t.id === targetId);
      if (team) {
        batch.update(doc(db, "teams", team.id), { points: Math.max(0, team.points + points) });
      }
    } else {
      const member = this.data.members.find((m) => m.id === targetId);
      if (member) {
        batch.update(doc(db, "members", member.id), { points: Math.max(0, member.points + points) });
        const team = this.data.teams.find((t) => t.id === member.teamId);
        if (team) {
          batch.update(doc(db, "teams", team.id), { points: Math.max(0, team.points + points) });
        }
      }
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

    batch.commit();
    return tx;
  }

  // --- Events and QR Code Management ---
  getEvents(): EventSession[] {
    return this.data.events || [];
  }

  createEvent(
    eventData: {
      title: string;
      description?: string;
      attendancePoints?: number;
      punctualityBonusPoints?: number;
      qrCode?: string;
    },
    executor: SystemUser
  ): { success: boolean; event?: EventSession; error?: string } {
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
      date: new Date().toISOString().slice(0, 10),
      description: eventData.description?.trim() || "",
      qrCode,
      attendancePoints: eventData.attendancePoints ?? 30,
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

    setDoc(doc(db, "events", newEvent.id), newEvent);
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
  recordQRAttendance(params: {
    eventIdOrCode: string;
    memberId: string;
    isPunctual?: boolean;
    executor: SystemUser;
  }): {
    success: boolean;
    record?: AttendanceRecord;
    error?: string;
    pointsAwarded?: number;
    member?: CustomMember;
    event?: EventSession;
  } {
    const { eventIdOrCode, memberId, isPunctual, executor } = params;

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

    // 2. Find Event by ID or QR Code
    const event = this.data.events.find(
      (e) =>
        e.id === eventIdOrCode ||
        e.qrCode.toLowerCase() === eventIdOrCode.trim().toLowerCase()
    );
    if (!event) {
      return { success: false, error: "رمز الفعالية غير صالح أو الفعالية غير موجودة" };
    }

    if (!event.isActive) {
      return { success: false, error: "هذه الفعالية غير نشطة حالياً ولا تقبل تسجيل الحضور" };
    }

    // 3. Find Member
    const member = this.data.members.find((m) => m.id === memberId);
    if (!member) {
      return { success: false, error: "العضو المحدد غير موجود في قاعدة البيانات" };
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

    // 5. Automatic Points Calculation
    let pointsAwarded = event.attendancePoints;
    if (isPunctual && event.punctualityBonusPoints > 0) {
      pointsAwarded += event.punctualityBonusPoints;
    }

    // Update member points
    member.points += pointsAwarded;
    // Update team points
    if (team) {
      team.points += pointsAwarded;
    }

    // 6. Record Score Transaction
    const reasonText = `تسجيل حضور تلقائي بالـ QR في [${event.title}]${
      isPunctual ? " (مع بونص الالتزام المبكر)" : ""
    }`;

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
      isPunctual: !!isPunctual,
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
    batch.commit();

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

  clearTeamTransactions(teamId: string): void {
    const txsToDelete = this.data.transactions.filter(
      (tx) => tx.teamId === teamId || (tx.targetType === "team" && tx.targetId === teamId)
    );
    const batch = writeBatch(db);
    txsToDelete.forEach(tx => batch.delete(doc(db, "transactions", tx.id)));
    batch.commit();
  }

  clearAllTransactions(): void {
    const batch = writeBatch(db);
    this.data.transactions.forEach(tx => batch.delete(doc(db, "transactions", tx.id)));
    batch.commit();
  }

  undoTransaction(transactionId: string): boolean {
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

    batch.commit();
    return true;
  }

  // --- Activity Reasons Operations ---
  getActivityReasons(): ActivityReason[] {
    return this.data.activityReasons || DEFAULT_ACTIVITY_REASONS;
  }

  addActivityReason(reasonData: {
    text: string;
    category?: string;
    points?: number;
    icon?: string;
  }): ActivityReason {
    const id = "ar-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const newReason: ActivityReason = {
      id,
      text: reasonData.text.trim(),
      category: reasonData.category?.trim() || "نشاط وتحدي",
      points: typeof reasonData.points === "number" ? reasonData.points : 30,
      icon: reasonData.icon || "🎯",
    };
    if (!this.data.activityReasons) {
      this.data.activityReasons = [...DEFAULT_ACTIVITY_REASONS];
    }
    setDoc(doc(db, "activityReasons", id), newReason);
    return newReason;
  }

  updateActivityReason(id: string, updates: Partial<ActivityReason>): void {
    if (!this.data.activityReasons) {
      this.data.activityReasons = [...DEFAULT_ACTIVITY_REASONS];
    }
    const idx = this.data.activityReasons.findIndex((r) => r.id === id);
    if (idx !== -1) {
      this.data.activityReasons[idx] = {
        ...this.data.activityReasons[idx],
        ...updates,
      };
      updateDoc(doc(db, "activityReasons", id), updates);
    }
  }

  deleteActivityReason(id: string): void {
    if (!this.data.activityReasons) {
      this.data.activityReasons = [...DEFAULT_ACTIVITY_REASONS];
    }
    deleteDoc(doc(db, "activityReasons", id));
  }

  resetActivityReasonsToDefault(): void {
    const batch = writeBatch(db);
    // Delete existing
    this.data.activityReasons.forEach(r => batch.delete(doc(db, "activityReasons", r.id)));
    // Add default
    DEFAULT_ACTIVITY_REASONS.forEach(r => batch.set(doc(db, "activityReasons", r.id), r));
    batch.commit();
  }

  resetScoresOnly(): void {
    const batch = writeBatch(db);
    this.data.teams.forEach(t => batch.update(doc(db, "teams", t.id), { points: 0 }));
    this.data.members.forEach(m => batch.update(doc(db, "members", m.id), { points: 0 }));
    this.data.transactions.forEach(tx => batch.delete(doc(db, "transactions", tx.id)));
    batch.commit();
  }

  resetToDefaults(): void {
    // This would require a very large batch, but for now we'll just reset config
    setDoc(doc(db, "settings", "meeting"), DEFAULT_CONFIG);
  }

  exportDataJson(): string {
    return JSON.stringify(this.data, null, 2);
  }

  importDataJson(jsonStr: string): boolean {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed?.teams && Array.isArray(parsed.teams)) {
        const batch = writeBatch(db);
        // This is simplified, real import would be more thorough
        setDoc(doc(db, "settings", "meeting"), parsed.config);
        parsed.teams.forEach((t: any) => batch.set(doc(db, "teams", t.id), t));
        batch.commit();
        return true;
      }
    } catch (e) {
      console.error("Failed to parse imported json:", e);
    }
    return false;
  }
}

export const meetingStore = new MeetingStore();
