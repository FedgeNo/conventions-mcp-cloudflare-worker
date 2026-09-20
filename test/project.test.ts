import { describe, expect, it } from 'vitest';
import { projectFromPath, projectFromRequest } from '../src/project';

describe('projectFromPath', () => {
    it('matches the local server identifier for Unix paths', () => {
        expect(projectFromPath('/var/www/html')).toBe('-var-www-html');
    });

    it('accepts Windows absolute paths without treating relative paths as projects', () => {
        expect(projectFromPath('C:\\Projects\\site')).toBe('C:-Projects-site');
        expect(projectFromPath('projects/site')).toBeNull();
    });

    it('includes the machine name in remote project identity', () => {
        const request = new Request('https://example.test/mcp', {
            headers: {
                'X-Conventions-Project': '/var/www/html',
                'X-Conventions-Machine': 'fedora-dev',
            },
        });
        expect(projectFromRequest(request)).toBe('fedora-dev:-var-www-html');
        expect(projectFromRequest(new Request('https://example.test/mcp', {
            headers: { 'X-Conventions-Project': '/var/www/html' },
        }))).toBeNull();
    });
});
