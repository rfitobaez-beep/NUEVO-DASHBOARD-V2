/**
 * Pure logic module for Vitalia ERP:
 * - Natural Language date parsing for attendance commands
 * - Patient fuzzy matching
 * - Attendance state toggle logic
 * - Financial cash flow balance
 */

export const SPANISH_MONTHS: Record<string, number> = {
  enero: 1,
  ene: 1,
  febrero: 2,
  feb: 2,
  marzo: 3,
  mar: 3,
  abril: 4,
  abr: 4,
  mayo: 5,
  may: 5,
  junio: 6,
  jun: 6,
  julio: 7,
  jul: 7,
  agosto: 8,
  ago: 8,
  septiembre: 9,
  setiembre: 9,
  sep: 9,
  octubre: 10,
  oct: 10,
  noviembre: 11,
  nov: 11,
  diciembre: 12,
  dic: 12
};

export function normalizeNlpText(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[,\.;:\?!¡¿\(\)"'\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts a date in YYYY-MM-DD format from user text.
 * Handles patterns such as:
 * - "el dia 23 de septiembre"
 * - "23 de septiembre"
 * - "el 15 de octubre de 2026"
 * - "ayer" / "anteayer" / "hoy"
 * - "2026-09-23" / "23/09/2026"
 */
export function extractCopilotDate(text: string, referenceDate: string = '2026-10-23'): string | null {
  const norm = normalizeNlpText(text);
  const [refYear, refMonth, refDay] = referenceDate.split('-').map(Number);

  if (norm.includes('anteayer') || norm.includes('antes de ayer')) {
    const d = new Date(refYear, refMonth - 1, refDay - 2);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  if (norm.includes('ayer')) {
    const d = new Date(refYear, refMonth - 1, refDay - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  if (norm.includes('hoy')) {
    return referenceDate;
  }

  // Matches: "23 de septiembre", "dia 23 de septiembre", "23 sep", "el 23 de septiembre del 2026"
  const monthNames = Object.keys(SPANISH_MONTHS).join('|');
  const monthRegex = new RegExp(`(?:dia\\s+)?(\\d{1,2})\\s*(?:de)?\\s*(${monthNames})(?:\\s*(?:del?|de)?\\s*(\\d{4}))?`, 'i');
  const monthMatch = norm.match(monthRegex);
  if (monthMatch) {
    const day = parseInt(monthMatch[1], 10);
    const monthKey = monthMatch[2].toLowerCase();
    const monthNum = SPANISH_MONTHS[monthKey];
    const year = monthMatch[3] ? parseInt(monthMatch[3], 10) : refYear;
    if (monthNum && day >= 1 && day <= 31) {
      return `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Matches YYYY-MM-DD
  const isoMatch = text.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = String(parseInt(isoMatch[2], 10)).padStart(2, '0');
    const d = String(parseInt(isoMatch[3], 10)).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Matches DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = text.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/);
  if (dmyMatch) {
    const d = String(parseInt(dmyMatch[1], 10)).padStart(2, '0');
    const m = String(parseInt(dmyMatch[2], 10)).padStart(2, '0');
    const y = parseInt(dmyMatch[3], 10);
    return `${y}-${m}-${d}`;
  }

  return null;
}

export function matchPatientFlexible(normText: string, patients: Array<{ id: string; name: string }>) {
  if (!normText || !patients) return null;
  // 1. Full normalized match
  for (const p of patients) {
    const normName = normalizeNlpText(p.name);
    if (normText.includes(normName)) return p;
  }
  // 2. Part match (at least 3 characters)
  for (const p of patients) {
    const parts = normalizeNlpText(p.name).split(' ').filter(part => part.length >= 3);
    for (const part of parts) {
      const regex = new RegExp('\\b' + part + '\\b', 'i');
      if (regex.test(normText)) return p;
    }
  }
  return null;
}

/**
 * Attendance toggle logic for single-click / checkmark in horizontal matrix:
 * - If not Presente -> sets to 'Presente' (tick checkmark)
 * - If Presente -> sets to 'Ausente con aviso'
 * - If Ausente -> sets to 'Presente'
 */
export function getNextAttendanceStatus(currentStatus?: string): 'Presente' | 'Ausente con aviso' {
  if (currentStatus === 'Presente') {
    return 'Ausente con aviso';
  }
  return 'Presente';
}

export function calculateCashFlow(
  collectedReceivables: number,
  extraIncomes: number,
  fixedExpenses: number,
  variableExpenses: number
): { totalIncomes: number; totalExpenses: number; netFlow: number } {
  const totalIncomes = (collectedReceivables || 0) + (extraIncomes || 0);
  const totalExpenses = (fixedExpenses || 0) + (variableExpenses || 0);
  return {
    totalIncomes,
    totalExpenses,
    netFlow: totalIncomes - totalExpenses
  };
}
