/** @module NextOverPromise */

/** @hidden */
import { Deferred } from './utils';
import {
  Next,
  NextReceiver,
  TeardownLogic,
  ChainSuccessHandler,
  ChainFailureHandler
} from './types';

/**
 * Belongs to {@link NextOverPromise} class, internally used.
 */
export type Operator<TInput, TResult> = (receiver: NextReceiver<TInput>, promise: Promise<TInput>) => Promise<TResult>;

/**
 * Next implementation using Promises.
 */
export class NextOverPromise<T = any> implements Next<T> {
  protected operator: Operator<T, any>;
  protected hasReceiver: boolean = false;
  protected nextReceiverDeferred = new Deferred<NextReceiver<T>>();
  protected sharedResultPromise: Promise<T>;

  /**
   * Starts a new execution of this instance and returns a promise
   * which will be fulfilled once this instance and its chained requests are digested by the receiver.
   *
   * @desc Every invocation creates a new execution and
   *       the returned promises are independent
   *       (not [multicast](https://medium.com/@benlesh/hot-vs-cold-observables-f8094ed53339)).
   *
   * @see {@link NextOverPromise.produce}
   */
  public async toPromise(): Promise<T> {
    if (this.sharedResultPromise) {
      return this.sharedResultPromise;
    }

    const closedDeferred = new Deferred<null>();

    const nextReceiver = await this.nextReceiverDeferred.promise;

    const result = await this.produceNext(
      nextReceiver,
      this,
      () => closedDeferred.resolve(null)
    );

    await closedDeferred.promise;

    return result;
  }

  /**
   * Returns a new instance and registers a success or a failure handler.
   *
   * If a value is returned which is determined as the next request via {@link NextOverPromise.isNext}
   * then the value will be digested by the registered handler and the end result will be passed on.
   *
   * This method returns a clone of the original instance
   * whose methods do not take effect on the original instance.
   *
   * @see {@link NextOverPromise.produce}
   */
  public chain<TResult1 = T, TResult2 = never>(onSuccess?: ChainSuccessHandler<T, TResult1, this>,
                                               onFailure?: ChainFailureHandler<TResult2, this>): this {
    const wrap = async (nextReceiver: NextReceiver<T>, valueProducer: () => any) => {
      // use await to support PromiseLike result values
      const resultValue = await valueProducer();

      return this.isNext(resultValue)
        ? this.produceNext(nextReceiver, resultValue)
        : resultValue;
    };

    return this.lift<TResult1 | TResult2>(
      (nextReceiver: NextReceiver<T>, promise: Promise<T>) => {
        if (this.operator) {
          promise = this.operator(nextReceiver, promise);
        }

        return promise.then<TResult1, TResult2>(
          onSuccess ? (value: T) => wrap(nextReceiver, () => onSuccess(value)) : null,
          onFailure ? (reason: Error) => wrap(nextReceiver, () => onFailure(reason)) : null
        );
      }
    );
  }

  /**
   * Returns a new instance which
   * multicasts its end result among the registed consumers.
   *
   * This method returns a clone of the original instance
   * whose methods do not take effect on the original instance.
   *
   * @see {@link NextOverPromise.toPromise}
   */
  public share() {
    if (this.sharedResultPromise) {
      return this;
    }

    const clone = this.lift<T>();
    clone.sharedResultPromise = clone.toPromise();
    return clone;
  }

  /**
   * Registers the receiver to be used to digest the requests.
   *
   * @desc It does not start an execution unless
   *       consumers are registered via {@link NextOverPromise.toPromise} (lazy-execution).
   *
   * @see {@link NextOverPromise.toPromise}
   */
  public produce(receiver: NextReceiver<T>) {
    if (this.hasReceiver) {
      this.log(`${this.constructor.name} - only one receiver can be set`);
      throw new Error('invalid_state');
    }

    this.hasReceiver = true;
    this.nextReceiverDeferred.resolve(receiver);
  }

  /**
   * Clones the current instance and sets the given operator.
   *
   * Used by {@link NextOverPromise.chain}.
   */
  protected lift<R>(operator?: Operator<T, R>): this {
    // create new instance from the top-most prototype
    // to support derived classes
    const clone: this = Object.create(Object.getPrototypeOf(this));
    clone.nextReceiverDeferred = new Deferred<NextReceiver<T>>();
    clone.hasReceiver = false;
    clone.operator = operator || this.operator;

    return clone;
  }

  /**
   * Defines whether the given value is the next request or not.
   *
   * Used by {@link NextOverPromise.chain}.
   * @desc Might be overridden.
   */
  protected isNext(value: any): value is this {
    return !!(value && (value instanceof this.constructor));
  }

  /**
   * Executes the given request with the given receiver.
   * Optionally, accepts a completion handler which will be invoked
   * once the given value and its chain are digested.
   */
  protected async produceNext(nextReceiver: NextReceiver<T>,
                              request: any,
                              completionHandler?: () => void) {
    const resultDeferred = new Deferred<T>();

    const observer = {
      next(value: T) {
        // we do resolve every value but only the first will take effect
        // it is not necessary to validate if it is closed
        resultDeferred.resolve(value);
      },

      error(reason: Error) {
        resultDeferred.reject(reason);
      },

      complete() {
        if (completionHandler) {
          completionHandler();
        }
      }
    };

    let teardown: TeardownLogic | void;
    try {
      teardown = nextReceiver(observer, request);
    } catch (e) {
      // ignore error
      this.log(`${this.constructor.name} - unhandled error in the given receiver`);
    }

    try {
      return await (request && request.operator)
        ? request.operator(nextReceiver, resultDeferred.promise)
        : resultDeferred.promise;
    } finally {
      if (typeof teardown === 'function') {
        teardown();
      }
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
