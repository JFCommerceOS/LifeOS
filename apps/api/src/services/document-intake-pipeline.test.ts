import { describe, expect, it } from 'vitest';
import { classifyFromText, deriveDeadlines } from './document-intake-pipeline.js';

describe('classifyFromText', () => {
  it('detects lab language', () => {
    const r = classifyFromText('CBC panel reference range 120 mg/dL glucose', 'lab.pdf');
    expect(r.family).toBe('HEALTH');
    expect(r.subtype).toBe('LAB_REPORT');
    expect(r.confidence).toBeGreaterThan(0.7);
  });

  it('detects bill language', () => {
    const r = classifyFromText('Amount due $42.50 pay by 04/15/2026 utility statement', 'bill.pdf');
    expect(r.family).toBe('FINANCE_ADMIN');
    expect(r.subtype).toBe('BILL');
  });

  it('detects receipt language before bill', () => {
    const r = classifyFromText('Thank you for your purchase. Subtotal $19.99. Return policy 30 days.', 'receipt.pdf');
    expect(r.family).toBe('FINANCE_ADMIN');
    expect(r.subtype).toBe('RECEIPT');
  });

  it('detects assignment language', () => {
    const r = classifyFromText('Homework chapter 3 due date next week class syllabus', 'hw.pdf');
    expect(r.family).toBe('EDUCATION');
    expect(r.subtype).toBe('ASSIGNMENT');
  });
});

describe('deriveDeadlines', () => {
  it('emits bill payment deadline when date in future', () => {
    const future = new Date(Date.now() + 86400000 * 10);
    const iso = future.toISOString().slice(0, 10);
    const d = deriveDeadlines({
      family: 'FINANCE_ADMIN',
      subtype: 'BILL',
      fullText: `Pay by ${iso} amount due`,
      classifyConfidence: 0.8,
    });
    expect(d.length).toBeGreaterThan(0);
    expect(d[0]?.type).toBe('PAYMENT_DUE');
    expect(d[0]?.dueAt).toBeTruthy();
  });
});
