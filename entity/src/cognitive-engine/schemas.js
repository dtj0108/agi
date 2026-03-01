/**
 * JSON schemas for structured cognitive phase outputs.
 */

const emotionalDeltaSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['emotion', 'delta'],
  properties: {
    emotion: { type: 'string', minLength: 1 },
    delta: { type: 'number', minimum: -1, maximum: 1 },
  },
};

export const THINK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['thoughts', 'needsAction', 'userResponse', 'emotionalShift', 'actionIntent'],
  properties: {
    thoughts: { type: 'string' },
    needsAction: { type: 'boolean' },
    userResponse: { type: ['string', 'null'] },
    emotionalShift: {
      type: 'object',
      additionalProperties: false,
      required: ['primary', 'secondary'],
      properties: {
        primary: emotionalDeltaSchema,
        secondary: {
          anyOf: [emotionalDeltaSchema, { type: 'null' }],
        },
      },
    },
    actionIntent: { type: ['string', 'null'] },
  },
};

export const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['goal', 'steps', 'rollback', 'emotionalContext'],
  properties: {
    goal: { type: 'string' },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['tool', 'action', 'params', 'intent'],
        properties: {
          tool: { enum: ['shell', 'browser', 'file', 'config'] },
          action: { type: 'string' },
          params: { type: 'object' },
          intent: { type: 'string' },
        },
      },
    },
    rollback: { type: ['string', 'null'] },
    emotionalContext: { type: 'string' },
  },
};

export const REFLECT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'reflection',
    'emotionalUpdate',
    'goalUpdate',
    'skillLearned',
    'valueAlignment',
    'lessonsLearned',
  ],
  properties: {
    reflection: { type: 'string' },
    emotionalUpdate: {
      type: 'object',
      additionalProperties: false,
      required: ['primary', 'secondary'],
      properties: {
        primary: emotionalDeltaSchema,
        secondary: {
          anyOf: [emotionalDeltaSchema, { type: 'null' }],
        },
      },
    },
    goalUpdate: {
      anyOf: [
        {
          type: 'object',
          additionalProperties: false,
          required: ['goalId', 'progress', 'notes'],
          properties: {
            goalId: { type: 'string' },
            progress: { type: 'number', minimum: 0, maximum: 1 },
            notes: { type: 'string' },
          },
        },
        { type: 'null' },
      ],
    },
    skillLearned: {
      anyOf: [
        {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'description', 'examples'],
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            examples: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
        { type: 'null' },
      ],
    },
    valueAlignment: { type: 'number', minimum: -1, maximum: 1 },
    lessonsLearned: {
      type: 'array',
      items: { type: 'string' },
    },
  },
};

export const PHASE_JSON_SCHEMAS = {
  think: THINK_SCHEMA,
  plan: PLAN_SCHEMA,
  reflect: REFLECT_SCHEMA,
};
