import { Module } from "@nestjs/common";
import { VivaWebhookService } from "./viva-webhook.service";
import { VivaWebhookController } from "./viva-webhook.controller";
import { PrismaModule } from "src/prisma/prisma.module";


@Module({
    imports: [PrismaModule],
    controllers: [VivaWebhookController],
    providers: [VivaWebhookService],
    exports: [VivaWebhookService],
})
export class VivaWebhookModule { }