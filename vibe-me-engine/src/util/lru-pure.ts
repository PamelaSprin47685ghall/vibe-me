export class PureLRUStore<T> {
  private map = new Map<string, T>();

  constructor(private maxSize: number) {}

  set(key: string, value: T): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.maxSize) {
      const first = this.map.keys().next().value;
      this.map.delete(first);
    }
  }

  get(key: string): T | undefined {
    const value = this.map.get(key);
    if (value === undefined) return undefined;
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  consume(key: string): T | undefined {
    const value = this.map.get(key);
    if (value !== undefined) this.map.delete(key);
    return value;
  }

  delete(key: string): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}

export class ScopedLRUStore<T> {
  private scopes = new Map<string, PureLRUStore<T>>();

  constructor(
    private perScopeLimit: number,
    private globalScopeLimit: number
  ) {}

  store(scopeId: string, token: string, value: T): void {
    let scope = this.scopes.get(scopeId);
    if (!scope) {
      scope = new PureLRUStore<T>(this.perScopeLimit);
      this.scopes.set(scopeId, scope);
      if (this.scopes.size > this.globalScopeLimit) {
        const firstScope = this.scopes.keys().next().value;
        this.scopes.delete(firstScope);
      }
    } else {
      this.scopes.delete(scopeId);
      this.scopes.set(scopeId, scope);
    }
    scope.set(token, value);
  }

  consume(scopeId: string, token: string): T | undefined {
    const scope = this.scopes.get(scopeId);
    return scope?.consume(token);
  }

  clearScope(scopeId: string): void {
    this.scopes.delete(scopeId);
  }

  clear(): void {
    this.scopes.clear();
  }
}
