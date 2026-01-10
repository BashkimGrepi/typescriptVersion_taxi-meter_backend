


export interface UnifiedJwtPayload {
    sub: string;
    email: string; // user email
    tenantId: string;   // tenantId
    tenantName: string; // tenantName
    driverProfileId?: string; // driverProfileId
    role: "DRIVER" | "ADMIN" | "MANAGER"; // user role
    type: "access"; // token type
    aud: string;    // JWT audience
    iss: string;    // JWT issuer
    iat: number;    // issued at (timestamp)
    exp: number;    // expiration (timestamp)
    jti: string;    // JWT ID (unique identifier for the token)
    ver: 1;          // version of the payload structureg
}


// maybe later
export interface JwtValidationResult {
    sub: string;        
    tenantId: string;
    email: string;
    tenantName: string;
    driverProfileId: string;
    role: "DRIVER" | "ADMIN" | "MANAGER";
    jti?: string;    // optional JWT ID
}