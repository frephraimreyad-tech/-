import type { CustomMember, MemberPermissions, RoleType } from "../types";

export interface SystemUser {
  id: string;
  name: string;
  role: RoleType;
  roleLabel: string;
  teamId?: string;
  teamName?: string;
  accessCode: string;
  permissions: MemberPermissions;
}

export const SUPER_ADMIN_USER: SystemUser = {
  id: "super-admin-01",
  name: "الخادم المسؤول (مدير النظام)",
  role: "admin",
  roleLabel: "مدير النظام",
  accessCode: "9999",
  permissions: {
    canAwardPoints: true,
    canEditTeams: true,
    canEditMembers: true,
    canManagePermissions: true,
    canCreateEvents: true,
    canScanAttendance: true,
    canExportData: true,
    canClearLogs: true,
  },
};

export function getRoleDefaultPermissions(role: RoleType): MemberPermissions {
  switch (role) {
    case "admin":
      return {
        canAwardPoints: true,
        canEditTeams: true,
        canEditMembers: true,
        canManagePermissions: true,
        canCreateEvents: true,
        canScanAttendance: true,
        canExportData: true,
        canClearLogs: true,
      };
    case "leader":
      return {
        canAwardPoints: false, // مٌقيد تماماً عن رصد النقاط اليدوية
        canEditTeams: false, // مٌقيد عن تعديل بيانات الفرق
        canEditMembers: false, // مٌقيد عن تعديل بيانات الأعضاء
        canManagePermissions: false,
        canCreateEvents: false,
        canScanAttendance: true, // مسموح له فقط بمسح QR لتسجيل حضور أعضاء مجموعته
        canExportData: true,
        canClearLogs: false,
      };
    case "servant":
      return {
        canAwardPoints: false,
        canEditTeams: false,
        canEditMembers: false,
        canManagePermissions: false,
        canCreateEvents: false,
        canScanAttendance: true,
        canExportData: false,
        canClearLogs: false,
      };
    case "priest":
      return {
        canAwardPoints: true,
        canEditTeams: true,
        canEditMembers: true,
        canManagePermissions: true,
        canCreateEvents: true,
        canScanAttendance: true,
        canExportData: true,
        canClearLogs: false,
      };
    case "member":
    default:
      return {
        canAwardPoints: false,
        canEditTeams: false,
        canEditMembers: false,
        canManagePermissions: false,
        canCreateEvents: false,
        canScanAttendance: false,
        canExportData: false,
        canClearLogs: false,
      };
  }
}

const AUTH_STORAGE_KEY = "meeting_active_auth_user_v2";

class AuthStore {
  private currentUser: SystemUser = SUPER_ADMIN_USER;
  private listeners: Array<() => void> = [];

  constructor() {
    this.loadSession();
  }

  private loadSession() {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id && parsed.role) {
          this.currentUser = parsed;
        }
      }
    } catch {
      this.currentUser = SUPER_ADMIN_USER;
    }
  }

  getCurrentUser(): SystemUser {
    return this.currentUser;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  setCurrentUser(user: SystemUser) {
    this.currentUser = user;
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } catch {}
    this.notify();
  }

  loginWithCode(
    code: string,
    allMembers: CustomMember[],
    allTeams: { id: string; name: string }[]
  ): { success: boolean; user?: SystemUser; error?: string } {
    const cleanCode = code.trim();
    if (!cleanCode) {
      return { success: false, error: "برجاء إدخال كود المرور" };
    }

    // 1. Check Super Admin
    if (cleanCode === SUPER_ADMIN_USER.accessCode || cleanCode.toUpperCase() === "ADMIN") {
      this.setCurrentUser(SUPER_ADMIN_USER);
      return { success: true, user: SUPER_ADMIN_USER };
    }

    // 2. Search in Members
    const member = allMembers.find(
      (m) =>
        m.accessCode === cleanCode ||
        (m.id && m.id.toLowerCase() === cleanCode.toLowerCase())
    );

    if (member) {
      const team = allTeams.find((t) => t.id === member.teamId);
      const defaults = getRoleDefaultPermissions(member.role);
      const userPermissions: MemberPermissions = {
        ...defaults,
        ...(member.permissions || {}),
      };

      const systemUser: SystemUser = {
        id: member.id,
        name: member.name,
        role: member.role,
        roleLabel: member.roleLabel || (member.role === "leader" ? "قائد المجموعة" : "عضو"),
        teamId: member.teamId,
        teamName: team?.name || "",
        accessCode: member.accessCode,
        permissions: userPermissions,
      };

      this.setCurrentUser(systemUser);
      return { success: true, user: systemUser };
    }

    return {
      success: false,
      error: "كود غير صحيح، تأكد من كود الوصول المخصص لك من المسؤول",
    };
  }

  hasPermission(permKey: keyof MemberPermissions): boolean {
    if (this.currentUser.role === "admin") return true;
    return !!this.currentUser.permissions[permKey];
  }

  logout() {
    this.setCurrentUser(SUPER_ADMIN_USER);
  }
}

export const authStore = new AuthStore();
