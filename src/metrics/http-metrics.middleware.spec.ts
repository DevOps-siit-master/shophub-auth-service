import type { Counter, Histogram } from 'prom-client';
import { HttpMetricsMiddleware } from './http-metrics.middleware';

type FinishCb = () => void;

describe('HttpMetricsMiddleware', () => {
  let inc: jest.Mock;
  let stopTimer: jest.Mock;
  let startTimer: jest.Mock;
  let middleware: HttpMetricsMiddleware;

  beforeEach(() => {
    inc = jest.fn();
    stopTimer = jest.fn();
    startTimer = jest.fn(() => stopTimer);
    middleware = new HttpMetricsMiddleware(
      { inc } as unknown as Counter<string>,
      { startTimer } as unknown as Histogram<string>,
    );
  });

  /** Builds a response stub that lets the test fire the 'finish' event. */
  const responder = (statusCode: number) => {
    let finish: FinishCb = () => {};
    const res = {
      statusCode,
      once: (_e: string, cb: FinishCb) => {
        finish = cb;
      },
    };
    return { res, finish: () => finish() };
  };

  it('records the matched route pattern, method and status on finish', () => {
    const next = jest.fn();
    const { res, finish } = responder(200);
    const req = { method: 'POST', baseUrl: '/auth', route: { path: '/login' } };

    middleware.use(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(inc).not.toHaveBeenCalled(); // nothing recorded until finish

    finish();
    const labels = { method: 'POST', route: '/auth/login', status_code: '200' };
    expect(inc).toHaveBeenCalledWith(labels);
    expect(stopTimer).toHaveBeenCalledWith(labels);
  });

  it('counts guard-rejected requests (401) that never reach a handler', () => {
    const { res, finish } = responder(401);
    const req = { method: 'GET', path: '/auth/me' };

    middleware.use(req, res, jest.fn());
    finish();
    expect(inc).toHaveBeenCalledWith({
      method: 'GET',
      route: '/auth/me',
      status_code: '401',
    });
  });

  it('surfaces the offending endpoint for unmatched 404s', () => {
    const { res, finish } = responder(404);
    const req = { method: 'GET', path: '/does/not/exist' };

    middleware.use(req, res, jest.fn());
    finish();
    expect(inc).toHaveBeenCalledWith({
      method: 'GET',
      route: '/does/not/exist',
      status_code: '404',
    });
  });

  it('falls back to "unknown" when neither route nor path is present', () => {
    const { res, finish } = responder(500);
    middleware.use({ method: 'POST' }, res, jest.fn());
    finish();
    expect(inc).toHaveBeenCalledWith({
      method: 'POST',
      route: 'unknown',
      status_code: '500',
    });
  });
});
