import test from 'node:test';
import assert from 'node:assert/strict';
import { isAiComposerEnabled, resolveAiUiState } from './ai-availability';

test('cached Ready is ignored while browser fallback is Offline', () => {
  assert.equal(resolveAiUiState({ fallbackOffline: true, configured: true }), 'offline');
  assert.equal(isAiComposerEnabled('offline', false), false);
});

test('Online with configured Gemini stays ready', () => {
  assert.equal(resolveAiUiState({ fallbackOffline: false, configured: true }), 'ready');
  assert.equal(isAiComposerEnabled('ready', false), true);
  assert.equal(isAiComposerEnabled('ready', true), false);
});

test('not configured and loading stay distinct from offline', () => {
  assert.equal(resolveAiUiState({ fallbackOffline: false, configured: false }), 'not-configured');
  assert.equal(resolveAiUiState({ fallbackOffline: false }), 'loading');
  assert.equal(isAiComposerEnabled('not-configured', false), true);
});
