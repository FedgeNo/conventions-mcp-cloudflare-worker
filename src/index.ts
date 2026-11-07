import { McpServer } from '@modelcontextprotocol/server';
import { createMcpHandler } from 'agents/mcp/server';
import { z } from 'zod';
import { projectFromRequest } from './project';
import { formatRules } from './rules';
import { deleteThought, insertThought, listRules, listThoughts, searchThoughts, stats, updateThought } from './store';
import type { Env, Thought, ThoughtType } from './types';

const thoughtType = z.enum(['convention', 'instruction', 'correction', 'preference', 'other']);

function text(thought: Thought): string {
    const topics = JSON.parse(thought.topics_json).join(', ');
    return `#${thought.id} (${thought.type}, ${thought.project ? `project: ${thought.project}` : 'global'}, topics: ${topics})\n   ${thought.content}`;
}

function createServer(env: Env, project: string | null) {
    const server = new McpServer({ name: 'conventions-mcp-cloudflare', version: '0.1.0' }, {
        instructions: 'Call the Cloudflare Conventions MCP server\'s list_rules before any other tool; repeat only after context reset. Do only explicitly authorized work. Suggest other work and wait for permission before doing it.',
    });
    server.registerTool('capture_thought', {
        description: 'Save one durable coding convention, standing instruction, correction, or workflow preference. Do not save task-specific directions or incident history.',
        inputSchema: {
            content: z.string().trim().min(1),
            type: thoughtType,
            topics: z.array(z.string().trim().min(1)).min(1).max(3),
            projectScoped: z.boolean().default(false),
        },
    }, async ({ content, type, topics, projectScoped }) => {
        if (projectScoped && !project) throw new Error('The MCP client did not provide valid X-Conventions-Project and X-Conventions-Machine headers');
        const thought = await insertThought(env, content, type as ThoughtType, topics, projectScoped ? project : null);
        return { content: [{ type: 'text' as const, text: `Captured verbatim:\n${text(thought)}` }] };
    });
    server.registerTool('update_thought', {
        description: 'Correct or refine one existing thought in place. Use the same id instead of delete plus capture.',
        inputSchema: {
            id: z.number().int().positive(), content: z.string().trim().min(1), type: thoughtType,
            topics: z.array(z.string().trim().min(1)).min(1).max(3), projectScoped: z.boolean().default(false),
        },
    }, async ({ id, content, type, topics, projectScoped }) => {
        if (projectScoped && !project) throw new Error('The MCP client did not provide valid X-Conventions-Project and X-Conventions-Machine headers');
        const thought = await updateThought(env, id, content, type as ThoughtType, topics, projectScoped ? project : null);
        return { content: [{ type: 'text' as const, text: `Updated verbatim:\n${text(thought)}` }] };
    });
    server.registerTool('delete_thought', {
        description: 'Permanently delete one thought. Only call this when the user explicitly requests deletion and the id is known.',
        inputSchema: { id: z.number().int().positive() },
    }, async ({ id }) => {
        await deleteThought(env, id);
        return { content: [{ type: 'text' as const, text: `Deleted thought #${id}.` }] };
    });
    server.registerTool('search_thoughts', {
        description: 'Search durable conventions and preferences by meaning and keyword. Include global and current-project rules.',
        inputSchema: { query: z.string().trim().min(1), limit: z.number().int().min(1).max(50).default(10) },
    }, async ({ query, limit }) => {
        const results = await searchThoughts(env, query, limit, project);
        return { content: [{ type: 'text' as const, text: results.length ? results.map(text).join('\n\n') : 'No matching thoughts.' }] };
    });
    server.registerTool('list_rules', {
        description: 'Retrieve every durable rule that applies globally or to the current project, in deterministic id order.',
        inputSchema: {},
    }, async () => {
        const results = await listRules(env, project);
        return { content: [{ type: 'text' as const, text: formatRules(results) }] };
    });
    server.registerTool('list_thoughts', {
        description: 'List recent thoughts for explicit management and review.',
        inputSchema: { limit: z.number().int().min(1).max(100).default(25) },
    }, async ({ limit }) => {
        const results = await listThoughts(env, limit);
        return { content: [{ type: 'text' as const, text: results.length ? results.map(text).join('\n') : 'No thoughts are stored.' }] };
    });
    server.registerTool('thought_stats', {
        description: 'Get counts by thought type and project.',
        inputSchema: {},
    }, async () => ({ content: [{ type: 'text' as const, text: JSON.stringify(await stats(env), null, 2) }] }));
    return server;
}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        if (!env.MCP_AUTH_TOKEN) return new Response('Service unavailable', { status: 503 });
        const authorization = request.headers.get('authorization');
        if (authorization !== `Bearer ${env.MCP_AUTH_TOKEN}`) return new Response('Unauthorized', { status: 401 });
        const handler = createMcpHandler((context) => {
            const project = context.requestInfo ? projectFromRequest(context.requestInfo) : null;
            return createServer(env, project);
        });
        return handler(request, env, ctx);
    },
} satisfies ExportedHandler<Env>;
