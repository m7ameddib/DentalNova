import test from 'node:test';
import assert from 'node:assert/strict';
import { requestClientIp } from './loopback.util';

test('rate-limit IP ignores spoofed X-Forwarded-For when req.ip is the socket', () => {
  const ip = requestClientIp({
    ip: '10.0.0.8',
    socket: { remoteAddress: '10.0.0.8' },
    headers: { 'x-forwarded-for': '1.2.3.4, 9.9.9.9' },
  });
  assert.equal(ip, '10.0.0.8');
});

test('falls back to the socket when Express has not set req.ip', () => {
  assert.equal(
    requestClientIp({
      socket: { remoteAddress: '::ffff:192.168.1.9' },
      headers: { 'x-forwarded-for': '8.8.8.8' },
    }),
    '192.168.1.9',
  );
});
