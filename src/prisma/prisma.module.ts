import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // tekee palvelusta helposti käytettävän kaikkialla
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
