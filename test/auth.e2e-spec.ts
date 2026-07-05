import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { TokensDto } from './../src/auth/dto/tokens.dto';
import { AuthUser } from './../src/auth/auth.types';

/**
 * Full email/password auth flow against a throwaway PostgreSQL container.
 * Requires a running Docker daemon.
 */
describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let container: StartedPostgreSqlContainer;

  const credentials = { email: 'alice@example.com', password: 'S3curePass!' };

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();

    // AppModule's ConfigModule reads these when the module is compiled below.
    process.env.DATABASE_HOST = container.getHost();
    process.env.DATABASE_PORT = String(container.getPort());
    process.env.DATABASE_USER = container.getUsername();
    process.env.DATABASE_PASSWORD = container.getPassword();
    process.env.DATABASE_NAME = container.getDatabase();
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.JWT_ACCESS_TTL = '15m';
    process.env.JWT_REFRESH_TTL = '7d';

    // Loaded lazily so AppModule (and its eager ConfigModule.forRoot env
    // validation) is evaluated only after the env vars above are set.
    type AppModuleExports = typeof import('./../src/app.module');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AppModule } = require('./../src/app.module') as AppModuleExports;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    // Create the schema on the fresh container via TypeORM migrations.
    await app.get(DataSource).runMigrations();
  }, 180_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
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

  it('rejects duplicate registration with 409', () => {
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

  it('rejects /auth/me without a token', () => {
    return request(app.getHttpServer()).get('/auth/me').expect(401);
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
