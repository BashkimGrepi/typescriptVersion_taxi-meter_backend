import { IsNotEmpty, IsString } from "class-validator";


export class SelectTenantDriverDto {
    @IsNotEmpty()
    @IsString()
    tenantId!: string;

    @IsNotEmpty()
    @IsString()
    loginTicket!: string;

}