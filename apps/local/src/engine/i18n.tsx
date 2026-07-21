// Internationalization scaffolding (feedback item #20): "build the i18n
// scaffolding now — retrofitting right-to-left layout later is genuinely
// painful." This is deliberately just the scaffolding plus the app's main
// chrome (header, tabs, ticker labels, primary buttons) translated, not an
// exhaustive translation of every microcopy string in the app — the
// expensive, error-prone part is the RTL layout + toggle plumbing, and
// that's what's built here. Adding more strings to STRINGS below is cheap
// once this exists.
//
// One decision the feedback flagged as open is left as a TODO, not resolved
// here, since it's a content/voice call for the designer, not app-referee
// work: Egyptian colloquial vs. Modern Standard Arabic for new copy. The
// existing card/company Arabic names already lean colloquial (ضرايب), so
// new strings below follow that lead, but this isn't locked in.
//
// v1.4: the other open item — an Arabic-Indic numerals toggle — IS now
// built (feedback item #13: "App side: currency label plus an Arabic-Indic
// numerals toggle"). See toArabicIndicDigits()/useMoney() below. Money
// values are still denominated exactly as printed on the cards; nothing
// was retuned. Item #13's actual ask — "denominate everything as thousands
// of EGP" — is realized as a currency label only ("EGP, in thousands" /
// "جنيه، بالآلاف"), not as a retuning of any number in the game.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "en" | "ar";

const LANG_KEY = "raselmal.local.lang.v1";
const NUMERALS_KEY = "raselmal.local.numerals.v1";

type Dict = Record<string, { en: string; ar: string }>;

/** Core chrome strings. Extend this as more of the UI gets translated. */
const STRINGS: Dict = {
  appTitle: { en: "Ras El-Mal — Digital Banker", ar: "رأس المال — البنكي الرقمي" },
  subtitlePlayers: { en: "players", ar: "لاعبين" },
  undo: { en: "↩ Undo", ar: "↩ تراجع" },
  endGame: { en: "End game & score", ar: "إنهاء اللعبة والتسجيل" },
  resetGame: { en: "Reset game", ar: "إعادة تعيين" },
  marketIndex: { en: "Market Index", ar: "مؤشر السوق" },
  interestRate: { en: "Interest Rate", ar: "سعر الفائدة" },
  newsDeck: { en: "News Deck", ar: "أخبار متبقية" },
  cardsLeft: { en: "cards left", ar: "بطاقة" },
  perNotePerLap: { en: "/ note / lap", ar: "/ سند / لفة" },
  currentPlayer: { en: "Current player:", ar: "اللاعب الحالي:" },
  nextTurn: { en: "Next turn →", ar: "الدور التالي ←" },
  drawNews: { en: "Draw news card (Breaking News space)", ar: "سحب بطاقة أخبار" },
  tabPlayers: { en: "Players & Bank", ar: "اللاعبون والبنك" },
  tabProperties: { en: "Listings", ar: "الشركات" },
  tabAuction: { en: "Auction", ar: "المزاد" },
  tabLog: { en: "Event Log", ar: "سجل الأحداث" },
  reckoning: { en: "THE RECKONING", ar: "الحساب" },
  timeToScore: { en: "TIME TO SCORE", ar: "وقت التسجيل" },
  turnsRemaining: { en: "turns remaining", ar: "أدوار متبقية" },
  soundOn: { en: "🔊 Sound", ar: "🔊 الصوت" },
  soundOff: { en: "🔇 Muted", ar: "🔇 صامت" },
  language: { en: "العربية", ar: "English" },
  currencyLabel: { en: "EGP, in thousands", ar: "جنيه مصري، بالآلاف" },
  numeralsWestern: { en: "123", ar: "123" },
  numeralsArabic: { en: "١٢٣", ar: "١٢٣" },
  numeralsToggleTitle: { en: "Switch digit style", ar: "تبديل شكل الأرقام" },
  exportLog: { en: "⬇ Export", ar: "⬇ تصدير" },
  noEvents: { en: "No events recorded yet.", ar: "لا توجد أحداث بعد." },
  logColTime: { en: "Time", ar: "الوقت" },
  logColWho: { en: "Who", ar: "من" },
  logColEvent: { en: "Event", ar: "الحدث" },
  logColAmount: { en: "Amount", ar: "المبلغ" },
  bank: { en: "Bank / Market", ar: "البنك / السوق" },
};

export type StringKey = keyof typeof STRINGS;

interface LangContextValue {
  lang: Lang;
  dir: "ltr" | "rtl";
  toggleLang: () => void;
  t: (key: StringKey) => string;
  arabicNumerals: boolean;
  toggleNumerals: () => void;
}

const LangContext = createContext<LangContextValue | null>(null);

function loadLang(): Lang {
  if (typeof window === "undefined") return "en";
  const saved = window.localStorage.getItem(LANG_KEY);
  return saved === "ar" ? "ar" : "en";
}

function loadNumerals(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(NUMERALS_KEY) === "1";
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => loadLang());
  const [arabicNumerals, setArabicNumerals] = useState<boolean>(() => loadNumerals());
  const dir: "ltr" | "rtl" = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    window.localStorage.setItem(LANG_KEY, lang);
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", dir);
  }, [lang, dir]);

  useEffect(() => {
    window.localStorage.setItem(NUMERALS_KEY, arabicNumerals ? "1" : "0");
  }, [arabicNumerals]);

  const value = useMemo<LangContextValue>(
    () => ({
      lang,
      dir,
      toggleLang: () => setLang((l) => (l === "en" ? "ar" : "en")),
      t: (key: StringKey) => STRINGS[key]?.[lang] ?? String(key),
      arabicNumerals,
      toggleNumerals: () => setArabicNumerals((v) => !v),
    }),
    [lang, dir, arabicNumerals],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang() must be used inside <LangProvider>");
  return ctx;
}

// ---------------------------------------------------------------------------
// Money formatting (feedback item #13: currency label + Arabic-Indic
// numerals toggle). Values themselves are never retuned — only the digit
// glyphs and an accompanying label change.
// ---------------------------------------------------------------------------

const WESTERN_TO_ARABIC_INDIC: Record<string, string> = {
  "0": "٠", "1": "١", "2": "٢", "3": "٣", "4": "٤",
  "5": "٥", "6": "٦", "7": "٧", "8": "٨", "9": "٩",
};

export function toArabicIndicDigits(input: string): string {
  return input.replace(/[0-9]/g, (d) => WESTERN_TO_ARABIC_INDIC[d] ?? d);
}

const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

/** Formats a money amount, honoring the Arabic-Indic numerals toggle. */
export function formatMoney(amount: number, arabicNumerals: boolean): string {
  const western = NUMBER_FORMAT.format(amount);
  return arabicNumerals ? toArabicIndicDigits(western) : western;
}

/** Convenience hook: returns a bound `format()` that already knows the current numerals setting. */
export function useMoney(): { format: (amount: number) => string } {
  const { arabicNumerals } = useLang();
  return useMemo(() => ({ format: (amount: number) => formatMoney(amount, arabicNumerals) }), [arabicNumerals]);
}
