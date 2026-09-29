import { describe, expect, it } from 'vitest';
import { formatRules } from '../src/rules';
import type { Thought, ThoughtType } from '../src/types';

function thought(id: number, content: string, project: string | null = null, type: ThoughtType = 'instruction'): Thought {
    return {
        id,
        content,
        type,
        topics_json: '["scope"]',
        project,
        scope: project ? `project:${project}` : 'global',
        created_at: '',
        updated_at: '',
    };
}

describe('formatRules', () => {
    it('groups identical applicable rules without changing their wording', () => {
        const output = formatRules([
            thought(1, 'Do only the requested work.'),
            thought(2, 'Do only the requested work.'),
            thought(3, 'Do only requested work.'),
            thought(4, 'Do only the requested work.', 'machine:/project', 'convention'),
        ]);

        expect(output).toBe([
            '#1 (3 identical copies) Do only the requested work.',
            '#3 Do only requested work.',
        ].join('\n'));
    });

    it('reports an empty rule set', () => {
        expect(formatRules([])).toBe('No rules are stored for this scope.');
    });
});
