import type { Thought } from './types';

export function formatRules(thoughts: Thought[]): string {
    if (!thoughts.length) return 'No rules are stored for this scope.';

    const rules = new Map<string, { thought: Thought; copies: number }>();
    for (const thought of thoughts) {
        const key = thought.content;
        const rule = rules.get(key);
        if (rule) {
            rule.copies++;
        } else {
            rules.set(key, { thought, copies: 1 });
        }
    }

    return [...rules.values()].map(({ thought, copies }) => {
        const repeated = copies > 1 ? ` (${copies} identical copies)` : '';
        return `#${thought.id}${repeated} ${thought.content}`;
    }).join('\n');
}
