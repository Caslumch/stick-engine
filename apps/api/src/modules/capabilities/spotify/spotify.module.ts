import { Module } from '@nestjs/common';
import { SpotifyCapability } from './spotify.capability';
import { SpotifyController } from './spotify.controller';

@Module({
  controllers: [SpotifyController],
  providers: [SpotifyCapability],
  exports: [SpotifyCapability],
})
export class SpotifyModule {}
