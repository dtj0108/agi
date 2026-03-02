/**
 * JSON schemas for structured cognitive phase outputs.
 */
export declare const THINK_SCHEMA: {
    type: string;
    additionalProperties: boolean;
    required: string[];
    properties: {
        thoughts: {
            type: string;
        };
        needsAction: {
            type: string;
        };
        userResponse: {
            type: string[];
        };
        emotionalShift: {
            type: string;
            additionalProperties: boolean;
            required: string[];
            properties: {
                primary: {
                    type: string;
                    additionalProperties: boolean;
                    required: string[];
                    properties: {
                        emotion: {
                            type: string;
                            minLength: number;
                        };
                        delta: {
                            type: string;
                            minimum: number;
                            maximum: number;
                        };
                    };
                };
                secondary: {
                    anyOf: ({
                        type: string;
                        additionalProperties: boolean;
                        required: string[];
                        properties: {
                            emotion: {
                                type: string;
                                minLength: number;
                            };
                            delta: {
                                type: string;
                                minimum: number;
                                maximum: number;
                            };
                        };
                    } | {
                        type: string;
                    })[];
                };
            };
        };
        actionIntent: {
            type: string[];
        };
    };
};
export declare const PLAN_SCHEMA: {
    type: string;
    additionalProperties: boolean;
    required: string[];
    properties: {
        goal: {
            type: string;
        };
        steps: {
            type: string;
            items: {
                type: string;
                additionalProperties: boolean;
                required: string[];
                properties: {
                    tool: {
                        enum: string[];
                    };
                    action: {
                        type: string;
                    };
                    params: {
                        type: string;
                    };
                    intent: {
                        type: string;
                    };
                };
            };
        };
        rollback: {
            type: string[];
        };
        emotionalContext: {
            type: string;
        };
    };
};
export declare const REFLECT_SCHEMA: {
    type: string;
    additionalProperties: boolean;
    required: string[];
    properties: {
        reflection: {
            type: string;
        };
        emotionalUpdate: {
            type: string;
            additionalProperties: boolean;
            required: string[];
            properties: {
                primary: {
                    type: string;
                    additionalProperties: boolean;
                    required: string[];
                    properties: {
                        emotion: {
                            type: string;
                            minLength: number;
                        };
                        delta: {
                            type: string;
                            minimum: number;
                            maximum: number;
                        };
                    };
                };
                secondary: {
                    anyOf: ({
                        type: string;
                        additionalProperties: boolean;
                        required: string[];
                        properties: {
                            emotion: {
                                type: string;
                                minLength: number;
                            };
                            delta: {
                                type: string;
                                minimum: number;
                                maximum: number;
                            };
                        };
                    } | {
                        type: string;
                    })[];
                };
            };
        };
        goalUpdate: {
            anyOf: ({
                type: string;
                additionalProperties: boolean;
                required: string[];
                properties: {
                    goalId: {
                        type: string;
                    };
                    progress: {
                        type: string;
                        minimum: number;
                        maximum: number;
                    };
                    notes: {
                        type: string;
                    };
                };
            } | {
                type: string;
                additionalProperties?: undefined;
                required?: undefined;
                properties?: undefined;
            })[];
        };
        skillLearned: {
            anyOf: ({
                type: string;
                additionalProperties: boolean;
                required: string[];
                properties: {
                    name: {
                        type: string;
                    };
                    description: {
                        type: string;
                    };
                    examples: {
                        type: string;
                        items: {
                            type: string;
                        };
                    };
                };
            } | {
                type: string;
                additionalProperties?: undefined;
                required?: undefined;
                properties?: undefined;
            })[];
        };
        skillAuthored: {
            anyOf: ({
                type: string;
                additionalProperties: boolean;
                required: string[];
                properties: {
                    name: {
                        type: string;
                        pattern: string;
                        description: string;
                    };
                    description: {
                        type: string;
                        description: string;
                    };
                    actions: {
                        type: string;
                        minItems: number;
                        items: {
                            type: string;
                            additionalProperties: boolean;
                            required: string[];
                            properties: {
                                name: {
                                    type: string;
                                };
                                description: {
                                    type: string;
                                };
                                params: {
                                    type: string;
                                    additionalProperties: {
                                        type: string;
                                        properties: {
                                            type: {
                                                type: string;
                                            };
                                            required: {
                                                type: string;
                                            };
                                            default: {};
                                            description: {
                                                type: string;
                                            };
                                        };
                                    };
                                };
                                implementation: {
                                    type: string;
                                    description: string;
                                };
                            };
                        };
                    };
                    reasoning: {
                        type: string;
                        description: string;
                    };
                };
            } | {
                type: string;
                additionalProperties?: undefined;
                required?: undefined;
                properties?: undefined;
            })[];
        };
        valueAlignment: {
            type: string;
            minimum: number;
            maximum: number;
        };
        lessonsLearned: {
            type: string;
            items: {
                type: string;
            };
        };
    };
};
export declare const PHASE_JSON_SCHEMAS: {
    think: {
        type: string;
        additionalProperties: boolean;
        required: string[];
        properties: {
            thoughts: {
                type: string;
            };
            needsAction: {
                type: string;
            };
            userResponse: {
                type: string[];
            };
            emotionalShift: {
                type: string;
                additionalProperties: boolean;
                required: string[];
                properties: {
                    primary: {
                        type: string;
                        additionalProperties: boolean;
                        required: string[];
                        properties: {
                            emotion: {
                                type: string;
                                minLength: number;
                            };
                            delta: {
                                type: string;
                                minimum: number;
                                maximum: number;
                            };
                        };
                    };
                    secondary: {
                        anyOf: ({
                            type: string;
                            additionalProperties: boolean;
                            required: string[];
                            properties: {
                                emotion: {
                                    type: string;
                                    minLength: number;
                                };
                                delta: {
                                    type: string;
                                    minimum: number;
                                    maximum: number;
                                };
                            };
                        } | {
                            type: string;
                        })[];
                    };
                };
            };
            actionIntent: {
                type: string[];
            };
        };
    };
    plan: {
        type: string;
        additionalProperties: boolean;
        required: string[];
        properties: {
            goal: {
                type: string;
            };
            steps: {
                type: string;
                items: {
                    type: string;
                    additionalProperties: boolean;
                    required: string[];
                    properties: {
                        tool: {
                            enum: string[];
                        };
                        action: {
                            type: string;
                        };
                        params: {
                            type: string;
                        };
                        intent: {
                            type: string;
                        };
                    };
                };
            };
            rollback: {
                type: string[];
            };
            emotionalContext: {
                type: string;
            };
        };
    };
    reflect: {
        type: string;
        additionalProperties: boolean;
        required: string[];
        properties: {
            reflection: {
                type: string;
            };
            emotionalUpdate: {
                type: string;
                additionalProperties: boolean;
                required: string[];
                properties: {
                    primary: {
                        type: string;
                        additionalProperties: boolean;
                        required: string[];
                        properties: {
                            emotion: {
                                type: string;
                                minLength: number;
                            };
                            delta: {
                                type: string;
                                minimum: number;
                                maximum: number;
                            };
                        };
                    };
                    secondary: {
                        anyOf: ({
                            type: string;
                            additionalProperties: boolean;
                            required: string[];
                            properties: {
                                emotion: {
                                    type: string;
                                    minLength: number;
                                };
                                delta: {
                                    type: string;
                                    minimum: number;
                                    maximum: number;
                                };
                            };
                        } | {
                            type: string;
                        })[];
                    };
                };
            };
            goalUpdate: {
                anyOf: ({
                    type: string;
                    additionalProperties: boolean;
                    required: string[];
                    properties: {
                        goalId: {
                            type: string;
                        };
                        progress: {
                            type: string;
                            minimum: number;
                            maximum: number;
                        };
                        notes: {
                            type: string;
                        };
                    };
                } | {
                    type: string;
                    additionalProperties?: undefined;
                    required?: undefined;
                    properties?: undefined;
                })[];
            };
            skillLearned: {
                anyOf: ({
                    type: string;
                    additionalProperties: boolean;
                    required: string[];
                    properties: {
                        name: {
                            type: string;
                        };
                        description: {
                            type: string;
                        };
                        examples: {
                            type: string;
                            items: {
                                type: string;
                            };
                        };
                    };
                } | {
                    type: string;
                    additionalProperties?: undefined;
                    required?: undefined;
                    properties?: undefined;
                })[];
            };
            skillAuthored: {
                anyOf: ({
                    type: string;
                    additionalProperties: boolean;
                    required: string[];
                    properties: {
                        name: {
                            type: string;
                            pattern: string;
                            description: string;
                        };
                        description: {
                            type: string;
                            description: string;
                        };
                        actions: {
                            type: string;
                            minItems: number;
                            items: {
                                type: string;
                                additionalProperties: boolean;
                                required: string[];
                                properties: {
                                    name: {
                                        type: string;
                                    };
                                    description: {
                                        type: string;
                                    };
                                    params: {
                                        type: string;
                                        additionalProperties: {
                                            type: string;
                                            properties: {
                                                type: {
                                                    type: string;
                                                };
                                                required: {
                                                    type: string;
                                                };
                                                default: {};
                                                description: {
                                                    type: string;
                                                };
                                            };
                                        };
                                    };
                                    implementation: {
                                        type: string;
                                        description: string;
                                    };
                                };
                            };
                        };
                        reasoning: {
                            type: string;
                            description: string;
                        };
                    };
                } | {
                    type: string;
                    additionalProperties?: undefined;
                    required?: undefined;
                    properties?: undefined;
                })[];
            };
            valueAlignment: {
                type: string;
                minimum: number;
                maximum: number;
            };
            lessonsLearned: {
                type: string;
                items: {
                    type: string;
                };
            };
        };
    };
};
//# sourceMappingURL=schemas.d.ts.map