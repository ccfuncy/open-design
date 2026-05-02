import { isOpenAICompatible } from '../providers/openai-compatible';
import type { ApiProtocol, AppConfig, MediaProviderCredentials, PetConfig } from '../types';

const STORAGE_KEY = 'open-design:config';

// Hatched out of the box, but tucked away — the user has to go through
// either the entry-view "adopt a pet" callout or Settings → Pets to
// summon them. Keeps the workspace quiet for first-run users.
export const DEFAULT_PET: PetConfig = {
  adopted: false,
  enabled: false,
  petId: 'mochi',
  custom: {
    name: 'Buddy',
    glyph: '🦄',
    accent: '#c96442',
    greeting: 'Hi! I am here whenever you need me.',
  },
};

export const DEFAULT_CONFIG: AppConfig = {
  mode: 'daemon',
  apiKey: '',
  baseUrl: 'https://api.anthropic.com',
  model: 'claude-sonnet-4-5',
  // Keep apiProtocol unset in defaults so loadConfig() does not backfill it
  // into legacy saved configs. streamMessage() uses the legacy provider
  // heuristic whenever apiProtocol is absent.
  agentId: null,
  skillId: null,
  designSystemId: null,
  onboardingCompleted: false,
  theme: 'system',
  mediaProviders: {},
  agentModels: {},
  pet: DEFAULT_PET,
};

/** Well-known providers with pre-filled base URLs. */
export interface KnownProvider {
  label: string;
  protocol: ApiProtocol;
  baseUrl: string;
  /** Default model to apply when the provider is selected. */
  model: string;
  /** Optional provider-specific model choices shown in Settings. */
  models?: string[];
}

export const KNOWN_PROVIDERS: KnownProvider[] = [
  {
    label: 'Anthropic (Claude)',
    protocol: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-5',
    models: ['claude-sonnet-4-5', 'claude-opus-4-5', 'claude-haiku-4-5'],
  },
  {
    label: 'DeepSeek — Anthropic',
    protocol: 'anthropic',
    baseUrl: 'https://api.deepseek.com/anthropic',
    model: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-v4-flash', 'deepseek-v4-pro'],
  },
  {
    label: 'MiniMax — Anthropic',
    protocol: 'anthropic',
    baseUrl: 'https://api.minimaxi.com/anthropic',
    model: 'MiniMax-M2.7-highspeed',
    models: [
      'MiniMax-M2.7-highspeed',
      'MiniMax-M2.7',
      'MiniMax-M2.5-highspeed',
      'MiniMax-M2.5',
      'MiniMax-M2.1-highspeed',
      'MiniMax-M2.1',
      'MiniMax-M2',
    ],
  },
  {
    label: 'OpenAI',
    protocol: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini', 'o3', 'o4-mini'],
  },
  {
    label: 'DeepSeek — OpenAI',
    protocol: 'openai',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-v4-flash', 'deepseek-v4-pro'],
  },
  {
    label: 'MiniMax — OpenAI',
    protocol: 'openai',
    baseUrl: 'https://api.minimaxi.com/v1',
    model: 'MiniMax-M2.7-highspeed',
    models: [
      'MiniMax-M2.7-highspeed',
      'MiniMax-M2.7',
      'MiniMax-M2.5-highspeed',
      'MiniMax-M2.5',
      'MiniMax-M2.1-highspeed',
      'MiniMax-M2.1',
      'MiniMax-M2',
    ],
  },
  {
    label: 'MiMo (Xiaomi) — OpenAI',
    protocol: 'openai',
    baseUrl: 'https://token-plan-cn.xiaomimimo.com/v1',
    model: 'mimo-v2.5-pro',
    models: ['mimo-v2.5-pro'],
  },
  {
    label: 'MiMo (Xiaomi) — Anthropic',
    protocol: 'anthropic',
    baseUrl: 'https://token-plan-cn.xiaomimimo.com/anthropic',
    model: 'mimo-v2.5-pro',
    models: ['mimo-v2.5-pro'],
  },
];

function normalizePet(input: Partial<PetConfig> | undefined): PetConfig {
  if (!input) return { ...DEFAULT_PET, custom: { ...DEFAULT_PET.custom } };
  // Merge stored values onto defaults so newly-added fields land safely
  // when an older config is rehydrated.
  return {
    ...DEFAULT_PET,
    ...input,
    custom: { ...DEFAULT_PET.custom, ...(input.custom ?? {}) },
  };
}

export function loadConfig(): AppConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG, pet: normalizePet(DEFAULT_PET) };
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    const merged: AppConfig = {
      ...DEFAULT_CONFIG,
      ...parsed,
      mediaProviders: { ...(parsed.mediaProviders ?? {}) },
      agentModels: { ...(parsed.agentModels ?? {}) },
      pet: normalizePet(parsed.pet),
    };

    // One-time migration for configs saved before apiProtocol existed: make
    // the inferred protocol explicit so old OpenAI-compatible endpoints keep
    // routing correctly after the Settings UI splits protocol tabs.
    if (!merged.apiProtocol && merged.mode === 'api') {
      merged.apiProtocol = isOpenAICompatible(merged.model, merged.baseUrl) ? 'openai' : 'anthropic';
    }

    return merged;
  } catch {
    return { ...DEFAULT_CONFIG, pet: normalizePet(DEFAULT_PET) };
  }
}

export function saveConfig(config: AppConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function hasAnyConfiguredProvider(
  providers: Record<string, MediaProviderCredentials> | undefined,
): boolean {
  if (!providers) return false;
  return Object.values(providers).some((entry) =>
    Boolean(entry?.apiKey?.trim() || entry?.baseUrl?.trim()),
  );
}

export async function syncMediaProvidersToDaemon(
  providers: Record<string, MediaProviderCredentials> | undefined,
  options?: { force?: boolean },
): Promise<void> {
  if (!providers) return;
  try {
    await fetch('/api/media/config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providers, force: Boolean(options?.force) }),
    });
  } catch {
    // Daemon offline; localStorage keeps the user's copy for the next save.
  }
}
