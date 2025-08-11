export class DriverProfileResponseDto {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  status: string;
  tenant: {
    id: string;
    name: string;
    businessId: string;
  };
  createdAt?: Date;
  updatedAt?: Date;

  constructor(driverProfile: any) {
    this.id = driverProfile.id;
    this.firstName = driverProfile.firstName;
    this.lastName = driverProfile.lastName;
    this.phone = driverProfile.phone;
    this.status = driverProfile.status;
    this.tenant = {
      id: driverProfile.tenant.id,
      name: driverProfile.tenant.name,
      businessId: driverProfile.tenant.businessId
    };
    // Optional timestamps
    if (driverProfile.createdAt) this.createdAt = driverProfile.createdAt;
    if (driverProfile.updatedAt) this.updatedAt = driverProfile.updatedAt;
  }
}
