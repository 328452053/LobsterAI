import { OpenClawApi, OpenClawProviderId } from './constants';

export const ModelRuntimeProfile = {
  MoonshotKimiK3: 'moonshot-kimi-k3',
} as const;
export type ModelRuntimeProfile =
  typeof ModelRuntimeProfile[keyof typeof ModelRuntimeProfile];

export const ModelCompatibilityMode = {
  Auto: 'auto',
  Standard: 'standard',
  MoonshotKimiK3: ModelRuntimeProfile.MoonshotKimiK3,
} as const;
export type ModelCompatibilityMode =
  typeof ModelCompatibilityMode[keyof typeof ModelCompatibilityMode];

export const ModelRuntimeProfileSource = {
  BuiltIn: 'built-in',
  Custom: 'custom',
  Server: 'server',
} as const;
export type ModelRuntimeProfileSource =
  typeof ModelRuntimeProfileSource[keyof typeof ModelRuntimeProfileSource];

export const LOBSTERAI_CLIENT_CAPABILITIES_HEADER = 'X-LobsterAI-Client-Capabilities';
export const LOBSTERAI_CLIENT_VERSION_HEADER = 'X-LobsterAI-Client-Version';
export const KIMI_K3_AGENTIC_CAPABILITY = 'kimi-k3-agentic-v1';

const KIMI_K3_REASONING_EFFORTS = [
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
] as const;

export const KIMI_K3_RUNTIME_PROFILE = {
  reasoning: true,
  input: ['text', 'image', 'video'],
  contextWindow: 1_048_576,
  maxTokens: 8_192,
  thinkingLevelMap: {
    off: null as null,
    minimal: 'max',
    low: 'max',
    medium: 'max',
    high: 'max',
    xhigh: 'max',
    max: 'max',
  },
  compat: {
    maxTokensField: 'max_tokens',
    supportsUsageInStreaming: false,
    requiresStringContent: true,
    supportsReasoningEffort: true,
    supportedReasoningEfforts: KIMI_K3_REASONING_EFFORTS,
  },
} as const;

export const MODEL_RUNTIME_PROFILES = {
  [ModelRuntimeProfile.MoonshotKimiK3]: KIMI_K3_RUNTIME_PROFILE,
} as const;

export type ModelRuntimeProfileDefinition =
  typeof MODEL_RUNTIME_PROFILES[ModelRuntimeProfile];

export interface ModelRuntimeProfileMetadata {
  supportsImage?: boolean;
  supportsVideo?: boolean;
  supportsThinking?: boolean;
  contextWindow?: number;
  maxTokens?: number;
}

export const getModelRuntimeProfileDefinition = (
  profile: ModelRuntimeProfile,
): ModelRuntimeProfileDefinition => MODEL_RUNTIME_PROFILES[profile];

export const applyModelRuntimeProfileMetadata = (
  metadata: ModelRuntimeProfileMetadata,
  profile: ModelRuntimeProfile | undefined,
): ModelRuntimeProfileMetadata => {
  if (!profile) {
    return metadata;
  }

  const definition = getModelRuntimeProfileDefinition(profile);
  return {
    ...metadata,
    supportsImage: definition.input.includes('image'),
    supportsVideo: definition.input.includes('video'),
    supportsThinking: definition.reasoning,
    contextWindow: definition.contextWindow,
    maxTokens: definition.maxTokens,
  };
};

const MODEL_RUNTIME_PROFILE_VALUES = new Set<string>(
  Object.values(ModelRuntimeProfile),
);
const MODEL_COMPATIBILITY_MODE_VALUES = new Set<string>(
  Object.values(ModelCompatibilityMode),
);

export const parseModelRuntimeProfile = (
  value: unknown,
): ModelRuntimeProfile | undefined => (
  typeof value === 'string' && MODEL_RUNTIME_PROFILE_VALUES.has(value)
    ? value as ModelRuntimeProfile
    : undefined
);

export const parseModelCompatibilityMode = (
  value: unknown,
): ModelCompatibilityMode | undefined => (
  typeof value === 'string' && MODEL_COMPATIBILITY_MODE_VALUES.has(value)
    ? value as ModelCompatibilityMode
    : undefined
);

export const normalizeModelIdForComparison = (modelId: string): string =>
  modelId.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

const OFFICIAL_MOONSHOT_HOSTNAMES = new Set([
  'api.moonshot.cn',
  'api.moonshot.ai',
]);

export const isOfficialMoonshotChatCompletionsUrl = (
  value: string,
): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && OFFICIAL_MOONSHOT_HOSTNAMES.has(url.hostname)
      && url.port === ''
      && url.username === ''
      && url.password === ''
      && (url.pathname === '/v1' || url.pathname === '/v1/')
      && url.search === ''
      && url.hash === '';
  } catch {
    return false;
  }
};

export interface ResolveModelRuntimeProfileInput {
  source: ModelRuntimeProfileSource;
  providerId: string;
  modelId: string;
  api: string;
  baseUrl: string;
  codingPlanEnabled?: boolean;
  compatibilityMode?: ModelCompatibilityMode;
  serverRuntimeProfile?: unknown;
}

const isKimiK3ModelId = (modelId: string): boolean =>
  normalizeModelIdForComparison(modelId) === 'kimik3';

const isCustomProviderId = (providerId: string): boolean =>
  /^custom_\d+$/.test(providerId);

export const resolveModelRuntimeProfile = ({
  source,
  providerId,
  modelId,
  api,
  baseUrl,
  codingPlanEnabled = false,
  compatibilityMode,
  serverRuntimeProfile,
}: ResolveModelRuntimeProfileInput): ModelRuntimeProfile | undefined => {
  if (api !== OpenClawApi.OpenAICompletions) {
    return undefined;
  }

  if (source === ModelRuntimeProfileSource.Server) {
    if (providerId !== OpenClawProviderId.LobsteraiServer) {
      return undefined;
    }
    return parseModelRuntimeProfile(serverRuntimeProfile);
  }

  const mode = compatibilityMode === undefined
    ? ModelCompatibilityMode.Auto
    : parseModelCompatibilityMode(compatibilityMode);
  if (!mode) {
    return undefined;
  }

  if (source === ModelRuntimeProfileSource.BuiltIn) {
    if (
      providerId !== OpenClawProviderId.Moonshot
      || codingPlanEnabled
    ) {
      return undefined;
    }

    if (isOfficialMoonshotChatCompletionsUrl(baseUrl)) {
      return isKimiK3ModelId(modelId)
        ? ModelRuntimeProfile.MoonshotKimiK3
        : undefined;
    }

    return mode === ModelCompatibilityMode.MoonshotKimiK3
      ? ModelRuntimeProfile.MoonshotKimiK3
      : undefined;
  }

  if (
    source !== ModelRuntimeProfileSource.Custom
    || !isCustomProviderId(providerId)
    || mode === ModelCompatibilityMode.Standard
  ) {
    return undefined;
  }

  if (mode === ModelCompatibilityMode.MoonshotKimiK3) {
    return ModelRuntimeProfile.MoonshotKimiK3;
  }

  return isKimiK3ModelId(modelId)
    ? ModelRuntimeProfile.MoonshotKimiK3
    : undefined;
};

export const KIMI_K3_RESERVED_CUSTOM_PARAM_KEYS = [
  'compat',
  'frequencyPenalty',
  'frequency_penalty',
  'maxCompletionTokens',
  'maxTokens',
  'max_completion_tokens',
  'max_tokens',
  'n',
  'presencePenalty',
  'presence_penalty',
  'reasoning',
  'reasoningEffort',
  'reasoning_effort',
  'requiresStringContent',
  'streamOptions',
  'stream_options',
  'supportedReasoningEfforts',
  'supportsReasoningEffort',
  'supportsUsageInStreaming',
  'temperature',
  'thinking',
  'thinkingLevelMap',
  'topP',
  'top_p',
] as const;

const KIMI_K3_RESERVED_CUSTOM_PARAM_KEY_SET = new Set<string>(
  KIMI_K3_RESERVED_CUSTOM_PARAM_KEYS,
);

export const findKimiK3ReservedCustomParamKeys = (
  customParams: Record<string, unknown> | undefined,
): string[] => {
  if (!customParams) {
    return [];
  }
  return Object.keys(customParams)
    .filter(key => KIMI_K3_RESERVED_CUSTOM_PARAM_KEY_SET.has(key))
    .sort();
};
