import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isInlineSafeImage,
  normalizeUploadMime,
  contentDispositionFor,
  ALLOWED_ATTACHMENT_MIMES,
} from '../attachments/attachment-mime.util';

test('HTML is never an allowed attachment MIME', () => {
  assert.equal(ALLOWED_ATTACHMENT_MIMES.has('text/html'), false);
  assert.equal(isInlineSafeImage('text/html'), false);
  assert.equal(normalizeUploadMime('text/html', 'note.html'), 'text/html');
});

test('safe images may be inline; PDFs download as attachment', () => {
  assert.equal(isInlineSafeImage('image/jpeg'), true);
  assert.equal(isInlineSafeImage('application/pdf'), false);
  assert.match(contentDispositionFor('x.pdf', false), /^attachment;/);
  assert.match(contentDispositionFor('x.png', true), /^inline;/);
});
