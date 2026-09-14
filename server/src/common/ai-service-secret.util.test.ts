import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PUBLIC_DEFAULT_AI_SERVICE_SECRET,
  isInsecureAiServiceSecret,
  onlineAiSecretBootError,
} from './ai-service-secret.util';

test('public default and example placeholder are rejected; unique secrets are accepted', () => {
  assert.equal(isInsecureAiServiceSecret(''), true);
  assert.equal(isInsecureAiServiceSecret(undefined), true);
  assert.equal(isInsecureAiServiceSecret(PUBLIC_DEFAULT_AI_SERVICE_SECRET), true);
  assert.equal(isInsecureAiServiceSecret('REPLACE_WITH_UNIQUE_AI_PROXY_SECRET'), true);
  assert.equal(isInsecureAiServiceSecret('  DentalNova.AI.Proxy.v1  '), true);
  assert.equal(isInsecureAiServiceSecret('clinic-specific-ai-proxy-secret-32ch'), false);
});

test('boot error tells operators they can leave GEMINI_API_KEY empty', () => {
  const message = onlineAiSecretBootError();
  assert.match(message, /GEMINI_API_KEY/);
  assert.match(message, /AI_SERVICE_SECRET/);
  assert.match(message, /leave GEMINI_API_KEY empty/);
  assert.doesNotMatch(message, /skip this check/i);
});
