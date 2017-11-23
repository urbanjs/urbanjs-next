# urbanjs-next
[![Build Status](https://travis-ci.org/urbanjs/urbanjs-next.svg?branch=master)](https://travis-ci.org/urbanjs/urbanjs-next)

## Installation

```
yarn add urbanjs-next
```

## What is `Next`?
`Next` is a concept which takes the [`Push system`](http://reactivex.io/rxjs/manual/overview.html#pull-versus-push) one step further.

In Push system, the value `Producer` (e.g. `Promise`, `Observable`)
determines when to send data to the `Consumer` and
the `Consumer` is unaware of when it will receive that data.
Values can be composed/altered via `Promise.then` or via `Operators` in case of `Observables`.

`Promise` or `Observable` are not necessarily the `Producer` but the `Observer` and the `Producer` are tightly coupled.

The `Next` concept relies on the `push system` but separates the `Producer` into `Request` and `Receiver`
following the [chain of responsibility](https://sourcemaking.com/design_patterns/chain_of_responsibility) pattern.
This way, **the `Observer` and `Producer` are loosely coupled**, to be more precise, the `Requests` and the `Observer`.

`Next` is not a new `push system` but a concept which can be implemented over both `Promise` and `Observable`.

### Why is it beneficial?

**With `Next`, complex flows can be composed from `Requests` depending
on their result prior to the execution**.
Each responsibility of an application (e.g. authentication, authorization, user creation)
can be handled by a flow separately and we can compose them as per the business logic requires.

### Examples

```javascript
import { NextOverPromise as Next } from 'urbanjs-next';

// service.js - compose a flow from requests (producer part 1)
function createComplexFlow(initialValue) {
  const next = new Next();
  next.value = initialValue || 1;

  return next
    .chain((value) =>
      new Next().chain(currentValue => currentValue + value))
    .chain((value) =>
      new Next().chain(currentValue => currentValue + value));
}

// controller.js - register consumers
function controller(req, reply){
  const flow = createComplexFlow(req.body.initialValue);

  flow.toPromise()
    .then((value) => reply(null, value))
    .catch((e) => reply(e));

  return flow;
}

// app.js - perform requests (producer part 2)
function receiver(observer, request) {
  // produce the value based on the request
  const value = request.value || Math.random();
  observer.next(value);

  // once the whole chain is executed
  // let consumer(s) know about the end result
  return () => observer.complete();
}

const request = { body: { initialValue: 1 } };
const flow = controller(request, console.log.bind(console);
flow.produce(receiver);
```

### Where does the name `Next` come from?
> There are only two hard things in Computer Science: cache invalidation and naming things. - Phil Karlton

reasons:
- A flow contains multiple requests, they come after each other one by one. The right question during the execution
is *what's coming `next`?*

- Also, `chain of responsibility` pattern chains the receivers together and then passes any request
from receiver to receiver usually using the `next` method. e.g `express`

- `Next` somehow represents the future just like `Promise` or `Deferred`
