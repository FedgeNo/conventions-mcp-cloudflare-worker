import { describe, expect, it } from 'vitest';
import worker from '../src/index';
import type { Env } from '../src/types';

describe('MCP handshake', () => {
    it.each(['2025-11-25', '2026-07-28'])('delivers the rule-loading requirement on %s', async (version) => {
        const modern = version === '2026-07-28';
        const method = modern ? 'server/discover' : 'initialize';
        const clientInfo = { name: 'test-client', version: '1.0.0' };
        const params = modern ? {
            _meta: {
                'io.modelcontextprotocol/protocolVersion': version,
                'io.modelcontextprotocol/clientInfo': clientInfo,
                'io.modelcontextprotocol/clientCapabilities': {},
            },
        } : { protocolVersion: version, clientInfo, capabilities: {} };
        const pending: Promise<unknown>[] = [];
        const context = {
            waitUntil(promise: Promise<unknown>) { pending.push(promise); },
        } as unknown as ExecutionContext;
        const response = await worker.fetch(new Request('https://example.test/mcp', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer test-token',
                'Content-Type': 'application/json',
                Accept: 'application/json, text/event-stream',
                'MCP-Protocol-Version': version,
                'Mcp-Method': method,
            },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        }), { MCP_AUTH_TOKEN: 'test-token' } as Env, context);
        expect(response.status).toBe(200);
        const body = await response.text();
        const payload = response.headers.get('Content-Type')?.includes('text/event-stream')
            ? body.split('\n').find((line) => line.startsWith('data:'))!.slice(5).trim()
            : body;
        await Promise.all(pending);
        const { result } = JSON.parse(payload);
        expect(result.instructions).toContain('list_rules before any other tool');
        expect(result.instructions).toContain('repeat only after context reset');
        expect(result.instructions).toContain('Do only explicitly authorized work.');
    });
});
