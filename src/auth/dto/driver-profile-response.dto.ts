export class DriverProfileResponseDto {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  status: string;
  tenantId: string;
  tenantName: string;

  constructor(driverProfile: any, tenant: any) {
    this.id = driverProfile.id;
    this.firstName = driverProfile.firstName;
    this.lastName = driverProfile.lastName;
    this.phone = driverProfile.phone;
    this.status = driverProfile.status;
    this.tenantId = tenant.id;
    this.tenantName = tenant.name;
  }
}
