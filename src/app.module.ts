import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SankhyaModule } from './sankhya/sankhya.module';
import { RdStationModule } from './rd-station/rd-station.module';
import { SyncModule } from './sync/sync.module';
import { WebhookModule } from './webhook/webhook.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: process.env.NODE_ENV !== 'production',
    }),
    SankhyaModule,
    RdStationModule,
    SyncModule,
    WebhookModule,
  ],
})
export class AppModule {}