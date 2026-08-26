import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import type { AuthUser } from './auth.types';
import { SiweService } from './siwe/siwe.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    register: jest.Mock;
    login: jest.Mock;
    refresh: jest.Mock;
  };
  let siweService: {
    createNonce: jest.Mock;
    verify: jest.Mock;
  };

  beforeEach(async () => {
    authService = {
      register: jest.fn(),
      login: jest.fn(),
      refresh: jest.fn(),
    };
    siweService = {
      createNonce: jest.fn(),
      verify: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: SiweService, useValue: siweService },
      ],
    }).compile();

    controller = moduleRef.get(AuthController);
  });

  it('delegates email registration, login, and refresh', async () => {
    const registerDto = { email: 'alice@example.com', password: 'password' };
    const loginDto = { email: 'alice@example.com', password: 'password' };
    const refreshDto = { refreshToken: 'refresh-token' };

    await controller.register(registerDto);
    await controller.login(loginDto);
    await controller.refresh(refreshDto);

    expect(authService.register).toHaveBeenCalledWith(registerDto);
    expect(authService.login).toHaveBeenCalledWith(loginDto);
    expect(authService.refresh).toHaveBeenCalledWith(refreshDto.refreshToken);
  });

  it('returns the current user passed by the JWT guard', () => {
    const user: AuthUser = { userId: 'user-1', email: 'alice@example.com' };

    expect(controller.me(user)).toBe(user);
  });

  it('delegates SIWE nonce creation and verification', async () => {
    const verifyDto = { message: 'siwe-message', signature: '0xsig' };

    await controller.siweNonce();
    await controller.siweVerify(verifyDto);

    expect(siweService.createNonce).toHaveBeenCalledWith();
    expect(siweService.verify).toHaveBeenCalledWith(verifyDto);
  });
});
