import test from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import {
  DATABASE_BUSY_CODE,
  DATABASE_BUSY_MESSAGE,
  DATABASE_CONSTRAINT_MESSAGE,
  DATABASE_ERROR_MESSAGE,
  EXTERNAL_UNREACHABLE_CODE,
  EXTERNAL_UNREACHABLE_MESSAGE,
  httpErrorFromUnknown,
} from './http-error.util';
import { PAYLOAD_TOO_LARGE_CODE, PAYLOAD_TOO_LARGE_MESSAGE } from '../http-payload.util';

test('HttpException bodies are forwarded with their status', () => {
  const mapped = httpErrorFromUnknown(new BadRequestException('Invalid or expired pairing code.'));
  assert.equal(mapped.status, 400);
  assert.equal(mapped.body.message, 'Invalid or expired pairing code.');
});

test('PayloadTooLargeError becomes 413 instead of Unexpected server error', () => {
  const mapped = httpErrorFromUnknown({
    type: 'entity.too.large',
    status: 413,
    statusCode: 413,
    message: 'request entity too large',
  });
  assert.equal(mapped.status, 413);
  assert.equal(mapped.body.message, PAYLOAD_TOO_LARGE_MESSAGE);
  assert.equal(mapped.body.code, PAYLOAD_TOO_LARGE_CODE);
});

test('Nest PayloadTooLargeException keeps 413', () => {
  const mapped = httpErrorFromUnknown(new PayloadTooLargeException('too big'));
  assert.equal(mapped.status, 413);
});

test('SQLite busy becomes 503 instead of Unexpected server error', () => {
  const mapped = httpErrorFromUnknown({ code: 'SQLITE_BUSY', message: 'database is locked' });
  assert.equal(mapped.status, 503);
  assert.equal(mapped.body.message, DATABASE_BUSY_MESSAGE);
  assert.equal(mapped.body.code, DATABASE_BUSY_CODE);
});

test('SQLite constraint becomes 409 without leaking schema', () => {
  const mapped = httpErrorFromUnknown(
    Object.assign(new Error('UNIQUE constraint failed: patients.phone'), { code: 'SQLITE_CONSTRAINT_UNIQUE' }),
  );
  assert.equal(mapped.status, 409);
  assert.equal(mapped.body.message, DATABASE_CONSTRAINT_MESSAGE);
  assert.ok(!String(mapped.body.message).includes('patients.phone'));
});

test('SQLite corrupt/generic errors stay 500 with a database message, not Unexpected server error', () => {
  const mapped = httpErrorFromUnknown(new Error('SQLITE_ERROR: no such table'));
  assert.equal(mapped.status, 500);
  assert.equal(mapped.body.message, DATABASE_ERROR_MESSAGE);
  assert.ok(!String(mapped.body.message).includes('no such table'));
});

test('fetch failed becomes 503 instead of Unexpected server error', () => {
  const mapped = httpErrorFromUnknown(Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } }));
  assert.equal(mapped.status, 503);
  assert.equal(mapped.body.message, EXTERNAL_UNREACHABLE_MESSAGE);
  assert.equal(mapped.body.code, EXTERNAL_UNREACHABLE_CODE);
});

test('AbortError / TimeoutError become 503 instead of Unexpected server error', () => {
  const mapped = httpErrorFromUnknown(
    Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }),
  );
  assert.equal(mapped.status, 503);
  assert.equal(mapped.body.message, EXTERNAL_UNREACHABLE_MESSAGE);
});

test('unknown errors stay generic 500', () => {
  const mapped = httpErrorFromUnknown(new Error('random boom'));
  assert.equal(mapped.status, 500);
  assert.equal(mapped.body.message, 'Unexpected server error');
});
