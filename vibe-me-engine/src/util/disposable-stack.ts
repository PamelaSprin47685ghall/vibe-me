export class DisposableResource implements Disposable {
  #disposed = false;
  #cleanupFns: Array<() => void> = [];

  defer(fn: () => void): void {
    if (this.#disposed) {
      throw new Error('Cannot defer cleanup on disposed resource');
    }
    this.#cleanupFns.push(fn);
  }

  use<T extends Disposable>(resource: T): T {
    this.defer(() => resource[Symbol.dispose]());
    return resource;
  }

  [Symbol.dispose](): void {
    if (this.#disposed) return;
    this.#disposed = true;

    for (let i = this.#cleanupFns.length - 1; i >= 0; i--) {
      try {
        this.#cleanupFns[i]!();
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    }
    
    this.#cleanupFns = [];
  }
}

export class ReviewSessionNodeWithStack implements Disposable {
  #disposables = new DisposableResource();
  #state: 'Idle' | 'Active' | 'Disposed' = 'Idle';
  #children = new Set<ReviewSessionNodeWithStack>();

  constructor(public readonly id: string) {
    this.#disposables.defer(() => {
      console.log(`Disposing session ${this.id}`);
    });
  }

  addChild(child: ReviewSessionNodeWithStack): void {
    if (this.#state === 'Disposed') {
      throw new Error('Cannot add child to disposed session');
    }
    
    this.#children.add(child);
    this.#disposables.defer(() => {
      child[Symbol.dispose]();
      this.#children.delete(child);
    });
  }

  [Symbol.dispose](): void {
    if (this.#state === 'Disposed') return;
    this.#state = 'Disposed';
    this.#disposables[Symbol.dispose]();
  }
}
