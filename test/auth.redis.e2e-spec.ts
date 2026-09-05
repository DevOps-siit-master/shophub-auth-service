import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import request from 'supertest';
import { App } from 'supertest/types';
import { TokensDto } from './../src/auth/dto/tokens.dto';
import { AuthUser } from './../src/auth/auth.types';
import { SiweService } from './../src/auth/siwe/siwe.service';
import { REDIS_CLIENT } from './../src/persistence/persistence.module';
import Redis from 'ioredis';

/**
 * Same email/password flow as the Postgres suite, but against a throwaway Redis
 * container with DATABASE_KIND=redis — proves the Redis user adapter (secondary
 * email index + atomic uniqueness Lua) honors the same contract.
 */
describe('Auth (e2e, Redis)', () => {
  let app: INestApplication<App>;
  let container: StartedRedisContainer;

  const credentials = { email: 'alice@example.com', password: 'S3curePass!' };
  const siwe = {
    createNonce: jest.fn().mockResolvedValue({ nonce: 'e2e-nonce' }),
    verify: jest.fn().mockResolvedValue({
      accessToken: 'siwe-access-token',
      refreshToken: 'siwe-refresh-token',
    }),
  };

  beforeAll(async () => {
    container = await new RedisContainer('redis:7-alpine').start();

    process.env.DATABASE_KIND = 'redis';
    process.env.DATABASE_HOST = container.getHost();
    process.env.DATABASE_PORT = String(container.getMappedPort(6379));
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.JWT_ACCESS_TTL = '15m';
    process.env.JWT_REFRESH_TTL = '7d';

    type AppModuleExports = typeof import('./../src/app.module');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AppModule } = require('./../src/app.module') as AppModuleExports;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SiweService)
      .useValue(siwe)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  }, 180_000);

  afterAll(async () => {
    const redis: Redis = app?.get(REDIS_CLIENT, { strict: false });
    await redis?.quit();
    await app?.close();
    await container?.stop();
    delete process.env.DATABASE_KIND;
    delete process.env.DATABASE_HOST;
    delete process.env.DATABASE_PORT;
  });

  it('registers a new user and returns a token pair', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send(credentials)
      .expect(201);
    const body = res.body as TokensDto;
    expect(body.accessToken).toEqual(expect.any(String));
    expect(body.refreshToken).toEqual(expect.any(String));
  });

  it('rejects duplicate registration with 409 (atomic email uniqueness)', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send(credentials)
      .expect(409);
  });

  it('rejects a weak password with 400', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'bob@example.com', password: 'short' })
      .expect(400);
  });

  it('logs in with valid credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send(credentials)
      .expect(200);
    expect((res.body as TokensDto).accessToken).toEqual(expect.any(String));
  });

  it('rejects an invalid password with 401', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ ...credentials, password: 'wrong-password' })
      .expect(401);
  });

  it('returns the current user for a valid access token', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send(credentials)
      .expect(200);
    const { accessToken } = login.body as TokensDto;

    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const me = res.body as AuthUser;
    expect(me.email).toBe(credentials.email);
    expect(me.userId).toEqual(expect.any(String));
  });

  it('exchanges a valid refresh token for a new token pair', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send(credentials)
      .expect(200);
    const { refreshToken } = login.body as TokensDto;

    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(200);
    expect((res.body as TokensDto).accessToken).toEqual(expect.any(String));
  });
});
