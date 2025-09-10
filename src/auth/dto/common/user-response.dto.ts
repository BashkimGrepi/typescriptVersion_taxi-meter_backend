export class UserResponseDto {
  id: string;
  email: string;
  roles: { role: string; tenantId: string; tenantName: string }[];

  constructor(user: any) {
    this.id = user.id;
    this.email = user.email;
    this.roles = user.roles;
  }
}
