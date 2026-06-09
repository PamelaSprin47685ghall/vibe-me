import type { AbortSuppressor } from '../util/abort.js';
import { STATE_TRANSITIONS } from './session-types.js';
import type { ReviewState, ReviewEvent, ReviewResult } from './session-types.js';

export class ReviewSessionNode implements Disposable {
  #state: ReviewState = 'Idle';
  
  get state(): ReviewState { return this.#state; }
  readonly createdAt = Date.now();
  originalTask?: string;
  lastFeedback?: string | null;
  parent?: ReviewSessionNode;
  readonly children = new Set<ReviewSessionNode>();
  private resolver?: (result: ReviewResult) => void;
  private _abortSuppressor?: AbortSuppressor;

  constructor(public readonly id: string) {}

  transition(event: ReviewEvent): boolean {
    const nextState = STATE_TRANSITIONS[this.#state]?.[event];
    if (!nextState) return false;
    this.#state = nextState;
    this.#onTransition(event, nextState);
    return true;
  }

  #onTransition(_event: ReviewEvent, newState: ReviewState): void {
    if (newState === 'Completed') this.completeResolution();
  }

  activate(task: string): void {
    this.originalTask = task;
    if (!this.transition('ACTIVATE')) {
      throw new Error(`Cannot activate from ${this.state}`);
    }
  }

  setPendingResolver(resolve: (result: ReviewResult) => void): void {
    this.resolver = resolve;
  }

  setAbortSuppressor(suppressor: AbortSuppressor): void {
    this._abortSuppressor = suppressor;
  }

  get abortSuppressor(): AbortSuppressor | undefined {
    return this._abortSuppressor;
  }

  completeResolution(result?: ReviewResult): void {
    if (this.resolver) {
      this.resolver(result ?? { accepted: true });
      this.resolver = undefined;
    }
    this._abortSuppressor?.restore();
    this._abortSuppressor = undefined;
  }

  addChild(child: ReviewSessionNode): void {
    this.children.add(child);
    child.parent = this;
  }

  [Symbol.dispose](): void {
    const stack: ReviewSessionNode[] = [this];
    while (stack.length > 0) {
      const node = stack.pop()!;
      if (node.resolver) {
        node.resolver({ accepted: false, terminated: true });
        node.resolver = undefined;
      }
      node._abortSuppressor?.restore();
      node._abortSuppressor = undefined;
      stack.push(...Array.from(node.children));
      node.children.clear();
    }
  }
}
