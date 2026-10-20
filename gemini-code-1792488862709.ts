import { SystemUser, authStore } from "./authStore";

export interface CustomTeam {
  id: string;
  name: string;
  icon: string;
  color: string;
  slogan?: string;
  leaderName?: string;
  points: number;
}

export interface CustomMember {
  id: string;
  name: string;
  teamId: string;
  role: "member" | "leader" | "servant" | "admin";
  roleLabel?: string;
  phone?: string;
  points: number;
  accessCode?: string;
  permissions?: {
    canAwardPoints: boolean;
    canScanAttendance: boolean;
    canEditTeams: boolean;
    canEditMembers: boolean;
    canCreateEvents: boolean;
    canManagePermissions: boolean;
  };
}

export interface ScoreTransaction {
  id: string;
  targetType: "team" | "member";
  targetId: string;
  targetName: string;
  teamId?: string;
  teamName: string;
  points: number;
  reason: string;
  category: string;
  timestamp: string;
  notes?: string;
}

export interface ActivityReason {
  id: string;
  text: string;
  category: string;
  points: number;
  icon: string;
}

export interface EventSession {
  id: string;
  title: string;
  description: string;
  attendancePoints: number;
  punctualityBonusPoints: number;
  qrCode: string;
  isActive: boolean;
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  eventId: string;
  eventTitle: string;
  memberId: string;
  memberName: string;
  teamId: string;
  teamName: string;
  scannedAt: string;
  pointsAwarded: number;
  scannedByUserId: string;
  scannedByUserName: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  targetName: string;
  details: string;
  status: "success" | "denied";
}

export interface MeetingData {
  config: {
    meetingName: string;
    churchName: string;
    seasonName: string;
    subTitle: string;
  };
  teams: CustomTeam[];
  members: CustomMember[];
  transactions: ScoreTransaction[];
  activityReasons: ActivityReason[];
  events: EventSession[];
  attendance: AttendanceRecord[];
  auditLogs: AuditLogEntry[];
  lastSaved: string;
}

const STORAGE_KEY = "coptic_youth_meeting_scoreboard_v3";

const DEFAULT_DATA: MeetingData = {
  config: {
    meetingName: "اجتماع الشباب والخدمة",
    churchName: "الكنيسة القبطية الأرثوذكسية",
    seasonName: "موسم النهضة الروحية ٢٠٢٦",
    subTitle: "لوحة الشرف الكبرى والتنافس الروحي",
  },
  teams: [
    { id: "team-1", name: "فريق مارمرقس", icon: "🦁", color: "#EAB308", slogan: "كاروز الديار المصرية", leaderName: "أنطونيوس إدوار", points: 1250 },
    { id: "team-2", name: "فريق أثناسيوس", icon: "⚔️", color: "#3B82F6", slogan: "حامي الإيمان المستقيم", leaderName: "مينا شهيد", points: 1120 },
    { id: "team-3", name: "فريق الأنبا شنودة", icon: "📜", color: "#10B981", slogan: "رئيس المتوحدين", leaderName: "د. مينا ماهر", points: 980 },
  ],
  members: [
    { id: "mem-1", name: "أبونا افرايم رياض", teamId: "team-1", role: "admin", roleLabel: "مدير النظام", points: 150, accessCode: "7777", permissions: { canAwardPoints: true, canScanAttendance: true, canEditTeams: true, canEditMembers: true, canCreateEvents: true, canManagePermissions: true } },
    { id: "mem-2", name: "مينا شهيد", teamId: "team-2", role: "leader", roleLabel: "قائد المجموعة", points: 100, accessCode: "1234", permissions: { canAwardPoints: false, canScanAttendance: true, canEditTeams: false, canEditMembers: false, canCreateEvents: false, canManagePermissions: false } },
  ],
  transactions: [],
  activityReasons: [
    { id: "r-1", text: "الحضور المبكر والالتزام", category: "حضور والتزام", points: 30, icon: "⏰" },
    { id: "r-2", text: "مسابقة دراسة الكتاب المقدس", category: "مسابقة روحية", points: 50, icon: "📖" },
    { id: "r-3", text: "المشاركة الفعالة في الأنشطة", category: "نشاط وتحدي", points: 40, icon: "🎯" },
  ],
  events: [
    { id: "evt-1", title: "اجتماع الجمعة الأسبوعي", description: "التسجيل ومتابعة الحضور", attendancePoints: 30, punctualityBonusPoints: 15, qrCode: "MEETING-FRIDAY-2026", isActive: true, createdAt: new Date().toISOString() }
  ],
  attendance: [],
  auditLogs: [],
  lastSaved: new Date().toISOString(),
};

class MeetingStoreService {
  private data: MeetingData;
  private listeners: (() => void)[] = [];

  constructor() {
    this.data = this.loadFromStorage();
  }

  private loadFromStorage(): MeetingData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_DATA, ...parsed };
      }
    } catch (e) {
      console.error("Error loading from localStorage", e);
    }
    return DEFAULT_DATA;
  }

  private saveToStorage() {
    try {
      this.data.lastSaved = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      this.notifyListeners();
    } catch (e) {
      console.error("Error saving to localStorage", e);
    }
  }

  private notifyListeners() {
    this.listeners.forEach((l) => l());
  }

  public subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public getData(): MeetingData {
    return this.data;
  }

  public awardPoints(tx: Omit<ScoreTransaction, "id" | "teamName" | "targetName">, user: SystemUser): ScoreTransaction | null {
    // Check permission
    if (!user.permissions.canAwardPoints && user.role !== "admin") {
      this.logAudit(user, "security_block", tx.targetName, "محاولة رصد نقاط بدون صلاحية", "denied");
      return null;
    }

    let targetName = "";
    let teamId = tx.teamId;
    let teamName = "";

    if (tx.targetType === "team") {
      const team = this.data.teams.find((t) => t.id === tx.targetId);
      if (!team) return null;
      team.points += tx.points;
      targetName = team.name;
      teamId = team.id;
      teamName = team.name;
    } else {
      const member = this.data.members.find((m) => m.id === tx.targetId);
      if (!member) return null;
      member.points += tx.points;
      targetName = member.name;
      const team = this.data.teams.find((t) => t.id === member.teamId);
      if (team) {
        team.points += tx.points;
        teamId = team.id;
        teamName = team.name;
      }
    }

    const fullTx: ScoreTransaction = {
      ...tx,
      id: "tx-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      targetName,
      teamId,
      teamName: teamName || "عام",
      timestamp: tx.timestamp || new Date().toISOString(),
    };

    this.data.transactions.unshift(fullTx);
    this.logAudit(user, "award_points", targetName, `رصد ${tx.points} XP بسبب: ${tx.reason}`, "success");
    this.saveToStorage();
    return fullTx;
  }

  private logAudit(user: SystemUser, action: string, targetName: string, details: string, status: "success" | "denied") {
    const entry: AuditLogEntry = {
      id: "audit-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      timestamp: new Date().toISOString(),
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action,
      targetName,
      details,
      status,
    };
    this.data.auditLogs = this.data.auditLogs || [];
    this.data.auditLogs.unshift(entry);
  }

  public exportDataJson(): string {
    return JSON.stringify(this.data, null, 2);
  }

  public importDataJson(jsonStr: string): boolean {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed && parsed.teams && parsed.members) {
        this.data = { ...DEFAULT_DATA, ...parsed };
        this.saveToStorage();
        return true;
      }
    } catch (e) {
      console.error("Invalid JSON import", e);
    }
    return false;
  }
}

export const meetingStore = new MeetingStoreService();