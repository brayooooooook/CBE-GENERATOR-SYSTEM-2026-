import { Mark, SubjectStatus } from '../types';

export interface EvaluatedMark {
  status: SubjectStatus;
  percentage: number | null;
  rawScore: number | null;
  outOf: number;
  irregularityReason?: string;
  displayScore: string;
  displayPercentage: string;
  displayStatus: string;
}

export function evaluateMark(mark?: Mark | null): EvaluatedMark {
  if (!mark) {
    return {
      status: 'Blank',
      percentage: null,
      rawScore: null,
      outOf: 100,
      displayScore: '',
      displayPercentage: '',
      displayStatus: 'Blank',
    };
  }

  const rawMarkStr = typeof mark.marks === 'string' ? (mark.marks as string).trim().toUpperCase() : '';

  // Explicit status check
  if (mark.special_status === 'X' || rawMarkStr === 'X') {
    return {
      status: 'X',
      percentage: null,
      rawScore: null,
      outOf: mark.out_of || 100,
      displayScore: 'X',
      displayPercentage: 'X',
      displayStatus: 'X (Missing Mark)',
    };
  }

  if (mark.special_status === 'Y' || rawMarkStr === 'Y') {
    const reason = mark.irregularity_reason || 'Absent';
    return {
      status: 'Y',
      percentage: null,
      rawScore: null,
      outOf: mark.out_of || 100,
      irregularityReason: reason,
      displayScore: 'Y',
      displayPercentage: 'Y',
      displayStatus: `Y (${reason})`,
    };
  }

  if (mark.special_status === 'Blank' || rawMarkStr === 'BLANK' || rawMarkStr === '-') {
    return {
      status: 'Blank',
      percentage: null,
      rawScore: null,
      outOf: mark.out_of || 100,
      displayScore: '',
      displayPercentage: '',
      displayStatus: 'Blank',
    };
  }

  // Normal numerical score
  const numRaw = typeof mark.raw_score === 'number' && !isNaN(mark.raw_score)
    ? mark.raw_score
    : (typeof (mark as any).score === 'number' && !isNaN((mark as any).score))
      ? (mark as any).score
      : (typeof mark.raw_score === 'string' && (mark.raw_score as string).trim() !== '' && !isNaN(Number(mark.raw_score)))
        ? Number(mark.raw_score)
        : (typeof (mark as any).score === 'string' && ((mark as any).score as string).trim() !== '' && !isNaN(Number((mark as any).score)))
          ? Number((mark as any).score)
          : NaN;

  const numMarks = typeof mark.marks === 'number' && !isNaN(mark.marks)
    ? mark.marks
    : (typeof mark.marks === 'string' && (mark.marks as string).trim() !== '' && !isNaN(Number(mark.marks)))
      ? Number(mark.marks)
      : (typeof (mark as any).percentage === 'number' && !isNaN((mark as any).percentage))
        ? (mark as any).percentage
        : NaN;

  const hasRawScore = !isNaN(numRaw);
  const hasMarks = !isNaN(numMarks);

  if (hasRawScore || hasMarks) {
    const outOf = mark.out_of && mark.out_of > 0 ? mark.out_of : 100;
    const rawScore = hasRawScore ? numRaw : numMarks;
    const percentage = outOf > 0 ? (rawScore / outOf) * 100 : rawScore;
    const clampedPct = Math.min(100, Math.max(0, percentage));

    return {
      status: 'Normal',
      percentage: clampedPct,
      rawScore,
      outOf,
      displayScore: outOf !== 100 ? `${rawScore}/${outOf}` : formatPercentage(clampedPct),
      displayPercentage: formatPercentage(clampedPct, true),
      displayStatus: 'Normal',
    };
  }

  return {
    status: 'Blank',
    percentage: null,
    rawScore: null,
    outOf: 100,
    displayScore: '',
    displayPercentage: '',
    displayStatus: 'Blank',
  };
}

export const IRREGULARITY_REASONS = [
  'Absent',
  'Examination Malpractice',
  'Withheld Result',
  'Medical Absence',
  'Exempted',
];

/**
 * Consistently rounds a percentage value to the nearest whole number integer, returning a number.
 * E.g., 74.2 -> 74, 74.5 -> 75, 74.8 -> 75
 */
export function roundPercentage(val: number | string | null | undefined): number | null {
  if (val === null || val === undefined || val === '') return null;
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  if (isNaN(num)) return null;
  return Math.round(num);
}

/**
 * Formats a percentage or average mark for user display.
 * Displays whole numbers where appropriate (e.g. 56%), or max 1 decimal place without trailing zeros (e.g. 56.3%).
 */
export function formatPercentage(
  val: number | string | null | undefined,
  includeSymbol: boolean = false,
  fallback: string = '-'
): string {
  if (val === null || val === undefined || val === '') return fallback;
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  if (isNaN(num)) return String(val);

  const rounded = roundPercentage(num);
  if (rounded === null) return fallback;

  const str = String(rounded);
  return includeSymbol ? `${str}%` : str;
}

/**
 * Utility to consistently round a numerical mark or percentage to the nearest integer.
 * Handles numbers, numeric strings, and null/undefined values gracefully.
 */
export function roundMark(mark: number | string | null | undefined): number | null {
  if (mark === null || mark === undefined || mark === '') return null;
  const num = typeof mark === 'number' ? mark : parseFloat(String(mark));
  if (isNaN(num)) return null;
  return Math.round(num);
}

/**
 * Utility to format a numerical mark/percentage for display.
 * Returns the integer rounded value as a string (e.g., "86").
 */
export function formatMarkValue(mark: number | string | null | undefined): string {
  const rounded = roundMark(mark);
  return rounded !== null ? String(rounded) : '';
}

/**
 * Abbreviates CBE performance levels to short form (EE, ME, AE, BE).
 */
export function getAbbreviatedLevel(levelStr?: string | null, gradeCode?: string | null): string {
  if (gradeCode) {
    const gc = gradeCode.toUpperCase();
    if (gc.startsWith('EE')) return 'EE';
    if (gc.startsWith('ME')) return 'ME';
    if (gc.startsWith('AE')) return 'AE';
    if (gc.startsWith('BE')) return 'BE';
  }
  if (!levelStr) return '-';
  const str = levelStr.trim().toUpperCase();
  if (str.includes('EXCEEDING') || str === 'EE') return 'EE';
  if (str.includes('MEETING') || str === 'ME') return 'ME';
  if (str.includes('APPROACHING') || str === 'AE') return 'AE';
  if (str.includes('BELOW') || str === 'BE') return 'BE';
  if (str === 'ABSENT' || str === 'X') return 'Absent';
  if (str === 'IRREGULARITY' || str === 'Y') return 'Irregularity';
  if (str === 'PENDING' || str === 'PROVISIONAL') return 'Pending';
  return levelStr;
}

/**
 * Returns concise 1-2 word remarks for tables (e.g., Outstanding, Excellent, Good, Satisfactory, Developing, Needs Support, Intervention Required).
 */
export function getShortRemark(remarkStr?: string | null, gradeCode?: string | null): string {
  if (gradeCode) {
    const gc = gradeCode.toUpperCase();
    if (gc === 'EE1') return 'Outstanding';
    if (gc === 'EE2') return 'Excellent';
    if (gc === 'ME1') return 'Good';
    if (gc === 'ME2') return 'Satisfactory';
    if (gc === 'AE1') return 'Developing';
    if (gc === 'AE2') return 'Needs Support';
    if (gc === 'BE1') return 'Needs Support';
    if (gc === 'BE2') return 'Intervention Required';
  }

  if (!remarkStr) return '-';
  const upper = remarkStr.toUpperCase();
  if (upper.includes('OUTSTANDING')) return 'Outstanding';
  if (upper.includes('EXCELLENT')) return 'Excellent';
  if (upper.includes('GOOD')) return 'Good';
  if (upper.includes('SATISFACTORY')) return 'Satisfactory';
  if (upper.includes('DEVELOPING')) return 'Developing';
  if (upper.includes('NEEDS MORE PRACTICE') || upper.includes('NEEDS PRACTICE')) return 'Needs Support';
  if (upper.includes('NEEDS SUPPORT')) return 'Needs Support';
  if (upper.includes('INTERVENTION') || upper.includes('IMMEDIATE SUPPORT')) return 'Intervention Required';
  if (upper.includes('ABSENT')) return 'Absent';
  if (upper.includes('IRREGULARITY')) return 'Irregularity';
  if (upper.includes('PENDING') || upper.includes('PROVISIONAL')) return 'Pending';

  return remarkStr.length > 20 ? `${remarkStr.substring(0, 18)}..` : remarkStr;
}


