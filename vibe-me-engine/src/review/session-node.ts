import type { AbortSuppressor } from '../util/abort.js';
import {
  type ReviewState as ADTState,
  type ReviewCommand,
  inactive,
  activateCommand,
  matchReviewState,
} from '../types/review.js';
import { transition as pureTransition } from './state.js';

export interface ReviewResult {
  readonly accepted: boolean;
  readonly feedback?: string;
  readonly terminated?: boolean;
}

export class ReviewSessionNode implements Disposable {
  #state: ADTState = inactive;

  get state(): ADTState { return this.#state; }
  readonly createdAt = Date.now();
  originalTask?: string;
  lastFeedback?: string | null;
  parent?: ReviewSessionNode;
  readonly children = new Set<ReviewSessionNode>();
  private resolver?: (result: ReviewResult) => void;
  private _abortSuppressor?: AbortSuppressor;

  constructor(public readonly id: string) {}

  transition(command: ReviewCommand): boolean {
    const [nextState, _event] = pureTransition(this.#state, command);
    if (nextState === this.#state) return false;
    this.#state = nextState;
    this.#onTransition(nextState);
    return true;
  }

  #onTransition(newState: ADTState): void {
    matchReviewState(newState, {
      Inactive: () => {},
      Active: () => {},
      Locked: () => {},
      Completed: () => this.completeResolution(),
    });
  }

  activate(task: string): void {
    this.originalTask = task;
    if (!this.transition(activateCommand(task))) {
      throw new Error(`Cannot activate from ${this.state._tag}`);
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
