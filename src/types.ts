export interface Env {
    DB: D1Database;
    VECTORIZE: VectorizeIndex;
    AI: Ai;
    EMBEDDING_MODEL?: string;
    MCP_AUTH_TOKEN?: string;
}

export type ThoughtType = 'convention' | 'instruction' | 'correction' | 'preference' | 'other';

export interface Thought {
    id: number;
    content: string;
    type: ThoughtType;
    topics_json: string;
    project: string | null;
    scope: string;
    created_at: string;
    updated_at: string;
}
