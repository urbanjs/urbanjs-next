import * as expect from 'assert';
import { NextOverPromise } from './index';
import { Observer } from './types';
import { MiddlewareChain } from './utils';

describe('integration tests', () => {
  it('exposes api correctly', () => {
    expect.deepEqual(Object.keys(require('./index')), [
      'interfaces',
      'NextOverPromise',
      'Deferred',
      'MiddlewareChain'
    ]);
  });

  describe('NextOverPromise', () => {
    describe('when receiver is given directly', () => {
      it('flow is resolved correctly', async () => {
        const flow = new NextOverPromise<number>()
          .chain((value) => {
            const next = new NextOverPromise<number>()
              .chain((currentValue) => Promise.resolve(currentValue + value));

            next.value = 1;

            return next;
          })
          .chain((val: number) => {
            throw new Error(`${val}`);
          })
          .chain(null, (e: Error) =>
            new NextOverPromise<number>()
              .chain((currentValue) => currentValue + parseFloat(e.message))
          )
          .chain(async (value) =>
            new NextOverPromise<number>()
              .chain((currentValue) => currentValue + value)
          );

        // unused flow
        flow.chain(() => {
          // won't run
          throw new Error();
        });

        // register the receiver
        const values: number[] = [];
        const receiver = (observer: Observer<number>, request: NextOverPromise<number>) => {
          const value = request.value || Math.random();
          values.push(value);

          observer.next(value);

          return () => observer.complete();
        };

        flow.produce(receiver);

        // 1st execution
        expect.equal(await flow.toPromise(), values[0] + values[1] + values[2] + values[3]);
        expect.equal(values[1], 1);

        // 2nd execution
        expect.equal(await flow.toPromise(), values[4] + values[5] + values[6] + values[7]);
        expect.equal(values[5], 1);
      });
    });

    describe('when receiver chain is given (middleware chain)', async () => {
      it('flow is resolved correctly', async () => {
        class BaseRequest extends NextOverPromise {
          protected isNext(value) {
            // override isNext to determine
            // every subclass of BaseRequest as the next request
            return value instanceof BaseRequest;
          }
        }

        class RequestA extends BaseRequest {
        }

        class RequestB extends BaseRequest {
        }

        const app = new MiddlewareChain<BaseRequest, Observer>();

        // handle RequestA
        app.use((req: BaseRequest, res: Observer, next) => {
          if (req instanceof RequestA) {
            res.next(1);

            // mark as completed only when
            // this handler won't be called for this chain any more
            return () => res.complete();
          }

          next();
        });

        // handle RequestB
        app.use((req: BaseRequest, res: Observer, next) => {
          if (req instanceof RequestB) {
            res.next(2);

            // mark as completed only when
            // this handler won't be called for this chain any more
            return () => res.complete();
          }

          next();
        });

        const flow = new RequestA()
          .chain((value) => new RequestB().chain((currentValue) => value + currentValue))
          .chain((value) => new RequestA().chain((currentValue) => value + currentValue));

        flow.produce((observer: Observer, req: BaseRequest) => {
          return app.handle(req, observer);
        });

        expect.equal(await flow.toPromise(), 4);
      });
    });
  });
});
