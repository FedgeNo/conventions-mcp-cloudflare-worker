export function projectFromPath(path: string | null): string | null {
    if (!path || !isAbsolutePath(path)) return null;
    return path;
}

function isAbsolutePath(path: string): boolean {
    return path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path);
}

export function projectFromRequest(request: Request): string | null {
    const project = projectFromPath(request.headers.get('x-conventions-project'));
    const machine = request.headers.get('x-conventions-machine')?.trim();
    if (!project || !machine || !/^[A-Za-z0-9._-]+$/.test(machine)) return null;
    return `${machine}:${project}`;
}
