import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FILE_MAX_AUTO_ATTEMPTS,
  nextAttachmentRetryAt,
  shouldRetryAttachment,
} from './sync-files.util';

test('attachments stop auto-retry after the attempt cap', () => {
  assert.equal(shouldRetryAttachment({ uploadedAt: '2026-01-01T00:00:00Z' }), false);
  assert.equal(shouldRetryAttachment({ attemptCount: 0 }), true);
  assert.equal(shouldRetryAttachment({ attemptCount: FILE_MAX_AUTO_ATTEMPTS }), false);
  assert.equal(shouldRetryAttachment({ attemptCount: FILE_MAX_AUTO_ATTEMPTS, force: true }), true);
});

test('attachments honor next_retry_at backoff', () => {
  const now = Date.parse('2026-09-17T10:00:00Z');
  const later = nextAttachmentRetryAt(0, now);
  assert.equal(shouldRetryAttachment({ attemptCount: 1, nextRetryAt: later, nowMs: now }), false);
  assert.equal(
    shouldRetryAttachment({ attemptCount: 1, nextRetryAt: later, nowMs: Date.parse(later) }),
    true,
  );
});
