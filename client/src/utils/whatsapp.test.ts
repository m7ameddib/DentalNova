import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appointmentReminderPhone,
  buildWhatsAppUrl,
  normalizeWhatsAppPhone,
  openReservedWhatsAppFallback,
  ReservedPopup,
} from './whatsapp';

test('normalizeWhatsAppPhone accepts local Lebanese mobiles and +961', () => {
  assert.equal(normalizeWhatsAppPhone('81858501'), '96181858501');
  assert.equal(normalizeWhatsAppPhone('+961 81 858 501'), '96181858501');
  assert.equal(normalizeWhatsAppPhone('081858501'), '96181858501');
  assert.equal(normalizeWhatsAppPhone('123'), null);
  assert.equal(normalizeWhatsAppPhone(null), null);
});

test('appointment reminder uses linked patient phone, else guest phone', () => {
  assert.equal(appointmentReminderPhone({ patientPhone: '81858501', guestPhone: '70000000' }), '96181858501');
  assert.equal(appointmentReminderPhone({ patientPhone: null, guestPhone: '81858501' }), '96181858501');
  assert.equal(appointmentReminderPhone({ patientPhone: '', guestPhone: '+96181858501' }), '96181858501');
  assert.equal(appointmentReminderPhone({ patientPhone: null, guestPhone: null }), null);
});

test('delayed wa.me is assigned onto the click-reserved tab, not a second window.open', () => {
  const assigned: string[] = [];
  const webNow: string[] = [];
  const desktop: string[] = [];
  const scheduled: Array<() => void> = [];
  const reserved: ReservedPopup = {
    closed: false,
    close() {
      this.closed = true;
    },
    assign(url) {
      assigned.push(url);
    },
  };
  const webUrl = buildWhatsAppUrl('81858501', 'See you at 4:00 PM')!;

  const opened = openReservedWhatsAppFallback({
    webUrl,
    desktopUrl: 'whatsapp://send?phone=96181858501',
    reserveBlank: () => reserved,
    openDesktop: () => desktop.push('desktop'),
    openWebNow: (url) => webNow.push(url),
    subscribeHandoff: () => () => undefined,
    isHandedOff: () => false,
    schedule: (fn) => scheduled.push(fn),
    delayMs: 10,
  });

  assert.equal(opened, true);
  assert.deepEqual(desktop, ['desktop']);
  assert.deepEqual(assigned, []);
  assert.deepEqual(webNow, []);
  assert.equal(scheduled.length, 1);
  scheduled[0]();
  assert.deepEqual(assigned, [webUrl]);
  assert.match(assigned[0], /4%3A00%20PM/);
  assert.deepEqual(webNow, []);
});

test('when the reserved popup is blocked, wa.me opens in the same click', () => {
  const webNow: string[] = [];
  const webUrl = buildWhatsAppUrl('81858501', 'hi')!;
  openReservedWhatsAppFallback({
    webUrl,
    desktopUrl: 'whatsapp://send?phone=96181858501',
    reserveBlank: () => null,
    openDesktop: () => undefined,
    openWebNow: (url) => webNow.push(url),
    subscribeHandoff: () => () => undefined,
    isHandedOff: () => false,
    schedule: () => {
      throw new Error('must not delay wa.me when no reserved tab exists');
    },
  });
  assert.deepEqual(webNow, [webUrl]);
});

test('desktop handoff closes the reserved blank tab instead of navigating it', () => {
  let closed = false;
  const assigned: string[] = [];
  const scheduled: Array<() => void> = [];
  const reserved: ReservedPopup = {
    closed: false,
    close() {
      closed = true;
      this.closed = true;
    },
    assign(url) {
      assigned.push(url);
    },
  };
  openReservedWhatsAppFallback({
    webUrl: 'https://wa.me/96181858501',
    desktopUrl: 'whatsapp://send?phone=96181858501',
    reserveBlank: () => reserved,
    openDesktop: () => undefined,
    openWebNow: () => {
      throw new Error('must not open a second web tab after desktop handoff');
    },
    subscribeHandoff: () => () => undefined,
    isHandedOff: () => true,
    schedule: (fn) => scheduled.push(fn),
  });
  scheduled[0]();
  assert.equal(closed, true);
  assert.deepEqual(assigned, []);
});
