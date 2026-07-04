import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validationSchema } from './config/env.validation';
import { buildDataSourceOptions } from './database/typeorm-options';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        buildDataSourceOptions({
          DATABASE_HOST: config.getOrThrow<string>('DATABASE_HOST'),
          DATABASE_PORT: config.getOrThrow<number>('DATABASE_PORT'),
          DATABASE_USER: config.getOrThrow<string>('DATABASE_USER'),
          DATABASE_PASSWORD: config.getOrThrow<string>('DATABASE_PASSWORD'),
          DATABASE_NAME: config.getOrThrow<string>('DATABASE_NAME'),
        }),
    }),
    HealthModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
