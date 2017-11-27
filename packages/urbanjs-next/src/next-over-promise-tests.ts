import * as expect from 'assert';
import { NextOverPromise, Operator } from './next-over-promise';
import { spy, SinonSpy } from 'sinon';
import { Observer } from './types';
import { Deferred } from './utils';

const noop = () => null;

describe('unit tests', () => {
  describe('NextOverPromise', () => {
    // use type any to test protected methods as well
    let next: any;

    beforeEach(() => {
      next = new NextOverPromise();
    });

    describe('.toPromise()', () => {
      it('returns new Promises instances per invocation', () => {
        expect.equal(next.toPromise() instanceof Promise, true);

        expect.notStrictEqual(next.toPromise(), next.toPromise());
      });

      it('starts a new execution per invocation (once receiver is given)', async () => {
        const produceNextMock: SinonSpy = spy(next.produceNext);
        next.produceNext = produceNextMock;

        next.produce((observer: Observer<number>) => {
          observer.next(1);
          observer.complete();
        });

        await next.toPromise();
        await next.toPromise();
        await next.toPromise();

        expect.equal(produceNextMock.calledThrice, true);
      });

      describe('when instance is not completed (observer.complete)', () => {
        it.skip('does not fulfil the returned promise', () => {
          // TODO
        });
      });

      describe('when instance is rejected (observer.error)', () => {
        it('reject the returned promise', async () => {
          const error = new Error();
          next.produce((observer: Observer<number>) => {
            observer.error(error);
          });

          try {
            await next.toPromise();
            expect.equal(true, false, 'expected to throw');
          } catch (e) {
            expect.equal(e, error);
          }
        });
      });

      describe('when instance is completed', () => {
        it('fulfils the returned promise', async () => {
          next.produce((observer: Observer<number>) => {
            observer.next(1);
            observer.complete();
          });

          expect.equal(await next.toPromise(), 1);
        });
      });
    });

    describe('.chain()', () => {
      it('returns a clone', () => {
        expect.equal(next.chain() instanceof NextOverPromise, true);
        expect.notStrictEqual(next.chain(), next);
      });

      it('sets the operator', () => {
        expect.equal(typeof next.operator, 'undefined');
        expect.equal(typeof next.chain().operator, 'function');
      });

      describe('when operator is invoked', () => {
        it('invokes the operator of the original instance (if exist)', () => {
          const operatorMock = spy(() => new Promise(noop));
          next.operator = operatorMock;

          next.chain().operator(noop, new Promise(noop));
          expect.equal(operatorMock.calledOnce, true);
        });

        it('returns a promise extended with the given onSuccess and onFailure handlers', async () => {
          const clone = next.chain((value: number) => value + 1);
          const result = await clone.operator(noop, Promise.resolve(1));
          expect.equal(result, 2);
        });

        describe('and registered success handler returns the next request', () => {
          it('the request is handled', async () => {
            const isNextMock = spy((value: number) => value === 2);
            next.isNext = isNextMock;

            const produceNextMock = spy(() => true);
            next.produceNext = produceNextMock;

            const clone = next.chain((value: number) => value + 1);
            await clone.operator(noop, Promise.resolve(1));

            expect.equal(isNextMock.calledOnce, true);
            expect.equal(isNextMock.calledWith(2), true);

            expect.equal(produceNextMock.calledOnce, true);
            expect.equal(produceNextMock.calledWith(noop, 2), true);
          });
        });

        describe('and registered success handler returns a Promise of NextOverPromise value', () => {
          it('the value is handled', async () => {
            const isNextMock = spy((value: number) => value === 2);
            next.isNext = isNextMock;

            const produceNextMock = spy(() => true);
            next.produceNext = produceNextMock;

            const clone = next.chain(async (value: number) => value + 1);
            await clone.operator(noop, Promise.resolve(1));

            expect.equal(isNextMock.calledOnce, true);
            expect.equal(isNextMock.calledWith(2), true);

            expect.equal(produceNextMock.calledOnce, true);
            expect.equal(produceNextMock.calledWith(noop, 2), true);
          });
        });
      });
    });

    describe('.produce()', () => {
      it('sets the given receiver', async () => {
        next.produce(noop);
        expect.strictEqual(await next.nextReceiverDeferred.promise, noop);
      });

      describe('when called multiple times', () => {
        it('throws', () => {
          next.produce(noop);

          try {
            next.produce(noop);
            expect.equal(false, true, 'expected to throw');
          } catch (e) {
            expect.equal(e.message, 'invalid_state');
          }
        });

        it('logs a warning', () => {
          const logMock = spy();
          next.log = logMock;
          next.produce(noop);

          try {
            next.produce(noop);
            expect.equal(false, true, 'expected to throw');
          } catch (e) {
            expect.equal(logMock.calledOnce, true);
            expect.equal(logMock.calledWith('NextOverPromise - only one receiver can be set'), true);
          }
        });
      });
    });

    describe('.isNext()', () => {
      describe('when given value is instance of NextOverPromise', () => {
        it('returns true', () => {
          expect.equal(next.isNext(next), true);
        });
      });

      describe('when given value is derived class of the current instance', () => {
        it('returns true', () => {
          class A extends NextOverPromise {
            public isNext(value: any): value is this {
              return super.isNext(value);
            }
          }

          const a = new A();
          expect.equal(next.isNext(a), true);
          expect.equal(a.isNext(next), false);
        });
      });

      [
        null,
        undefined,
        [],
        {},
        1,
        true,
        '',
        'string',
        /regexp/
      ].forEach((value) => {
        describe(`when ${JSON.stringify(value)} is given`, () => {
          it('returns false', () => {
            expect.equal(next.isNext(value), false);
          });
        });
      });
    });

    describe('.lift()', () => {
      it('clones the current instance', () => {
        const clone = next.lift(noop);
        expect.strictEqual(clone.operator, noop);
        expect.equal(clone.nextReceiverDeferred instanceof Deferred, true);
        expect.notStrictEqual(clone.nextReceiverDeferred, next.nextReceiverDeferred);
      });

      describe('when derived class is the instance', () => {
        it('creates the instance from the top-most prototype', () => {
          class A<T> extends NextOverPromise<T> {
            public method() {
              return 1;
            }

            public lift<R>(operator: Operator<T, R>): this {
              return super.lift(operator);
            }
          }

          const a = new A();
          const cloneA = a.lift(() => Promise.resolve(1));
          expect.equal(cloneA.method(), 1);
        });
      });
    });

    describe('.produceNext()', () => {
      it('given receiver is called with an observer and the request', () => {
        const receiver = spy();
        const request = {};

        next.produceNext(receiver, request);
        expect.equal(receiver.calledOnce, true);
        expect.equal(receiver.args[0][1], request);
        expect.deepEqual(Object.keys(receiver.args[0][0]), ['next', 'error', 'complete']);
      });

      it('returns a promise', () => {
        expect.equal(next.produceNext(noop, {}) instanceof Promise, true);
      });

      describe('when observer.next is called', () => {
        it('fulfils the result promise', async () => {
          const promise = next.produceNext(
            (observer: Observer<number>) => observer.next(1),
            {}
          );

          expect.equal(await promise, 1);
        });
      });

      describe('when observer.error is called', () => {
        it('rejects the result promise', async () => {
          const error = new Error();

          try {
            await next.produceNext(
              (observer: Observer<number>) => observer.error(error),
              {}
            );
            expect.equal(true, false, 'expected to throw');
          } catch (e) {
            expect.equal(e, error);
          }
        });
      });

      describe('when observer.complete is called', () => {
        describe('and `completionHandler` is given', () => {
          it('invokes it', async () => {
            const completionHandler = spy();

            next.produceNext(
              (observer: Observer<number>) => observer.complete(),
              {},
              completionHandler
            );

            expect.equal(completionHandler.calledOnce, true);
          });
        });
      });

      describe('when request has `operator` property', () => {
        const operatorResult = {};
        let operator: SinonSpy;
        let request: NextOverPromise;

        beforeEach(() => {
          operator = spy(() => operatorResult);
          request = next.lift(operator);
        });

        it('calls the operator with the given receiver and a promise', async () => {
          await next.produceNext(noop, request);
          expect.equal(operator.calledOnce, true);
          expect.equal(operator.args[0][0], noop);
          expect.equal(operator.args[0][1] instanceof Promise, true);
        });

        it('returns the result of the `operator`', async () => {
          const result = await next.produceNext(noop, request);
          expect.strictEqual(result, operatorResult);
        });
      });

      describe('when given receiver throws', () => {
        it('ignores the error', () => {
          next.produceNext(
            () => {
              throw new Error();
            },
            {}
          );
        });

        it('logs the error', () => {
          const logMock = spy();
          next.log = logMock;

          next.produceNext(
            () => {
              throw new Error();
            },
            {}
          );

          expect.equal(logMock.calledOnce, true);
          expect.equal(logMock.calledWith('NextOverPromise - unhandled error in the given receiver'), true);
        });
      });

      describe('when given receiver returns a teardown function', () => {
        describe('and promise is fulfilled', () => {
          it('invokes the teardown function', async () => {
            const teardown = spy();
            const receiver = spy((observer: Observer<number>) => {
              observer.next(1);
              return teardown;
            });

            await next.produceNext(
              receiver,
              {}
            );

            expect.equal(teardown.calledOnce, true);
          });
        });

        describe('and promise is rejected', () => {
          it('invokes the teardown function', async () => {
            const teardown = spy();
            const error = new Error();
            const receiver = spy((observer: Observer<number>) => {
              observer.error(error);
              return teardown;
            });

            try {
              await next.produceNext(
                receiver,
                {}
              );

              expect.equal(true, false, 'expected to throw');
            } catch (e) {
              expect.strictEqual(e, error);
              expect.equal(teardown.calledOnce, true);
            }
          });
        });
      });
    });
  });
});
