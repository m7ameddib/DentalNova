import test from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { httpErrorFromUnknown } from './http-error.util';
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

test('unknown errors stay generic 500', () => {
  const mapped = httpErrorFromUnknown(new Error('SQLITE_ERROR: no such table'));
  assert.equal(mapped.status, 500);
  assert.equal(mapped.body.message, 'Unexpected server error');
});
