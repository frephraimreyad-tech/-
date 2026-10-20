import { authStore } from "./authStore";

const SPREADSHEET_ID_KEY = "youth_meeting_spreadsheet_id";

export class GoogleSheetsService {
  private static instance: GoogleSheetsService;
  private spreadsheetId: string | null = null;

  private constructor() {
    this.spreadsheetId = localStorage.getItem(SPREADSHEET_ID_KEY);
  }

  public static getInstance(): GoogleSheetsService {
    if (!GoogleSheetsService.instance) {
      GoogleSheetsService.instance = new GoogleSheetsService();
    }
    return GoogleSheetsService.instance;
  }

  public getSpreadsheetId(): string | null {
    return this.spreadsheetId;
  }

  public setSpreadsheetId(id: string) {
    this.spreadsheetId = id;
    localStorage.setItem(SPREADSHEET_ID_KEY, id);
  }

  private async fetchGoogleApi(url: string, options: RequestInit = {}) {
    const token = await authStore.getAccessToken();
    if (!token) {
      throw new Error("لم يتم تسجيل الدخول بحساب جوجل. يرجى تسجيل الدخول أولاً.");
    }

    const headers = {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || "فشل الاتصال بجوجل شيت");
    }
    return response.json();
  }

  /**
   * إنشاء ملف شيت جديد في حساب المستخدم
   */
  public async createMeetingSheet(title: string) {
    const data = await this.fetchGoogleApi("https://sheets.googleapis.com/v4/spreadsheets", {
      method: "POST",
      body: JSON.stringify({
        properties: { title },
        sheets: [
          { properties: { title: "Teams", gridProperties: { frozenRowCount: 1 } } },
          { properties: { title: "Members", gridProperties: { frozenRowCount: 1 } } },
          { properties: { title: "Transactions", gridProperties: { frozenRowCount: 1 } } },
          { properties: { title: "Config", gridProperties: { frozenRowCount: 1 } } },
        ],
      }),
    });

    this.setSpreadsheetId(data.spreadsheetId);
    await this.initializeHeaders(data.spreadsheetId);
    return data.spreadsheetId;
  }

  private async initializeHeaders(id: string) {
    const updates = [
      { range: "Teams!A1:G1", values: [["ID", "Name", "Icon", "Color", "Slogan", "LeaderName", "Points"]] },
      { range: "Members!A1:K1", values: [["ID", "Name", "TeamID", "Role", "RoleLabel", "Points", "AccessCode", "Phone", "Notes", "Permissions", "NameEn"]] },
      { range: "Transactions!A1:L1", values: [["ID", "Timestamp", "TargetType", "TargetID", "TargetName", "TeamID", "TeamName", "Points", "Reason", "Category", "ExecutorName", "ExecutorRole"]] },
      { range: "Config!A1:B1", values: [["Key", "Value"]] },
    ];

    await this.fetchGoogleApi(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({
        valueInputOption: "RAW",
        data: updates,
      }),
    });
  }

  /**
   * قراءة البيانات من الشيت
   */
  public async readSheetData(range: string) {
    if (!this.spreadsheetId) throw new Error("لم يتم تحديد ملف الشيت");
    const data = await this.fetchGoogleApi(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${range}`
    );
    return data.values || [];
  }

  /**
   * تحديث أو إضافة صفوف
   */
  public async updateSheetData(range: string, values: any[][]) {
    if (!this.spreadsheetId) throw new Error("لم يتم تحديد ملف الشيت");
    return await this.fetchGoogleApi(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${range}?valueInputOption=RAW`,
      {
        method: "PUT",
        body: JSON.stringify({ values }),
      }
    );
  }

  /**
   * إضافة صف جديد في نهاية الشيت
   */
  public async appendSheetData(range: string, values: any[][]) {
    if (!this.spreadsheetId) throw new Error("لم يتم تحديد ملف الشيت");
    return await this.fetchGoogleApi(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${range}:append?valueInputOption=RAW`,
      {
        method: "POST",
        body: JSON.stringify({ values }),
      }
    );
  }

  /**
   * مسح بيانات من مدى معين
   */
  public async clearSheetData(range: string) {
    if (!this.spreadsheetId) throw new Error("لم يتم تحديد ملف الشيت");
    return await this.fetchGoogleApi(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${range}:clear`,
      { method: "POST" }
    );
  }
}

export const googleSheets = GoogleSheetsService.getInstance();
