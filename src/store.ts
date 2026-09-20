import type { Env, Thought, ThoughtType } from './types';

const GLOBAL_SCOPE = 'global';

function scopes(project: string | null): string[] {
    return project ? [GLOBAL_SCOPE, `project:${project}`] : [GLOBAL_SCOPE];
}

function metadata(thought: Thought) {
    return {
        id: thought.id,
        project: thought.project ?? '',
        scope: thought.scope,
    };
}

export async function insertThought(
    env: Env,
    content: string,
    type: ThoughtType,
    topics: string[],
    project: string | null,
): Promise<Thought> {
    const result = await env.DB.prepare(
        `INSERT INTO thoughts (content, type, topics_json, project, scope)
         VALUES (?, ?, ?, ?, ?) RETURNING *`,
    ).bind(content, type, JSON.stringify(topics), project, project ? `project:${project}` : GLOBAL_SCOPE).first<Thought>();
    if (!result) throw new Error('The thought was not inserted');
    await indexThought(env, result);
    return result;
}

export async function updateThought(
    env: Env,
    id: number,
    content: string,
    type: ThoughtType,
    topics: string[],
    project: string | null,
): Promise<Thought> {
    const result = await env.DB.prepare(
        `UPDATE thoughts
         SET content = ?, type = ?, topics_json = ?, project = ?, scope = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ? RETURNING *`,
    ).bind(content, type, JSON.stringify(topics), project, project ? `project:${project}` : GLOBAL_SCOPE, id).first<Thought>();
    if (!result) throw new Error(`Thought #${id} was not found`);
    await indexThought(env, result);
    return result;
}

export async function deleteThought(env: Env, id: number): Promise<void> {
    const result = await env.DB.prepare('DELETE FROM thoughts WHERE id = ?').bind(id).run();
    if (!result.meta.changes) throw new Error(`Thought #${id} was not found`);
    await env.VECTORIZE.deleteByIds([String(id)]);
}

export async function listRules(env: Env, project: string | null): Promise<Thought[]> {
    const placeholders = scopes(project).map(() => '?').join(', ');
    const result = await env.DB.prepare(
        `SELECT * FROM thoughts WHERE scope IN (${placeholders}) ORDER BY id`,
    ).bind(...scopes(project)).all<Thought>();
    return result.results;
}

export async function listThoughts(env: Env, limit: number): Promise<Thought[]> {
    const result = await env.DB.prepare('SELECT * FROM thoughts ORDER BY id DESC LIMIT ?').bind(limit).all<Thought>();
    return result.results;
}

export async function stats(env: Env): Promise<Record<string, unknown>> {
    const total = await env.DB.prepare('SELECT COUNT(*) AS count FROM thoughts').first<{ count: number }>();
    const types = await env.DB.prepare('SELECT type, COUNT(*) AS count FROM thoughts GROUP BY type ORDER BY type').all();
    const projects = await env.DB.prepare('SELECT COALESCE(project, "global") AS project, COUNT(*) AS count FROM thoughts GROUP BY project ORDER BY project').all();
    return { total: total?.count ?? 0, types: types.results, projects: projects.results };
}

export async function searchThoughts(env: Env, query: string, limit: number, project: string | null): Promise<Thought[]> {
    const embedding = await env.AI.run(env.EMBEDDING_MODEL ?? '@cf/baai/bge-base-en-v1.5', { text: [query] });
    const vector = Array.isArray(embedding) ? embedding[0] : (embedding as { data: number[][] }).data[0];
    const matches = await Promise.all(scopes(project).map((scope) => env.VECTORIZE.query(vector, {
        topK: limit * 3,
        returnMetadata: 'all',
        filter: { scope },
    })));
    const ids = new Set(matches.flatMap((match) => match.matches.map((item) => Number(item.id))));
    const keyword = await env.DB.prepare(
        `SELECT * FROM thoughts WHERE scope IN (${scopes(project).map(() => '?').join(', ')}) AND content LIKE ? ORDER BY id DESC LIMIT ?`,
    ).bind(...scopes(project), `%${query}%`, limit * 3).all<Thought>();
    keyword.results.forEach((thought) => ids.add(thought.id));
    if (!ids.size) return [];
    const placeholders = [...ids].map(() => '?').join(', ');
    const rows = await env.DB.prepare(`SELECT * FROM thoughts WHERE id IN (${placeholders})`).bind(...ids).all<Thought>();
    const rank = new Map<number, number>();
    for (const group of matches) group.matches.forEach((match, index) => rank.set(Number(match.id), (rank.get(Number(match.id)) ?? 0) + 1 / (60 + index + 1)));
    keyword.results.forEach((thought, index) => rank.set(thought.id, (rank.get(thought.id) ?? 0) + 1 / (60 + index + 1)));
    return rows.results.sort((a, b) => (rank.get(b.id) ?? 0) - (rank.get(a.id) ?? 0)).slice(0, limit);
}

async function indexThought(env: Env, thought: Thought): Promise<void> {
    const embedding = await env.AI.run(env.EMBEDDING_MODEL ?? '@cf/baai/bge-base-en-v1.5', { text: [thought.content] });
    const vector = Array.isArray(embedding) ? embedding[0] : (embedding as { data: number[][] }).data[0];
    await env.VECTORIZE.upsert([{ id: String(thought.id), values: vector, metadata: metadata(thought) }]);
}
