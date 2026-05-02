import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG, loadConfig } from './config';
import type { AppConfig } from '../types';

const store = new Map<string, string>();

vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => store.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store.set(key, value);
  }),
  removeItem: vi.fn((key: string) => {
    store.delete(key);
  }),
  clear: vi.fn(() => {
    store.clear();
  }),
});

afterEach(() => {
  store.clear();
});

describe('loadConfig', () => {
  it('migrates legacy OpenAI-compatible API configs to an explicit apiProtocol', () => {
    const legacyConfig: Partial<AppConfig> = {
      mode: 'api',
      apiKey: 'sk-test',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-chat',
      agentId: null,
      skillId: null,
      designSystemId: null,
    };
    store.set('open-design:config', JSON.stringify(legacyConfig));

    const config = loadConfig();

    expect(config.mode).toBe('api');
    expect(config.baseUrl).toBe('https://api.deepseek.com');
    expect(config.model).toBe('deepseek-chat');
    expect(config.apiProtocol).toBe('openai');
  });

  it('migrates legacy Anthropic API configs to an explicit apiProtocol', () => {
    const legacyConfig: Partial<AppConfig> = {
      mode: 'api',
      apiKey: 'sk-test',
      baseUrl: 'https://api.anthropic.com',
      model: 'claude-sonnet-4-5',
      agentId: null,
      skillId: null,
      designSystemId: null,
    };
    store.set('open-design:config', JSON.stringify(legacyConfig));

    const config = loadConfig();

    expect(config.apiProtocol).toBe('anthropic');
  });

  it('keeps apiProtocol unset in DEFAULT_CONFIG so missing saved config remains uncommitted', () => {
    expect(DEFAULT_CONFIG.apiProtocol).toBeUndefined();
  });
});
