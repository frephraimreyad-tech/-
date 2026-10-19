export type RoleType = "member" | "leader" | "servant" | "priest" | "admin";

export interface MemberPermissions {
  canAwardPoints: boolean; // إضافة وتعديل النقاط يدويًا (مقصورة على المسؤولين)
  canEditTeams: boolean; // تعديل وإضافة وحذف الفرق
  canEditMembers: boolean; // تعديل وإضافة وحذف الأعضاء
  canManagePermissions: boolean; // إدارة الصلاحيات وأكواد الدخول
  canCreateEvents: boolean; // إنشاء وتعديل فعاليات الحضور وتوليد QR
  canScanAttendance: boolean; // مسح QR لتسجيل حضور الفعالية
  canExportData: boolean; // تصدير التقارير وسجلات النشاط
  canClearLogs: boolean; // مسح السجلات وتصفير النقاط
}

export interface CustomMember {
  id: string;
  name: string;
  nameEn?: string;
  teamId: string;
  role: RoleType;
  roleLabel?: string;
  points: number;
  phone?: string;
  notes?: string;
  avatarUrl?: string;
  accessCode: string; // كود وصول فريد لكل عضو
  permissions?: Partial<MemberPermissions>;
}

export interface CustomTeam {
  id: string;
  name: string;
  icon: string;
  color: string;
  slogan?: string;
  description?: string;
  points: number;
  leaderName?: string;
}

export interface ScoreTransaction {
  id: string;
  timestamp: string; // ISO string timestamp
  targetType: "team" | "member";
  targetId: string;
  targetName: string;
  teamId: string;
  teamName: string;
  points: number; // positive or negative
  reason: string;
  category?: string;
  notes?: string;
  customDate?: string;
  executorId?: string; // كود أو معرف المستخدم المنفذ
  executorName?: string; // اسم المستخدم الذي قام بالرصد
  executorRole?: string; // دور المستخدم المنفذ
}

export interface ActivityReason {
  id: string;
  text: string;
  category: string;
  points: number;
  icon?: string;
}

export interface EventSession {
  id: string;
  title: string;
  date: string; // e.g. "2026-10-19"
  description?: string;
  qrCode: string; // كود مميز مشفر في QR
  attendancePoints: number; // نقاط الحضور التلقائية
  punctualityBonusPoints: number; // نقاط الالتزام في الموعد
  isActive: boolean;
  createdAt: string;
  createdBy: string;
}

export interface AttendanceRecord {
  id: string;
  eventId: string;
  eventTitle: string;
  memberId: string;
  memberName: string;
  teamId: string;
  teamName: string;
  scannedAt: string; // توقيت التسجيل
  scannedByUserId: string;
  scannedByUserName: string;
  pointsAwarded: number;
  isPunctual?: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: string;
  action:
    | "award_points"
    | "attendance_scan"
    | "edit_member"
    | "edit_team"
    | "delete_team"
    | "create_event"
    | "permission_change"
    | "security_block";
  targetType: "team" | "member" | "event" | "system";
  targetId: string;
  targetName: string;
  details: string;
  status: "success" | "denied";
}

export interface MeetingConfig {
  meetingName: string;
  subTitle: string;
  churchName: string;
  seasonName: string;
  enableSounds: boolean;
  autoIdleSeconds: number;
}

export interface MeetingData {
  config: MeetingConfig;
  teams: CustomTeam[];
  members: CustomMember[];
  transactions: ScoreTransaction[];
  activityReasons: ActivityReason[];
  events: EventSession[];
  attendance: AttendanceRecord[];
  auditLogs: AuditLogEntry[];
}

export interface ProcessedMeetingTeam extends CustomTeam {
  rank: number;
  membersCount: number;
  leadersCount: number;
  members: CustomMember[];
  isTied: boolean;
}

export interface LedgerItem {
  id: string;
  reason: string;
  source: string;
  points: number;
  pillar: string;
  created_at: string;
}

export interface ParticipantScoreDetail {
  total_points: number;
  verified_sessions: number;
  pillars: {
    spiritual: number;
    psychological: number;
    technological: number;
    creative: number;
    general: number;
  };
  recent_ledger: LedgerItem[];
}
