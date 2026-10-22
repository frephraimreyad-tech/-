import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import type { CustomMember, MemberPermissions, RoleType } from "../types";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');

export interface SystemUser {
  id: string;
  name: string;
  role: RoleType;
  roleLabel: string;
  teamId?: string;
  teamName?: string;
  accessCode: string;
  permissions: MemberPermissions;
  email?: string;
  avatarUrl?: string;
  points?: number;
}

export const SUPER_ADMIN_USER: SystemUser = {
  id: "mem-1",
  name: "أبونا افرايم رياض",
  role: "admin",
  roleLabel: "مدير النظام",
  accessCode: "7777",
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

export const PUBLIC_MAKHDOUUM_USER: SystemUser = {
  id: "guest-public",
  name: "زائر (مخدوم)",
  role: "member",
  roleLabel: "عرض عام للمخدومين",
  accessCode: "",
  permissions: {
    canAwardPoints: false,
    canEditTeams: false,
    canEditMembers: false,
    canManagePermissions: false,
    canCreateEvents: false,
    canScanAttendance: false,
    canExportData: false,
    canClearLogs: false,
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
        canAwardPoints: false,
        canEditTeams: false,
        canEditMembers: false,
        canManagePermissions: false,
        canCreateEvents: false,
        canScanAttendance: true,
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
  private currentUser: SystemUser = PUBLIC_MAKHDOUUM_USER;
  private googleUser: User | null = null;
  private accessToken: string | null = null;
  private listeners: Array<() => void> = [];
  private isSigningIn = false;
  private readonly TOKEN_KEY = "google_access_token";

  constructor() {
    this.accessToken = sessionStorage.getItem(this.TOKEN_KEY);
    this.loadSession();
    this.initFirebaseObserver();
  }

  private initFirebaseObserver() {
    onAuthStateChanged(auth, async (user) => {
      this.googleUser = user;
      if (!user) {
        this.accessToken = null;
      }
      this.notify();
    });
  }

  private loadSession() {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id && parsed.role) {
          this.currentUser = parsed;
          return;
        }
      }
    } catch {}
    this.currentUser = PUBLIC_MAKHDOUUM_USER;
  }

  getCurrentUser(): SystemUser {
    return this.currentUser;
  }

  getGoogleUser(): User | null {
    return this.googleUser;
  }

  async getAccessToken(): Promise<string | null> {
    return this.accessToken;
  }

  hasAccessToken(): boolean {
    return !!this.accessToken && !!this.googleUser;
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

  async loginWithGoogle(): Promise<{ success: boolean; error?: string }> {
    try {
      this.isSigningIn = true;
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        throw new Error('Failed to get access token');
      }
      this.accessToken = credential.accessToken;
      if (this.accessToken) {
        sessionStorage.setItem(this.TOKEN_KEY, this.accessToken);
      }
      
      this.notify();
      return { success: true };
    } catch (error: any) {
      console.error('Google login error:', error);
      return { success: false, error: error.message };
    } finally {
      this.isSigningIn = false;
    }
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

    if (cleanCode === SUPER_ADMIN_USER.accessCode || cleanCode.toUpperCase() === "ADMIN") {
      this.setCurrentUser(SUPER_ADMIN_USER);
      return { success: true, user: SUPER_ADMIN_USER };
    }

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
        avatarUrl: member.avatarUrl,
        points: member.points,
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

  async logout() {
    await auth.signOut();
    this.accessToken = null;
    sessionStorage.removeItem(this.TOKEN_KEY);
    this.setCurrentUser(PUBLIC_MAKHDOUUM_USER);
  }
}

export const authStore = new AuthStore();
