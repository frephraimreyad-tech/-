export const PILLAR_LABELS: Record<string, string> = {
  fellowship: "المحبة والشركة",
  prayer: "الصلاة والحياة الروحية",
  ideas: "الأفكار والإبداع",
  work: "العمل والتقنية",
  spiritual: "الركن الروحي ✝",
  technological: "الركن التكنولوجي 💻",
  psychological: "الركن النفسي 🧠",
  creative: "الركن الإبداعي 🎨",
  general: "ركن تيتراجون العام 🌟",
};

export const COPTIC_NAMES: Record<string, string> = {
  AGAPI: "ⲁⲅⲁⲡⲏ • AGAPI",
  NAHTI: "ⲛⲁϩϯ • NAHTI",
  HELPIS: "ϩⲉⲗⲡⲓⲥ • HELPIS",
  HIRINI: "ϩⲓⲣⲏⲛⲏ • HIRINI",
  RASHI: "ⲣⲁϣⲓ • RASHI",
  METREMRAUSH: "ⲙⲉⲧⲣⲉⲙⲣⲁⲩϣ • METREMRAUSH",
  SOPHIA: "ⲥⲟⲫⲓⲁ • SOPHIA",
  HMOT: "ϩⲙⲟⲧ • HMOT",
  METHAPLOUS: "ⲙⲉⲧϩⲁⲡⲗⲟⲩⲥ • METHAPLOUS",
  METSANHIT: "ⲙⲉⲧⲥⲁⲛϩⲏⲧ • METSANHIT",
};

export const TEAM_ICONS: Record<string, string> = {
  AGAPI: "❤️",
  NAHTI: "🛡️",
  HELPIS: "⚓",
  HIRINI: "🕊️",
  RASHI: "✨",
  METREMRAUSH: "🌿",
  SOPHIA: "📖",
  HMOT: "⭐",
  METHAPLOUS: "🤍",
  METSANHIT: "⏳",
};

export const CONFETTI_COLORS = [
  "#F5B21A",
  "#FCD34D",
  "#3B82F6",
  "#60A5FA",
  "#8C5BB8",
  "#C084FC",
  "#EF4444",
  "#10B981",
  "#FFFFFF",
];

export function extractInitials(displayNameAr: string, displayNameEn?: string): { ar: string; en: string } {
  const cleanAr = (displayNameAr || "")
    .replace(/^(القمص|القس|أبونا|خادم|خادمة|د\.|م\.)\s+/, "")
    .trim();
  const partsAr = cleanAr.split(/\s+/).filter(Boolean);
  const ar = partsAr.length >= 2 
    ? (partsAr[0][0] || "") + (partsAr[1][0] || "")
    : (partsAr[0] ? partsAr[0].slice(0, 2) : "تيتراجون");

  const cleanEn = (displayNameEn || "")
    .replace(/^(Fr\.|Rev\.|Father|Eng\.|Dr\.)\s+/, "")
    .trim();
  const partsEn = cleanEn.split(/\s+/).filter(Boolean);
  const en = partsEn.length >= 2 
    ? (partsEn[0][0] || "") + (partsEn[1][0] || "")
    : (partsEn[0] ? partsEn[0].slice(0, 2) : "TT");

  return { ar, en: en.toUpperCase() };
}

export function isPriestCheck(displayNameAr?: string, displayNameEn?: string, role?: string): boolean {
  if (role === "priest") return true;
  const r = (displayNameAr || "").trim();
  const l = (displayNameEn || "").trim();
  return (
    r.startsWith("القمص") ||
    r.startsWith("القس") ||
    r.startsWith("أبونا") ||
    l.startsWith("Fr.") ||
    l.startsWith("Rev.") ||
    l.startsWith("Hegumen")
  );
}

export function formatCairoDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("ar-EG", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Africa/Cairo",
    });
  } catch {
    return dateStr;
  }
}
