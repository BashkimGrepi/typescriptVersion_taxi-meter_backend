import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { AdminRoleGuard } from "../guards/admin-role.guard";
import { AdminProfileService } from "../services/admin-profile.service";
import { AdminRoles } from "../decorators/admin-role.decorator";
import * as adminOrManagerDecorator from "../../decorators/admin-or-manager.decorator";
import { AdminProfileResponseDto } from "../dto/admin-profile-response.dto";


@Controller('admin/profile')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
@AdminRoles('ADMIN', 'MANAGER') 
export class AdminProfileController {
    constructor(private readonly profileService: AdminProfileService) { }
    
    @Get()
    async getProfile(@adminOrManagerDecorator.AdminOrManager() admin: adminOrManagerDecorator.AdminOrManagerInfo): Promise<AdminProfileResponseDto> {
        return this.profileService.getAdminProfile(admin);
    }
}
