import * as expect from 'assert';
import { NextOverPromise } from './index';
import { Observer } from './types';

describe('integration tests', () => {
  describe('NextOverPromise', () => {
    it('works properly', async () => {
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
});
