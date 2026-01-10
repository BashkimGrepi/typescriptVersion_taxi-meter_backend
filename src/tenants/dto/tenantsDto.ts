
export interface TenantSelectionsDto {
    tenants: TenantSelectionDto[];
}


export interface TenantSelectionDto {
    tenantId: string;
    name: string;
    businessId: string;
}