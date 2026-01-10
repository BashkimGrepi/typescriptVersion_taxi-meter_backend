import { Controller, ForbiddenException, Get, Query, Req, UnauthorizedException, UseGuards } from "@nestjs/common";
import { UniversalV1Guard } from "src/auth/guards/universal-v1.guard";
import { ReportsService } from "./reports.service";
import { SummaryDto, SummaryQueryDto } from "./dto/summary.dto";




@Controller('reports')
@UseGuards(UniversalV1Guard)
export class ReportsController {
    constructor(private reportsService: ReportsService) {}
    
    @Get('summary')
    async Summary(@Query() q: SummaryQueryDto, @Req() req): Promise<SummaryDto> {
        
        console.log("req.user = ", req.user);
        if (!req.user) throw new UnauthorizedException('Missing auth');

        
        const tenantId = req.user.tenantId ?? req.user.tid;
        if (!tenantId) throw new ForbiddenException('Missing tenant id on token');

        const from = new Date(q.from);
        const to = new Date(q.to);
        return this.reportsService.getSummary(from, to);
    }
} 