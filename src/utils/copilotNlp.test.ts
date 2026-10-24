import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractCopilotDate,
  matchPatientFlexible,
  getNextAttendanceStatus,
  calculateCashFlow
} from './copilotNlp';

test('extractCopilotDate parses "el dia 23 de septiembre"', () => {
  const result = extractCopilotDate('pon presente a rosa el dia 23 de septiembre', '2026-10-23');
  assert.equal(result, '2026-09-23');
});

test('extractCopilotDate parses "15 de octubre" with implicit year', () => {
  const result = extractCopilotDate('marca presente a Carlos el 15 de octubre', '2026-10-23');
  assert.equal(result, '2026-10-15');
});

test('extractCopilotDate parses relative days "ayer" and "anteayer"', () => {
  const yesterday = extractCopilotDate('rosa vino ayer', '2026-10-23');
  assert.equal(yesterday, '2026-10-22');

  const twoDaysAgo = extractCopilotDate('elena faltó anteayer', '2026-10-23');
  assert.equal(twoDaysAgo, '2026-10-21');
});

test('extractCopilotDate returns null when no date is mentioned', () => {
  const result = extractCopilotDate('pon presente a rosa');
  assert.equal(result, null);
});

test('matchPatientFlexible finds Rosa in a patient list', () => {
  const patients = [
    { id: 'pat-1', name: 'Elena Morales Sanhueza' },
    { id: 'pat-2', name: 'Carlos Ruiz-Tagle Vial' },
    { id: 'pat-6', name: 'Rosa Ester Valdebenito Muñoz' }
  ];

  const match1 = matchPatientFlexible('pon presente a rosa el dia 23 de septiembre', patients);
  assert.ok(match1);
  assert.equal(match1.id, 'pat-6');

  const match2 = matchPatientFlexible('marca presente a elena', patients);
  assert.ok(match2);
  assert.equal(match2.id, 'pat-1');
});

test('getNextAttendanceStatus toggles cleanly between Presente and Ausente', () => {
  assert.equal(getNextAttendanceStatus(undefined), 'Presente');
  assert.equal(getNextAttendanceStatus(''), 'Presente');
  assert.equal(getNextAttendanceStatus('Sin registro'), 'Presente');
  assert.equal(getNextAttendanceStatus('Ausente con aviso'), 'Presente');
  assert.equal(getNextAttendanceStatus('Presente'), 'Ausente con aviso');
});

test('calculateCashFlow sums revenues and subtracts fixed/variable expenses', () => {
  const result = calculateCashFlow(1400000, 500000, 1200000, 200000);
  assert.equal(result.totalIncomes, 1900000);
  assert.equal(result.totalExpenses, 1400000);
  assert.equal(result.netFlow, 500000);
});
