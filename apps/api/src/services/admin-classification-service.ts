import type { AdminRecordType } from '@prisma/client';

/** Keyword-based admin classification (Sprint 07 — conservative). */
export function classifyAdminFromText(text: string): {
  adminType: AdminRecordType;
  confidence: number;
  reason: string;
} {
  const t = text.toLowerCase();
  if (/\b(renew|renewal|expires|membership ends|subscription renews|renew license|renew domain)\b/.test(t)) {
    return { adminType: 'RENEWAL', confidence: 0.74, reason: 'Renewal / expiry language' };
  }
  if (/\b(return by|return window|refund deadline|return policy)\b/.test(t)) {
    return { adminType: 'RETURN_WINDOW', confidence: 0.68, reason: 'Return / refund window language' };
  }
  if (/\b(receipt|order #|order number|total paid|thank you for your purchase)\b/.test(t)) {
    return { adminType: 'RECEIPT', confidence: 0.64, reason: 'Receipt / order language' };
  }
  if (/\b(appointment|bring documents|before visit|fee due before|submit before)\b/.test(t)) {
    return { adminType: 'APPOINTMENT_ADMIN', confidence: 0.66, reason: 'Appointment prep language' };
  }
  if (/\b(form|submit|application due|paperwork)\b/.test(t) && /\b(due|before|by)\b/.test(t)) {
    return { adminType: 'FORM_REQUIREMENT', confidence: 0.58, reason: 'Form / submission language' };
  }
  if (/\b(bill|invoice|amount due|payment due|utility|statement|pay by)\b/.test(t)) {
    return { adminType: 'BILL', confidence: 0.72, reason: 'Billing language' };
  }
  if (/\b(subscription|monthly plan|annual plan)\b/.test(t)) {
    return { adminType: 'SUBSCRIPTION', confidence: 0.6, reason: 'Subscription language' };
  }
  return { adminType: 'PAYMENT_REQUEST', confidence: 0.38, reason: 'Weak admin cue — review' };
}
