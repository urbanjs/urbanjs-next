/** @module Middleware */

/**
 * A function which will be called at the end of an execution.
 *
 * @see {@link Middleware}
 */
export type TeardownLogic = () => void;

/**
 * @see {@link Middleware}
 * @see {@link ErrorMiddleware}
 */
export type NextFunction = (err?: Error) => void;

/**
 * A middleware function with `request`, `response` and `next` function as arguments.
 * Invoke `next` if next middleware should handle the given request.
 */
export type Middleware<TRequest = any, TResponse = any> =
  (req: TRequest, res: TResponse, next: NextFunction) => void | TeardownLogic;

/**
 * An error middleware function with `error`, `request`, `response` and `next` function as arguments.
 * Invoke `next` if next error middleware should handle the given error.
 *
 * @desc If `next` is invoked without an error,
 *       the current error is passed on to the next error middleware.
 */
export type ErrorMiddleware<TRequest = any, TResponse = any> =
  (err: Error, req: TRequest, res: TResponse, next: NextFunction) => void | TeardownLogic;

/**
 * Middleware chain implementation analogous to [express middlewares]{@link https://expressjs.com}
 * for general purposes.
 *
 * @see [Examples]{@link https://github.com/urbanjs/urbanjs-next/tree/master/packages/urbanjs-next/examples}
 *      for further details
 */
export class MiddlewareChain<TRequest = any, TResponse = any> {
  protected middlewares: Array<Middleware<TRequest, TResponse>> = [];
  protected errorMiddlewares: Array<ErrorMiddleware<TRequest, TResponse>> = [];

  /**
   * Registers the given middlewares into the chain.
   *
   * @desc An error middleware is always called at the end of the chain once an error is presented.
   */
  public use(...middlewares: Array<Middleware<TRequest, TResponse> | ErrorMiddleware<TRequest, TResponse>>): this {
    middlewares.forEach((fn) => {
      if (this.isMiddleware(fn)) {
        this.middlewares.push(fn);
      } else if (this.isErrorMiddleware(fn)) {
        this.errorMiddlewares.push(fn);
      } else {
        this.log('Middleware function is not valid', fn);
        throw new Error('invalid_middleware');
      }
    });

    return this;
  }

  /**
   * Starts an execution of the given request.
   */
  public handle(req: TRequest, res: TResponse): TeardownLogic | void {
    if (this.middlewares.length < 1) {
      this.log('Register middlewares first using .use method');
      throw new Error('invalid_state');
    }

    // shallow copy current items
    // so newly registered middlewares won't take effect
    // on this execution
    // also add a method to the end which closes the execution
    const close = () => undefined;
    const middlewares = [...this.middlewares, close];
    const errorMiddlewares = [...this.errorMiddlewares, close];

    const teardowns: TeardownLogic[] = [];
    const teardown = () => {
      const value = teardowns.shift();

      if (value) {
        try {
          value();
        } catch (e) {
          this.log('Teardown logic failed', e);
        } finally {
          teardown();
        }
      }
    };

    let index = 0;
    let errorIndex = 0;
    let error: Error;

    const next: NextFunction = (err?: Error) => {
      error = err || error;

      const value: TeardownLogic | void = error
        ? errorMiddlewares[errorIndex++](error, req, res, next)
        : middlewares[index++](req, res, next);

      if (typeof value === 'function') {
        teardowns.push(value);
      }
    };

    next();

    if (teardowns.length) {
      return teardown;
    }
  }

  /**
   * Defines whether the given value should be determined as middleware.
   * @desc Might be overridden.
   */
  protected isMiddleware(value: any): value is Middleware {
    return typeof value === 'function' && value.length < 4;
  }

  /**
   * Defines whether the given value should be determined as error middleware.
   * @desc Might be overridden.
   */
  protected isErrorMiddleware(value: any): value is ErrorMiddleware {
    return typeof value === 'function' && value.length === 4;
  }

  /**
   * Handles internal logs.
   * @desc Might be overridden.
   */
  protected log(...args: any[]): void {
    // no-op by default
  }
}
