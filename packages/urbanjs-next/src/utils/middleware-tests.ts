import * as expect from 'assert';
import { spy, SinonApi } from 'sinon';
import { MiddlewareChain } from './middleware';
import { noop } from './noop';

describe('unit tests', () => {
  describe('MiddlewareChain', () => {
    let chain: any;
    beforeEach(() => {
      chain = new MiddlewareChain();
    });

    describe('.use()', () => {
      describe('when middleware is given', () => {
        let isMiddlewareMock: SinonApi;
        beforeEach(() => {
          isMiddlewareMock = spy(() => true);
          chain.isMiddleware = isMiddlewareMock;
        });

        it('registers the given middleware', () => {
          chain.use(noop);

          expect.equal(isMiddlewareMock.calledOnce, true);
          expect.deepEqual(chain.middlewares, [noop]);
        });
      });

      describe('when error middleware is given', () => {
        let isErrorMiddlewareMock: SinonApi;
        beforeEach(() => {
          chain.isMiddleware = () => false;

          isErrorMiddlewareMock = spy(() => true);
          chain.isErrorMiddleware = isErrorMiddlewareMock;
        });

        it('registers the given middleware', () => {
          chain.use(noop);

          expect.equal(isErrorMiddlewareMock.calledOnce, true);
          expect.deepEqual(chain.errorMiddlewares, [noop]);
        });
      });

      describe('when multiple middlewares are given', () => {
        it('registers them', () => {
          chain.use(noop, noop);
          expect.deepEqual(chain.middlewares, [noop, noop]);
        });
      });

      describe('when invalid value is given', () => {
        beforeEach(() => {
          chain.isMiddleware = () => false;
          chain.isErrorMiddleware = () => false;
        });

        it('logs', () => {
          const logMock: SinonApi = spy();
          chain.log = logMock;

          try {
            chain.use(noop);
          } catch (e) {
            expect.equal(logMock.calledOnce, true);
            expect.equal(logMock.calledWith('Middleware function is not valid', noop), true);
          }
        });

        it('throws', () => {
          expect.throws(
            () => chain.use(noop),
            /invalid_middleware/
          );
        });
      });
    });

    describe('.handle()', () => {
      it('returns void', () => {
        chain.use(noop);
        expect.equal(chain.handle(), undefined);
      });

      describe('when middleware(s) returns a teardown logic', () => {
        it('returns a method which executes them in the order of middlewares', () => {
          const teardown1 = spy(noop);
          const teardown2 = spy(noop);
          const teardown3 = spy(noop);
          const teardown4 = spy(noop);

          chain.use(((a, b, n) => {
            // call synchronously
            n();
            return teardown1;
          }));

          chain.use(((a, b, n) => {
            // call asynchronously
            setTimeout(n, 0);

            return teardown2;
          }));

          chain.use((() => teardown3));

          // this middleware, so its teardown, won't run
          // previous did not called next
          chain.use((() => teardown4));

          const result = chain.handle();
          expect.equal(typeof result, 'function');
          expect.equal(teardown1.called, false);
          expect.equal(teardown2.called, false);
          expect.equal(teardown3.called, false);
          expect.equal(teardown4.called, false);

          result();
          expect.equal(teardown1.calledOnce, true);
          expect.equal(teardown2.calledOnce, true);
          expect.equal(teardown2.calledBefore(teardown1), true);
          expect.equal(teardown2.calledBefore(teardown3), true);
          expect.equal(teardown1.calledBefore(teardown3), true);
          expect.equal(teardown4.called, false);
        });

        describe('when a teardown logic throws', () => {
          it('ignores the error', () => {
            const teardown = spy(() => {
              throw new Error();
            });

            const middleware = spy(() => teardown);
            chain.use(middleware);
            const result = chain.handle();

            expect.equal(middleware.calledOnce, true);
            expect.equal(typeof result, 'function');
            expect.equal(teardown.called, false);

            result();
            expect.equal(teardown.calledOnce, true);
          });

          it('logs', () => {
            const logMock = spy();
            chain.log = logMock;

            const error = new Error();
            const teardown = spy(() => {
              throw error;
            });

            const middleware = spy(() => teardown);
            chain.use(middleware);
            chain.handle()();

            expect.equal(logMock.calledOnce, true);
            expect.equal(logMock.calledWith('Teardown logic failed', error), true);
          });
        });
      });

      describe('when no middleware is set', () => {
        it('logs', () => {
          const logMock: SinonApi = spy();
          chain.log = logMock;

          try {
            chain.handle(noop);
            expect.equal(false, true, 'expected to throw');
          } catch (e) {
            expect.equal(logMock.calledOnce, true);
            expect.equal(logMock.calledWith('Register middlewares first using .use method'), true);
          }
        });

        it('throws', () => {
          expect.throws(
            () => chain.handle(1, 1),
            /invalid_state/
          );
        });
      });

      describe('when middleware invokes next', () => {
        it('invokes next middleware', () => {
          const middleware1 = spy((a, b, n) => n());
          const middleware2 = spy((a, b, n) => n());

          chain.use(middleware1);
          chain.use(middleware2);
          chain.handle();

          expect.equal(middleware1.calledOnce, true);
          expect.equal(middleware2.calledOnce, true);
        });

        describe('with an error', () => {
          it('invokes the registered error middleware', () => {
            const error = new Error();
            const middleware1 = spy((a, b, n) => n(error));
            const middleware2 = spy((a, b, n) => n());
            const errorMiddleware = spy((err, a, b, n) => n());

            chain.use(middleware1);
            chain.use(middleware2);
            chain.use(errorMiddleware);
            chain.handle();

            expect.equal(middleware1.calledOnce, true);
            expect.equal(middleware2.called, false);
            expect.equal(errorMiddleware.calledOnce, true);
            expect.equal(errorMiddleware.calledWith(error), true);
          });
        });

        describe('when a middleware is registered after execution', () => {
          it('ignores the newly added middleware(s)', () => {
            const middleware1 = spy((a, b, n) => n());
            const middleware2 = spy((a, b, n) => n());
            const middleware3 = spy((a, b, n) => n());

            chain.use(middleware1);
            chain.use(middleware2);
            chain.handle();
            chain.use(middleware3);

            expect.equal(middleware1.calledOnce, true);
            expect.equal(middleware2.calledOnce, true);
            expect.equal(middleware3.called, false);
          });
        });
      });

      describe('when error middleware invokes next', () => {
        describe('and no more error middleware is registered', () => {
          it('chain ends', () => {
            const error = new Error();
            const middleware1 = spy((a, b, n) => n(error));
            const middleware2 = spy((a, b, n) => n());
            const errorMiddleware = spy((err, a, b, n) => n());

            chain.use(middleware1);
            chain.use(errorMiddleware);
            chain.use(middleware2);
            chain.handle();

            expect.equal(middleware1.calledOnce, true);
            expect.equal(middleware2.called, false);
            expect.equal(errorMiddleware.calledOnce, true);
            expect.equal(errorMiddleware.calledWith(error), true);
          });
        });

        describe('with error', () => {
          it('given error will be passed to the next error middleware', () => {
            const error1 = new Error();
            const error2 = new Error();
            const middleware1 = spy((a, b, n) => n(error1));
            const errorMiddleware1 = spy((err, a, b, n) => n(error2));
            const errorMiddleware2 = spy((err, a, b, n) => n());

            chain.use(middleware1);
            chain.use(errorMiddleware1);
            chain.use(errorMiddleware2);
            chain.handle();

            expect.equal(middleware1.calledOnce, true);
            expect.equal(errorMiddleware1.called, true);
            expect.equal(errorMiddleware1.calledWith(error1), true);
            expect.equal(errorMiddleware2.calledOnce, true);
            expect.equal(errorMiddleware2.calledWith(error2), true);
          });
        });

        describe('without error', () => {
          it('previous error will be passed to the next error middleware', () => {
            const error1 = new Error();
            const middleware1 = spy((a, b, n) => n(error1));
            const errorMiddleware1 = spy((err, a, b, n) => n());
            const errorMiddleware2 = spy((err, a, b, n) => n());

            chain.use(middleware1);
            chain.use(errorMiddleware1);
            chain.use(errorMiddleware2);
            chain.handle();

            expect.equal(middleware1.calledOnce, true);
            expect.equal(errorMiddleware1.called, true);
            expect.equal(errorMiddleware1.calledWith(error1), true);
            expect.equal(errorMiddleware2.calledOnce, true);
            expect.equal(errorMiddleware2.calledWith(error1), true);
          });
        });
      });
    });

    describe('.isMiddleware()', () => {
      [
        (a) => [a],
        (a, b) => [a, b],
        (a, b, c) => [a, b, c],
        (a, b, c, d) => [a, b, c, d]
      ].forEach((fn) => {
        const result = fn.length < 4;
        describe(`when a function with ${fn.length} arguments is given`, () => {
          it(`returns ${result}`, () => {
            expect.equal(chain.isMiddleware(fn), result);
          });
        });
      });
    });

    describe('.isErrorMiddleware()', () => {
      [
        (a) => [a],
        (a, b) => [a, b],
        (a, b, c) => [a, b, c],
        (a, b, c, d) => [a, b, c, d],
        (a, b, c, d, e) => [a, b, c, d, e]
      ].forEach((fn) => {
        const result = fn.length === 4;
        describe(`when a function with ${fn.length} arguments is given`, () => {
          it(`returns ${result}`, () => {
            expect.equal(chain.isErrorMiddleware(fn), result);
          });
        });
      });
    });
  });
});
