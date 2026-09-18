import test from 'node:test';
import assert from 'node:assert/strict';
import { isLoopbackHostname, requestClientIp } from './loopback.util';

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

test('loopback hostnames include localhost and 127/::1, not LAN or public hosts', () => {
  assert.equal(isLoopbackHostname('localhost'), true);
  assert.equal(isLoopbackHostname('127.0.0.1'), true);
  assert.equal(isLoopbackHostname('[::1]'), true);
  assert.equal(isLoopbackHostname('192.168.1.9'), false);
  assert.equal(isLoopbackHostname('dentalnova.dibnova.com'), false);
});
