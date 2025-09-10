import { IsNotEmpty, IsString } from "class-validator";

export class SelectTenantDto {
    @IsNotEmpty()
    @IsString()
    tenantId!: string;

    @IsNotEmpty()
    @IsString()
    loginTicket!: string;
}
