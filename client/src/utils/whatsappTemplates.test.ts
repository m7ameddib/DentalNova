import test from 'node:test';
import assert from 'node:assert/strict';
import { ClinicSettings } from '../types/domain';
import { buildAppointmentReminderMessage } from './whatsappTemplates';
import { buildWhatsAppDesktopUrl, buildWhatsAppUrl } from './whatsapp';

function settings(overrides: Partial<ClinicSettings> = {}): ClinicSettings {
  return {
    id: 1,
    clinicName: 'Ali Salmen Clinic',
    clinicPhone: null,
    doctorPhone: null,
    address: null,
    logoPath: null,
    logoOriginalName: null,
    workingDays: '1,2,3,4,5',
    workStartTime: '09:00',
    workEndTime: '17:00',
    whatsappMessageLanguage: 'en',
    whatsappAppointmentReminderEn: null,
    whatsappAppointmentReminderAr: null,
    whatsappClinicalFollowupEn: null,
    whatsappClinicalFollowupAr: null,
    whatsappFinancialFollowupEn: null,
    whatsappFinancialFollowupAr: null,
    doctorNameAr: null,
    doctorNameEn: null,
    doctorTitleAr: null,
    doctorTitleEn: null,
    doctorLicenseNo: null,
    updatedAt: '2026-09-15T00:00:00.000Z',
    ...overrides,
  };
}

test('appointment reminder keeps 12-hour time and still builds wa.me / whatsapp URLs', () => {
  const message = buildAppointmentReminderMessage(settings(), {
    clinicName: 'Ali Salmen Clinic',
    patientName: 'Mohammad',
    appointmentDate: '15 Sep 2026',
    appointmentTime: '16:00',
    appointmentReason: 'Checkup',
  });
  assert.match(message, /4:00 PM/);
  assert.equal(message.includes('16:00'), false);

  const webUrl = buildWhatsAppUrl('81858501', message);
  assert.ok(webUrl);
  assert.ok(webUrl.startsWith('https://wa.me/96181858501?text='));
  assert.doesNotThrow(() => new URL(webUrl));
  assert.match(webUrl, /4%3A00%20PM/);

  const desktopUrl = buildWhatsAppDesktopUrl('81858501', message);
  assert.ok(desktopUrl);
  assert.ok(desktopUrl.startsWith('whatsapp://send?'));
  assert.match(desktopUrl, /4%3A00(\+|%20)PM/);
});

test('appointment reminder still opens a valid URL when the clock value is missing', () => {
  const message = buildAppointmentReminderMessage(settings({ whatsappMessageLanguage: 'ar' }), {
    clinicName: 'Ali Salmen Clinic',
    patientName: 'محمد',
    appointmentDate: '15 Sep 2026',
    appointmentTime: undefined,
  });
  assert.equal(message.includes('undefined'), false);
  const webUrl = buildWhatsAppUrl('+961 81 858 501', message);
  assert.ok(webUrl?.startsWith('https://wa.me/96181858501?text='));
  assert.doesNotThrow(() => new URL(webUrl!));
});
