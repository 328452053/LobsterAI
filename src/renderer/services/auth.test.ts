import { ProviderName } from '@shared/providers';
import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  authService,
  mapAvailableServerModelsToModels,
  mapPricingCatalogTextModelsToServerModels,
  mapPricingCatalogToPublicServerModels,
} from './auth';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('pricing catalog model mapping', () => {
  test('maps public text models to locked server models', () => {
    const [model] = mapPricingCatalogTextModelsToServerModels([
      {
        modelId: 'qwen3.7-plus',
        modelName: 'Qwen3.7-Plus',
        provider: 'LobsterAI',
        providerLabel: 'LobsterAI Plan',
        description: 'Strong multimodal model',
        supportsImage: true,
        supportsThinking: true,
        contextWindow: 1_000_000,
        costMultiplier: 1.6,
      },
    ]);

    expect(model).toMatchObject({
      id: 'qwen3.7-plus',
      name: 'Qwen3.7-Plus',
      provider: 'LobsterAI Plan',
      providerKey: ProviderName.LobsteraiServer,
      isServerModel: true,
      accessible: false,
      description: 'Strong multimodal model',
      supportsImage: true,
      supportsThinking: true,
      contextWindow: 1_000_000,
      costMultiplier: 1.6,
    });
  });

  test('maps only textModels from the pricing catalog', () => {
    const models = mapPricingCatalogToPublicServerModels({
      textModels: [
        {
          modelId: 'MiniMax-M3',
          modelName: 'MiniMax M3',
        },
      ],
      imageModels: [
        {
          modelId: 'image-01',
          modelName: 'MiniMax-Image-01',
        },
      ],
      videoModels: [
        {
          modelId: 'happyhorse-1.0-i2v',
          modelName: 'HappyHorse',
        },
      ],
    });

    expect(models.map(model => model.id)).toEqual(['MiniMax-M3']);
    expect(models[0].accessible).toBe(false);
  });
});

describe('authenticated server model mapping', () => {
  test('preserves K3 runtime, modality, token, and agentic metadata', () => {
    const [model] = mapAvailableServerModelsToModels([{
      modelId: 'kimi-k3-YoudaoInner',
      modelName: 'Kimi K3',
      provider: 'moonshot',
      apiFormat: 'openai',
      runtimeProfile: 'moonshot-kimi-k3',
      supportsImage: true,
      supportsVideo: true,
      supportsThinking: true,
      supportsToolCalling: true,
      agenticReady: false,
      contextWindow: 1_048_576,
      maxTokens: 8_192,
      accessible: true,
    }]);

    expect(model).toMatchObject({
      id: 'kimi-k3-YoudaoInner',
      providerKey: ProviderName.LobsteraiServer,
      isServerModel: true,
      serverApiFormat: 'openai',
      runtimeProfile: 'moonshot-kimi-k3',
      supportsImage: true,
      supportsVideo: true,
      supportsThinking: true,
      supportsToolCalling: true,
      agenticReady: false,
      contextWindow: 1_048_576,
      maxTokens: 8_192,
      accessible: true,
    });
  });
});

describe('login diagnostics', () => {
  test('persists renderer lifecycle logs without including the login URL', async () => {
    const fromRenderer = vi.fn();
    const login = vi.fn().mockResolvedValue({ success: true });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.stubGlobal('window', {
      electron: {
        api: {
          fetch: vi.fn().mockResolvedValue({
            ok: true,
            data: { data: { value: 'https://lobsterai.youdao.com/portal#/login' } },
          }),
        },
        auth: { login },
        log: { fromRenderer },
      },
    });

    await authService.login();

    expect(login).toHaveBeenCalledWith('https://lobsterai.youdao.com/portal#/login');
    expect(fromRenderer).toHaveBeenCalledWith(
      'info',
      'AuthService',
      expect.stringMatching(/^login attempt \d+ started$/),
    );
    expect(fromRenderer).toHaveBeenCalledWith(
      'info',
      'AuthService',
      expect.stringMatching(/^login attempt \d+ handed off to the system browser$/),
    );
    expect(fromRenderer.mock.calls.flat().join(' ')).not.toContain('lobsterai.youdao.com');
  });

  test('records a warning while preserving the existing non-throwing IPC failure behavior', async () => {
    const fromRenderer = vi.fn();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('window', {
      electron: {
        api: {
          fetch: vi.fn().mockResolvedValue({
            ok: true,
            data: { data: { value: 'https://lobsterai.youdao.com/portal#/login' } },
          }),
        },
        auth: { login: vi.fn().mockResolvedValue({ success: false, error: 'open failed' }) },
        log: { fromRenderer },
      },
    });

    await expect(authService.login()).resolves.toBeUndefined();

    expect(fromRenderer).toHaveBeenCalledWith(
      'warn',
      'AuthService',
      expect.stringMatching(/^login attempt \d+ could not open the system browser$/),
    );
  });
});
