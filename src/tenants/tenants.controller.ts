import { Controller, Get, Param, Request, UseGuards, ForbiddenException, NotFoundException, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { UniversalV1Guard } from '../auth/guards/universal-v1.guard';
import { TenantsService } from './tenants.service';
import { TenantSelectionsDto } from './dto/tenantsDto';

@ApiTags('tenants')
@ApiBearerAuth('JWT-auth')
@Controller('tenants')
@UseGuards(UniversalV1Guard)
export class TenantsController {
  constructor(private tenantsService: TenantsService) {}

  @Get('current')
  async getCurrentTenant(@Request() req) {
    if (!req.user.tenantId) {
      throw new NotFoundException('No current tenant context in token');
    }

    return this.tenantsService.getTenantById(req.user.tenantId);
  }

  @Get(':tenantId')
  async getTenant(@Param('tenantId') tenantId: string, @Request() req) {
    // Authorization: user must have access to this tenant
    if (req.user.tenantId !== tenantId) {
      // For multi-tenant users, check if they have access to the requested tenant
      const hasAccess = req.user.roles?.some((role: any) => role.tenantId === tenantId);
      if (!hasAccess) {
        throw new ForbiddenException('You do not have access to this tenant');
      }
    }

    return this.tenantsService.getTenantById(tenantId);
  }


  @Post("select-tenant")
  async getMyTenants(@Request() req): Promise<TenantSelectionsDto> {
    const userId = req.user.sub;
    return this.tenantsService.getTenantsForUser(userId);
  }
}
