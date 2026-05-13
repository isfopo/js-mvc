let scopeIdCounter = 0;

export function _clearStateBuffer(): void {
  scopeIdCounter = 0;
}

export function generateScopeId(name: string): string {
  return `${name}-${++scopeIdCounter}`;
}
