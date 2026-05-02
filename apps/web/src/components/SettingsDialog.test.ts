import { describe, expect, it } from 'vitest';
import { KNOWN_PROVIDERS } from '../state/config';
import type { ApiProtocol, AppConfig } from '../types';

function switchApiProtocol(config: AppConfig, protocol: ApiProtocol): AppConfig {
  const currentIsKnown = KNOWN_PROVIDERS.some((p) => p.baseUrl === config.baseUrl);
  const provider = KNOWN_PROVIDERS.find((p) => p.protocol === protocol);
  return {
    ...config,
    mode: 'api',
    apiProtocol: protocol,
    ...(currentIsKnown && provider ? { baseUrl: provider.baseUrl, model: provider.model } : {}),
  };
}

const baseConfig: AppConfig = {
  mode: 'api',
  apiKey: 'sk-test',
  apiProtocol: 'anthropic',
  baseUrl: 'https://api.anthropic.com',
  model: 'claude-sonnet-4-5',
  agentId: null,
  skillId: null,
  designSystemId: null,
};

describe('SettingsDialog API protocol switching', () => {
  it('preserves custom baseUrl and model when switching protocol tabs', () => {
    const config: AppConfig = {
      ...baseConfig,
      baseUrl: 'https://my-proxy.example.com',
      model: 'my-model',
    };

    expect(switchApiProtocol(config, 'openai')).toMatchObject({
      mode: 'api',
      apiProtocol: 'openai',
      baseUrl: 'https://my-proxy.example.com',
      model: 'my-model',
    });
  });

  it('auto-fills the new protocol default when switching from a known provider', () => {
    expect(switchApiProtocol(baseConfig, 'openai')).toMatchObject({
      mode: 'api',
      apiProtocol: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
    });
  });
});
