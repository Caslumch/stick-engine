import { Module } from '@nestjs/common';
import { SpotifyCapability } from './spotify.capability';

@Module({
  providers: [SpotifyCapability],
  exports: [SpotifyCapability],
})
export class SpotifyModule {}
