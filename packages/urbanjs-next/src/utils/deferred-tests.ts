import * as expect from 'assert';
import { SinonSpy, spy } from 'sinon';
import { Deferred } from './deferred';

describe('unit tests', () => {
  describe('Deferred', () => {
    let deferred: Deferred<number>;
    beforeEach(() => {
      deferred = new Deferred<number>();
    });

    it('has `promise`, `reject` and `resolve` properties', () => {
      expect.deepEqual(Object.keys(deferred), ['resolve', 'reject', 'promise']);
    });

    describe('when resolve is called', () => {
      it('promise is fulfilled', async () => {
        deferred.resolve(1);
        expect.equal(await deferred.promise, 1);
      });

      describe('when called multiple times', () => {
        let logMock: SinonSpy;

        beforeEach(() => {
          logMock = spy();
          Object.assign(deferred, {log: logMock});

          deferred.resolve(1);
          deferred.resolve(2);
          deferred.resolve(3);
        });

        it('first is used, rest are ignored', async () => {
          expect.equal(await deferred.promise, 1);
        });

        it('logs', () => {
          expect.equal(logMock.calledTwice, true);
          expect.equal(logMock.calledWith('Deferred - cannot be resolved/rejected multiple times.'), true);
        });
      });
    });

    describe('when reject is called', () => {
      it('promise is rejected', async () => {
        const error = new Error();

        try {
          deferred.reject(error);
          await deferred.promise;
          expect.equal(false, true, 'expected to throw');
        } catch (e) {
          expect.equal(e, error);
        }
      });
    });
  });
});
