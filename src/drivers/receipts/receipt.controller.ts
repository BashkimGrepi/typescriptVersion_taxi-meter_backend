import { Controller, Get, Header, Param, Post, Query, Request, Res, UseGuards } from "@nestjs/common";
import { UniversalV1Guard } from "src/auth/guards/universal-v1.guard";
import { ReceiptService } from "./receipt.service";
import { PublicReceiptQueryDto } from "./dtos/receipt";
import type Response from "express";
import { Public } from "src/decorators/public.decorator";




@Controller()
@UseGuards(UniversalV1Guard)
export class ReceiptController {
    constructor(private receiptService: ReceiptService) { }
    

    @Post("driver/receipts/:rideId/generate")
    async generateReceipt(
        @Request() req: any,
        @Param("rideId") rideId: string,
    ) {
        const userId = req.user.sub;
        const tenantId = req.user.tenantId;
    
        return this.receiptService.generateReceipt(rideId, tenantId, userId);
    }


    @Public()
    @Get("r/rcpt/:publicId")
    @Header("Content-Type", "text/html; charset=utf-8")
    async viewReceipt(
        @Param("publicId") publicId: string,
        @Query() query: PublicReceiptQueryDto,
        
    ) {
        const html = await this.receiptService.renderReceiptHtml({
            publicId,
            token: query.t,
        });

        return html;
    }
}