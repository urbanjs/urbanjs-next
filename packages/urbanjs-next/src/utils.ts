/** @module Next */

/** @hidden */
export const noop = () => null;

/**
 * @see {@link https://developer.mozilla.org/en-US/docs/Mozilla/JavaScript_code_modules/Promise.jsm/Deferred}
 */
export class Deferred<T> {
  public promise: Promise<T>;
  public resolve: (value: T) => void = noop;
  public reject: (reason: Error) => void = noop;

  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      let isCompleted = false;

      const wrap = (cb: () => void) => {
        if (isCompleted) {
          this.log(`${this.constructor.name} - cannot be resolved/rejected multiple times.`);
          return;
        }

        isCompleted = true;
        cb();
      };

      this.resolve = (value: T) => wrap(() => {
        resolve(value);
      });

      this.reject = (reason: Error) => wrap(() => {
        reject(reason);
      });
    });

    if (this.resolve === noop || this.reject === noop) {
      this.log(`${this.constructor.name} - invalid promise implementation`);
      throw new Error('invalid_promise');
    }
  }

  /**
   * Handles internal logs.
   * @desc Might be overridden.
   */
  protected log(...args: any[]) {
    // no-op by default
  }
}
