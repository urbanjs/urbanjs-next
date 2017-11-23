/**
 * @see {@link https://github.com/tc39/proposal-observable#observer}
 */
export interface Observer<T> {
  next(value: T): void;
  error(err: Error): void;
  complete(): void;
}

/**
 * Handy type which allows the given type synchronously or asynchronously.
 */
export type SyncOrAsync<T> = T | PromiseLike<T>;

/**
 * Type of the returned value of chained handlers.
 * Allows the given type or class (synchronously or asynchronously).
 *
 * @see {@link Next.chain}
 */
export type ChainedValue<T, TClass> = SyncOrAsync<T> | SyncOrAsync<TClass>;

/**
 * Handler when previous chain succeeds.
 */
export type ChainSuccessHandler<TInput, TOutput, TClass> = (value: TInput) => ChainedValue<TOutput, TClass>;

/**
 * Handler when previous chain fails.
 */
export type ChainFailureHandler<TOutput, TClass> = (reason: Error) => ChainedValue<TOutput, TClass>;

/**
 * A function which will be called at the end of an execution.
 *
 * @see {@link NextReceiver}
 */
export type TeardownLogic = () => void;

/**
 * This method is invoked when the next request is being executed.
 * An observer is given which handles the emitted values ({@link Observer.next}),
 * raised error (({@link Observer.error}) or the completion ({@link Observer.complete}).
 * Also, it gets the request which needs to be handled as second argument.
 *
 * @see {@link Next.produce}
 */
export type NextReceiver<T> = (observer: Observer<T>, request: any) => void | TeardownLogic;

/**
 * An extension of the [Push system](http://reactivex.io/rxjs/manual/overview.html#pull-versus-push)
 * which allows to chain `Requests` along their results based on
 * the [chain of responsibility](https://sourcemaking.com/design_patterns/chain_of_responsibility) pattern.
 *
 * @see {@link https://github.com/urbanjs/urbanjs-next/tree/master/packages/urbanjs-next}
 */
export interface Next<T = any> {

  /**
   * Registers the given handlers.
   *
   * @desc It should return a new instance not to have any side effect (operator)
   */
  chain<TResult1 = T, TResult2 = never>(onSuccess?: ChainSuccessHandler<T, TResult1, this>,
                                        onFailure?: ChainFailureHandler<TResult2, this>): this;

  /**
   * Registers a `Consumer` and returns a Promise of the given type.
   * Returned promise will be resolved when the instance is executed.
   *
   * @desc Multiple invocation should return independent promises (not multicast).
   */
  toPromise(): Promise<T>;

  /**
   * Registers the receiver which will emit the result of the requests using the given observer.
   *
   * @desc It should not start an execution unless a `Consumer` is registered (lazy-execution).
   *
   * @see {@link Next.toPromise}
   */
  produce(receiver: NextReceiver<T>): void;
}
