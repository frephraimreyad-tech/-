import React, { useState, useEffect } from "react";
import {
  X,
  Award,
  Sparkles,
  BookOpen,
  Clock,
  Heart,
  Trophy,
  CheckCircle,
  HelpCircle,
  Zap,
  Flame,
  ArrowRight,
  Edit2,
  Plus,
  Trash2,
  RotateCcw,
  Save,
  Check,
} from "lucide-react";
import { sounds } from "../utils/soundEffects";
import { meetingStore } from "../utils/meetingStore";
import type { ActivityReason } from "../types";

export interface BonusGuideModalProps {
  onClose: () => void;
  onSelectReason?: (reason: string, points: number, category: string) => void;
  initialEditMode?: boolean;
}

export interface BonusItem {
  id: string;
  category: "attendance" | "spiritual" | "activities" | "service";
  categoryName: string;
  icon: string;
  title: string;
  points: number;
  description: string;
  howToAward: string;
}

export const DEFAULT_BONUS_ITEMS: BonusItem[] = [
  // 1. الحضور والالتزام
  {
    id: "att-early",
    category: "attendance",
    categoryName: "الحضور والالتزام",
    icon: "⏰",
    title: "حضور مبكر والتزام في الموعد (قبل البدء بـ 15 دقيقة)",
    points: 30,
    description: "بونص يُمنح لكل مخدوم أو فريق يحضر قبل انطلاق موعد الاجتماع الرسمي.",
    howToAward: "يُحسب تلقائياً عند مسح كود QR، أو يدويًا من لوحة التحكم باختيار رصد الحضور المبكر.",
  },
  {
    id: "att-on-time",
    category: "attendance",
    categoryName: "الحضور والالتزام",
    icon: "⏱️",
    title: "حضور في الموعد المحدد بالضبط",
    points: 15,
    description: "نقاط الحضور الأساسية لكل مشارك يتواجد في موعد بدء الاجتماع.",
    howToAward: "تُمنح عبر مسح الـ QR أو باختيار اسم العضو ورصد +15 XP له.",
  },
  {
    id: "att-full-team",
    category: "attendance",
    categoryName: "الحضور والالتزام",
    icon: "👥",
    title: "حضور جماعي كامل لكافة أفراد الفريق",
    points: 50,
    description: "بونص تحفيزي يُمنح للفريق بالكامل عندما تكتمل نسبة حضوره 100%.",
    howToAward: "يتم رصده للفريق مباشرة من لوحة التحكم (+50 XP) بعد مراجعة كشف الحضور.",
  },
  {
    id: "att-month-streak",
    category: "attendance",
    categoryName: "الحضور والالتزام",
    icon: "🔥",
    title: "المواظبة على الحضور لمدة شهر كامل دون غياب",
    points: 40,
    description: "بونص تشجيعي تراكمي للاستمرار والالتزام الروحي طوال أسابيع الشهر.",
    howToAward: "يُرصد في آخر جمعة من كل شهر للعضو الملتزم.",
  },

  // 2. المسابقات الروحية والكتابية
  {
    id: "sp-verse",
    category: "spiritual",
    categoryName: "المسابقات الروحية والكتابية",
    icon: "📖",
    title: "حفظ آية الأسبوع وتسميعها للخادم",
    points: 25,
    description: "تسميع آية اللقاء المقررة أو الشاهد الكتابي بدقة وبدون أخطاء.",
    howToAward: "يقوم الخادم برصد +25 XP فوراً للعضو (أو إضافتها كبونص يدوي أثناء مسح QR).",
  },
  {
    id: "sp-bible",
    category: "spiritual",
    categoryName: "المسابقات الروحية والكتابية",
    icon: "✝️",
    title: "إحضار الكتاب المقدس الورقي والتفاعل به",
    points: 20,
    description: "تشجيع قراءة كلمة الله والبحث في الشواهد الكتابية أثناء العظة.",
    howToAward: "يُرصد بواسطة الخادم عند استقبال المخدوم أو في فقرة دراسة الكتاب.",
  },
  {
    id: "sp-bible-quiz",
    category: "spiritual",
    categoryName: "المسابقات الروحية والكتابية",
    icon: "🏆",
    title: "الفوز بالمركز الأول في مسابقة الإنجيل الأسبوعية",
    points: 50,
    description: "الفوز في مسابقة دراسة الكتاب المقدس والأسئلة التنافسية الكبرى.",
    howToAward: "تُرصد للفريق الفائز أو المشارك المتميز مباشرة بنهاية فقرة المسابقة.",
  },
  {
    id: "sp-fast-question",
    category: "spiritual",
    categoryName: "المسابقات الروحية والكتابية",
    icon: "💡",
    title: "إجابة ذكية وسريعة في السؤال التفاعلي",
    points: 20,
    description: "إجابة صحيحة وفورية أثناء إلقاء كلمة الاجتماع أو الأسئلة السريعة.",
    howToAward: "يرصدها الخادم أو الأدمن فوراً عبر الرصد السريع من الهاتف (+20 XP).",
  },
  {
    id: "sp-chapter-summary",
    category: "spiritual",
    categoryName: "المسابقات الروحية والكتابية",
    icon: "📜",
    title: "تلخيص موضوع الكلمة أو قراءة أصحاح أسبوعي",
    points: 30,
    description: "تقديم ملخص مكتوب أو قراءة أصحاح الإنجيل الأسبوعي المحدد.",
    howToAward: "تُمنح للمشارك عند تسليم كشكول المتابعة أو تقديم التلخيص للخادم.",
  },
  {
    id: "sp-full-chapter",
    category: "spiritual",
    categoryName: "المسابقات الروحية والكتابية",
    icon: "⛪",
    title: "حفظ أصحاح كامل أو مزمور كنسي",
    points: 60,
    description: "تسميع مزمور أو أصحاح كامل (مثل مزمور الراعي أو كورنثوس الأولى 13).",
    howToAward: "تُسجل كبونص تفوق خاص باسم العضو مع إضافة سبب التسميع.",
  },

  // 3. التحديات والأنشطة الجماعية
  {
    id: "act-team-challenge",
    category: "activities",
    categoryName: "الأنشطة الجماعية والتحديات",
    icon: "🎯",
    title: "الفوز في النشاط والتحدي الجماعي الأسبوعي",
    points: 40,
    description: "تحقيق المركز الأول في ألعاب وتحديات التفكير والسرعة الجماعية.",
    howToAward: "تُرصد للفريق الفائز فور إعلان نتيجة التحدي الجماعي.",
  },
  {
    id: "act-sports-first",
    category: "activities",
    categoryName: "الأنشطة الجماعية والتحديات",
    icon: "🏓",
    title: "المركز الأول في دوري تنس اليد / المنافسات الرياضية",
    points: 50,
    description: "الفوز بالمباراة النهائية في دوري تنس اليد أو الألعاب الحركية.",
    howToAward: "يتم رصدها للفريق المتوج بالبطولة أو الفائز في جولة الدوري.",
  },
  {
    id: "act-sports-second",
    category: "activities",
    categoryName: "الأنشطة الجماعية والتحديات",
    icon: "🥈",
    title: "المركز الثاني / الروح الرياضية في الدوري",
    points: 30,
    description: "الوصول للمباراة النهائية أو إظهار أعلى درجات الروح الرياضية.",
    howToAward: "تُرصد كتقدير للأداء العالي والروح التنافسية الراقية.",
  },
  {
    id: "act-talent",
    category: "activities",
    categoryName: "الأنشطة الجماعية والتحديات",
    icon: "✨",
    title: "تقديم فقرة موهبة متميزة (ترنيمة / اسكتش / عزف / إبداع)",
    points: 60,
    description: "مشاركة إبداعية تثري اللقاء وترفع مستوى المشاركة الإيجابية.",
    howToAward: "تُرصد للعضو أو المجموعة المشاركة في تقديم الفقرة فور انتهائها.",
  },

  // 4. الخدمة والمحبة والافتقاد
  {
    id: "srv-new-friend",
    category: "service",
    categoryName: "الخدمة والمحبة والافتقاد",
    icon: "🤝",
    title: "اصطحاب صديق جديد أو مخدوم لأول مرة",
    points: 40,
    description: "تشجيع مخدوم جديد على الحضور والتفاعل والمشاركة في أسرة الاجتماع.",
    howToAward: "يتم رصدها للعضو الذي اصطحب الصديق الجديد في بداية اللقاء.",
  },
  {
    id: "srv-hall-setup",
    category: "service",
    categoryName: "الخدمة والمحبة والافتقاد",
    icon: "🧹",
    title: "المساعدة في ترتيب قاعة الاجتماع وتجهيز المقاعد",
    points: 25,
    description: "مساعدة لجنة النظام والخدمة قبل بدء اللقاء أو بعد انتهائه.",
    howToAward: "يمنحها خادم النظام للمتطوعين النشطاء تقديراً لخدمتهم.",
  },
  {
    id: "srv-choir-hymn",
    category: "service",
    categoryName: "الخدمة والمحبة والافتقاد",
    icon: "🎵",
    title: "حفظ ترنيمة جديدة أو لحن كنسي مع الكورال",
    points: 35,
    description: "الالتزام بتدريبات الكورال وحفظ الترانيم والألحان الكنسية.",
    howToAward: "تُرصد بموافقة مسؤول الكورال أو الألحان بعد التسميع.",
  },
  {
    id: "srv-instant-bonus",
    category: "service",
    categoryName: "الخدمة والمحبة والافتقاد",
    icon: "🌟",
    title: "بونص تشجيعي فوري من الخادم",
    points: 15,
    description: "بونص حر يمنحه الخادم في أي لحظة لتشجيع مبادرة إيجابية أو كلمة طيبة.",
    howToAward: "متاح للخادم والأدمن رصده بمرونة تامة في أي وقت.",
  },
];

const STORAGE_BONUS_GUIDE_KEY = "custom_bonus_guide_rubrics_v3";

export const BonusGuideModal: React.FC<BonusGuideModalProps> = ({
  onClose,
  onSelectReason,
  initialEditMode = false,
}) => {
  const [activeTab, setActiveTab] = useState<"reasons" | "how_to">("reasons");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isEditMode, setIsEditMode] = useState<boolean>(initialEditMode);

  // Dynamic Items loaded from localStorage / meetingStore / default
  const [items, setItems] = useState<BonusItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_BONUS_GUIDE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
    return DEFAULT_BONUS_ITEMS;
  });

  // Edit / Add modal sub-state
  const [showItemEditModal, setShowItemEditModal] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<BonusItem | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formPoints, setFormPoints] = useState<number>(30);
  const [formCategory, setFormCategory] = useState<"attendance" | "spiritual" | "activities" | "service">("spiritual");
  const [formIcon, setFormIcon] = useState("✨");
  const [formDescription, setFormDescription] = useState("");
  const [formHowToAward, setFormHowToAward] = useState("");

  // Persist items
  const saveItemsList = (newList: BonusItem[]) => {
    setItems(newList);
    try {
      localStorage.setItem(STORAGE_BONUS_GUIDE_KEY, JSON.stringify(newList));
    } catch {}
  };

  const handleOpenAdd = () => {
    sounds.playTap();
    setEditingItem(null);
    setFormTitle("");
    setFormPoints(30);
    setFormCategory("spiritual");
    setFormIcon("✨");
    setFormDescription("");
    setFormHowToAward("");
    setShowItemEditModal(true);
  };

  const handleOpenEdit = (item: BonusItem) => {
    sounds.playTap();
    setEditingItem(item);
    setFormTitle(item.title);
    setFormPoints(item.points);
    setFormCategory(item.category);
    setFormIcon(item.icon);
    setFormDescription(item.description);
    setFormHowToAward(item.howToAward);
    setShowItemEditModal(true);
  };

  const handleDeleteItem = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    sounds.playTap();
    if (window.confirm("هل أنت متأكد من حذف هذا النشاط/السبب من دليل النقاط؟")) {
      const updated = items.filter((i) => i.id !== id);
      saveItemsList(updated);
      await meetingStore.deleteActivityReason(id).catch(() => {});
      sounds.playVictory();
    }
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    sounds.playVictory();
    const catNames: Record<string, string> = {
      attendance: "الحضور والالتزام",
      spiritual: "المسابقات الروحية والكتابية",
      activities: "الأنشطة الجماعية والتحديات",
      service: "الخدمة والمحبة والافتقاد",
    };

    if (editingItem) {
      // Update existing
      const updated: BonusItem = {
        ...editingItem,
        title: formTitle.trim(),
        points: Number(formPoints) || 10,
        category: formCategory,
        categoryName: catNames[formCategory] || "عام",
        icon: formIcon.trim() || "🎯",
        description: formDescription.trim() || "نشاط معتمد لرصد البونص.",
        howToAward: formHowToAward.trim() || "يتم رصده للمخدوم أو الفريق مباشرة.",
      };
      const newList = items.map((i) => (i.id === editingItem.id ? updated : i));
      saveItemsList(newList);
      await meetingStore.updateActivityReason(editingItem.id, {
        text: updated.title,
        points: updated.points,
        category: updated.categoryName,
        icon: updated.icon,
        description: updated.description,
        howToAward: updated.howToAward,
      }).catch(() => {});
    } else {
      // Add new
      const newItem: BonusItem = {
        id: "bi-" + Date.now().toString(36),
        title: formTitle.trim(),
        points: Number(formPoints) || 10,
        category: formCategory,
        categoryName: catNames[formCategory] || "عام",
        icon: formIcon.trim() || "🎯",
        description: formDescription.trim() || "نشاط معتمد لرصد البونص.",
        howToAward: formHowToAward.trim() || "يتم رصده للمخدوم أو الفريق مباشرة.",
      };
      const newList = [newItem, ...items];
      saveItemsList(newList);
      await meetingStore.addActivityReason({
        text: newItem.title,
        points: newItem.points,
        category: newItem.categoryName,
        icon: newItem.icon,
        description: newItem.description,
        howToAward: newItem.howToAward,
      }).catch(() => {});
    }

    setShowItemEditModal(false);
  };

  const handleResetDefaults = () => {
    sounds.playTap();
    if (window.confirm("هل تريد استعادة قائمة بنك درجات البونص النموذجية الافتراضية (18 نشاط)؟")) {
      saveItemsList(DEFAULT_BONUS_ITEMS);
      meetingStore.resetActivityReasonsToDefault().catch(() => {});
      sounds.playVictory();
    }
  };

  const filteredItems = selectedCategory === "all"
    ? items
    : items.filter((item) => item.category === selectedCategory);

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fadeIn font-arabic select-none"
      dir="rtl"
    >
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border border-slate-700 bg-[#0B132B] shadow-2xl text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 text-slate-950 font-black shadow-md shadow-amber-500/20 shrink-0">
              <Award className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-white truncate">
                  دليل وبنك درجات البونص المعتمد
                </h3>
                {isEditMode ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-black border border-emerald-500/30 flex items-center gap-1">
                    <Edit2 className="h-3 w-3" /> وضع التعديل مفعّل
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-bold border border-amber-500/30">
                    للقادة والخدام
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 truncate">
                {isEditMode
                  ? "يمكنك تعديل أي نشاط، تغيير مقادير الـ XP، إضافة أسباب جديدة، أو الحذف"
                  : "قائمة الأنشطة الرسمية وتوزيع النقاط المعتمد لأسرة أبي سيفين وتماف إيريني"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Toggle Edit Mode Button */}
            <button
              type="button"
              onClick={() => {
                sounds.playTap();
                setIsEditMode(!isEditMode);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95 ${
                isEditMode
                  ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 border border-emerald-400"
                  : "bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40"
              }`}
            >
              <Edit2 className="h-3.5 w-3.5" />
              <span>{isEditMode ? "✓ إنهاء التعديل" : "تعديل دليل النقاط ✏️"}</span>
            </button>

            <button
              onClick={() => {
                sounds.playClose();
                onClose();
              }}
              className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Top Tabs */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 pt-2 shrink-0 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                sounds.playTap();
                setActiveTab("reasons");
              }}
              className={`pb-2.5 px-4 text-xs font-black border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "reasons"
                  ? "border-amber-400 text-amber-300"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              <Sparkles className="h-4 w-4" />
              <span>بنك الأنشطة والبونص ({items.length} سبب ونشاط)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                sounds.playTap();
                setActiveTab("how_to");
              }}
              className={`pb-2.5 px-4 text-xs font-black border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "how_to"
                  ? "border-amber-400 text-amber-300"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              <HelpCircle className="h-4 w-4" />
              <span>شرح طريقة الرصد للخادم 📋</span>
            </button>
          </div>

          {/* Action buttons when in Edit Mode */}
          {isEditMode && (
            <div className="flex items-center gap-2 pb-2">
              <button
                type="button"
                onClick={handleOpenAdd}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs transition-all cursor-pointer flex items-center gap-1 shadow-md shadow-emerald-500/20 active:scale-95"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>+ إضافة سبب جديد لدليل النقاط</span>
              </button>

              <button
                type="button"
                onClick={handleResetDefaults}
                className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-300 border border-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                title="استعادة القائمة النموذجية الافتراضية"
              >
                <RotateCcw className="h-3 w-3" />
                <span className="hidden sm:inline">استعادة الافتراضي</span>
              </button>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* TAB 1: REASONS LIST */}
          {activeTab === "reasons" && (
            <div className="space-y-4">
              {/* Category Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {[
                  { id: "all", label: "الكل" },
                  { id: "attendance", label: "⏰ الحضور والالتزام" },
                  { id: "spiritual", label: "📖 المسابقات الروحية" },
                  { id: "activities", label: "🎯 الأنشطة والتحديات" },
                  { id: "service", label: "❤️ الخدمة والافتقاد" },
                ].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      sounds.playTap();
                      setSelectedCategory(c.id);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      selectedCategory === c.id
                        ? "bg-amber-500 text-slate-950 font-black shadow-sm"
                        : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              {/* Grid of Reasons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-2xl bg-slate-900/80 border transition-all flex flex-col justify-between gap-2.5 group shadow-sm ${
                      isEditMode
                        ? "border-emerald-500/40 hover:border-emerald-400"
                        : "border-slate-800 hover:border-amber-500/40"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-2xl p-1 bg-slate-950 rounded-xl border border-slate-800 shrink-0">
                            {item.icon}
                          </span>
                          <span className="text-xs sm:text-sm font-bold text-white group-hover:text-amber-300 transition-colors truncate">
                            {item.title}
                          </span>
                        </div>
                        <span className="px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-300 font-black font-mono text-xs border border-amber-500/30 shrink-0 shadow-inner">
                          +{item.points} XP
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed pr-9">
                        {item.description}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-teal-400 font-medium truncate">
                        💡 {item.howToAward}
                      </span>

                      {/* Controls depending on Mode */}
                      {isEditMode ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 border border-slate-700"
                            title="تعديل هذا السبب"
                          >
                            <Edit2 className="h-3 w-3" />
                            <span>تعديل</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteItem(item.id, e)}
                            className="p-1 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-400 text-xs transition-all cursor-pointer border border-rose-800/40"
                            title="حذف هذا السبب"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        onSelectReason && (
                          <button
                            type="button"
                            onClick={() => {
                              sounds.playTap();
                              onSelectReason(item.title, item.points, item.categoryName);
                              onClose();
                            }}
                            className="px-3 py-1 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-black transition-all cursor-pointer flex items-center gap-1 shrink-0 shadow-md shadow-amber-500/10 active:scale-95"
                          >
                            <Zap className="h-3 w-3" />
                            <span>استخدام هذا السبب والرصيد ⚡</span>
                          </button>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: HOW TO AWARD */}
          {activeTab === "how_to" && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="h-7 w-7 rounded-full bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center shrink-0">
                    1
                  </span>
                  <h4 className="text-sm font-black text-white">
                    كيف تعطي بونص يدوي من لوحة التحكم (الرصد المباشر)؟
                  </h4>
                </div>
                <div className="text-xs text-slate-300 leading-relaxed pr-9 space-y-1">
                  <p>• افتح لوحة التحكم الإدارية من زر الإعدادات ⚙️ أعلى الشاشة.</p>
                  <p>• اختر تبويب «تحديث النقاط المباشر ⚡».</p>
                  <p>• حدد جهة الرصد: «فريق كامل 🦁» أو «عضو / مخدوم فردي 👤».</p>
                  <p>• اختر مقدار النقاط المقترح أو اكتب قيمة مخصصة.</p>
                  <p>• اضغط على «اعتماد وتحديث النقاط فوراً» لتطبيق الزيادة وتوثيقها في سجل المعاملات ولائحة الشرف فوراً.</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="h-7 w-7 rounded-full bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center shrink-0">
                    2
                  </span>
                  <h4 className="text-sm font-black text-white">
                    كيف تعطي بونص يدوي مع تسجيل حضور الـ QR؟
                  </h4>
                </div>
                <div className="text-xs text-slate-300 leading-relaxed pr-9 space-y-1">
                  <p>• افتح نافذة مسح الـ QR من الزر الأخضر «مسح QR للحضور 📱».</p>
                  <p>• ستجد بطاقة «إضافة بونص يدوي فوري مع الحضور» مباشرة أعلى أزرار المسح.</p>
                  <p>• انقر على البونص المستحق (مثل: +15 XP حفظ آية، أو +20 XP إحضار إنجيل).</p>
                  <p>• امسح كود العضو؛ وسيتم احتساب نقاط الحضور + البونص التشجيعي معاً في خطوة واحدة!</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="h-7 w-7 rounded-full bg-sky-500 text-slate-950 font-black text-xs flex items-center justify-center shrink-0">
                    3
                  </span>
                  <h4 className="text-sm font-black text-white">
                    قواعد احتساب النقاط التلقائية لضمان الدقة وعدم المضاعفة
                  </h4>
                </div>
                <div className="text-xs text-slate-300 leading-relaxed pr-9 space-y-1.5">
                  <p>
                    • <strong className="text-sky-300">نظام منع المضاعفة الدقيق:</strong> تم ضبط محرك
                    النقاط بحيث تُضاف الدرجة المكتوبة بالضبط (30 تُعطي 30 XP تماماً بدون تكرار).
                  </p>
                  <p>
                    • <strong className="text-emerald-400">تحديث متزامن:</strong> عند إعطاء بونص لعضو
                    فردي، تُضاف النقاط لرصيده الشخصي وتُضاف تلقائياً لنفس فريقه ليرتفع ترتيب الفريق في
                    لوحة الشرف.
                  </p>
                  <p>
                    • <strong className="text-amber-400">سجل المعاملات الموثق:</strong> كل نقطة يتم
                    رصدها يتم تسجيلها مع اسم الخادم ووقت الرصد والسبب في سجل العمليات.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-400">
            {isEditMode ? "وضع التعديل مفعل • التغييرات تُحفظ فورياً وتظهر لجميع الخدام" : "نظام رصد الدرجات المعتمد لاجتماع الشباب ٢٠٢٦"}
          </span>
          <button
            type="button"
            onClick={() => {
              sounds.playTap();
              onClose();
            }}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all cursor-pointer"
          >
            إغلاق النافذة
          </button>
        </div>
      </div>

      {/* SUB-MODAL: Add or Edit Item Form */}
      {showItemEditModal && (
        <div className="fixed inset-0 z-[350] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-scaleIn">
          <div className="relative w-full max-w-md rounded-3xl border border-amber-500/40 bg-slate-900 p-5 sm:p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-sm sm:text-base font-black text-amber-300 flex items-center gap-2">
                <Edit2 className="h-4 w-4" />
                <span>{editingItem ? "تعديل سبب / نشاط في الدليل" : "إضافة سبب / نشاط جديد للدليل"}</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowItemEditModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 block">عنوان النشاط / سبب البونص:</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="مثال: حفظ آية الأسبوع بالشاهد"
                  className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 block">مقدار النقاط (XP):</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={1000}
                    value={formPoints}
                    onChange={(e) => setFormPoints(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-amber-300 font-mono font-bold focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 block">الأيقونة المعبرة:</label>
                  <input
                    type="text"
                    required
                    value={formIcon}
                    onChange={(e) => setFormIcon(e.target.value)}
                    placeholder="مثال: 📖 أو ⏰"
                    className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-sm text-center focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 block">القسم والتصنيف:</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="attendance">⏰ الحضور والالتزام</option>
                  <option value="spiritual">📖 المسابقات الروحية والكتابية</option>
                  <option value="activities">🎯 الأنشطة الجماعية والتحديات</option>
                  <option value="service">❤️ الخدمة والمحبة والافتقاد</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 block">شرح وتفاصيل النشاط:</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="وصف مختصر للنشاط المطلوب من المخدوم..."
                  className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 block">توجيه للخادم (كيف يعطيها؟):</label>
                <input
                  type="text"
                  value={formHowToAward}
                  onChange={(e) => setFormHowToAward(e.target.value)}
                  placeholder="مثال: يرصدها الخادم فوراً بعد الاستماع للتسميع..."
                  className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowItemEditModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all flex items-center gap-1.5 shadow-md shadow-amber-500/20"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{editingItem ? "حفظ التعديلات" : "إضافة النشاط للدليل"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
