import { Controller, Get, Param, Request, UseGuards, ForbiddenException, NotFoundException, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantsService } from './tenants.service';
import { TenantSelectionsDto } from './dto/tenantsDto';

@ApiTags('tenants')
@ApiBearerAuth('JWT-auth')
@Controller('tenants')
@UseGuards(JwtAuthGuard)
export class TenantsController {
  constructor(private tenantsService: TenantsService) {}

  @Get('current')
  @ApiOperation({
    summary: 'Get current user\'s tenant information',
    description: 'Returns tenant details for the tenant associated with the current JWT token context.',
  })
  @ApiResponse({
    status: 200,
    description: 'Current tenant information retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' },
        name: { type: 'string', example: 'Test Taxi Company' },
        businessId: { type: 'string', example: '1234567-8' }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 404, description: 'Current tenant not found or user has no tenant context' })
  async getCurrentTenant(@Request() req) {
    if (!req.user.tenantId) {
      throw new NotFoundException('No current tenant context in token');
    }

    return this.tenantsService.getTenantById(req.user.tenantId);
  }

  @Get(':tenantId')
  @ApiOperation({
    summary: 'Get tenant information by ID',
    description: 'Returns tenant details (id, name, businessId) for the specified tenant. User must have access to this tenant.',
  })
  @ApiParam({ 
    name: 'tenantId', 
    description: 'UUID of the tenant to retrieve', 
    type: 'string',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
  })
  @ApiResponse({
    status: 200,
    description: 'Tenant information retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' },
        name: { type: 'string', example: 'Test Taxi Company' },
        businessId: { type: 'string', example: '1234567-8' }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - User does not have access to this tenant' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
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
