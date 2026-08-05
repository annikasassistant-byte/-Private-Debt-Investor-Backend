/**
 * Professional German contract titles — shared by mappers + cleanup script.
 */

export const CONTRACT_TYPE_LABELS = {
  loan_agreement: 'Darlehensvertrag',
  subordinated_loan: 'Nachrangdarlehensvertrag',
  amendment: 'Vertragsnachtrag',
  additional: 'Zusatzvereinbarung',
};

const LOREM_RE =
  /\b(lorem|ipsum|dolor|sit|amet|consectetur|adipiscing|elit|maiores|fugit|quis|eiusmod|aliquip|tempor|incididunt|labore|dolore|magna|aliqua)\b/i;

const FILENAME_RE = /\.(pdf|docx?|xlsx?|png|jpe?g)$/i;

export function isPlaceholderDocumentTitle(title) {
  const t = String(title || '').trim();
  if (!t) return true;
  if (LOREM_RE.test(t)) return true;
  if (FILENAME_RE.test(t) && (/[_\d]/.test(t) || LOREM_RE.test(t))) return true;
  if (/^[a-z0-9_-]+\.(pdf|docx?)$/i.test(t) && !/darlehen|vertrag|nachtrag|vereinbarung/i.test(t)) {
    return true;
  }
  return false;
}

export function resolveContractTitle(title, type, index = 0) {
  const base = CONTRACT_TYPE_LABELS[String(type || '')] || 'Darlehensvertrag';
  if (!isPlaceholderDocumentTitle(title)) return String(title).trim();
  return index > 0 ? `${base} ${index + 1}` : base;
}

export default {
  CONTRACT_TYPE_LABELS,
  isPlaceholderDocumentTitle,
  resolveContractTitle,
};
