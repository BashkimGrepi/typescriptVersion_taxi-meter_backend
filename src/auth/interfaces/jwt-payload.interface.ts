


export interface DriverAccessJwtPayloadV1 {
    sub: string;        // userId
    tenantId: string;   // tenantId
    driverProfileId: string; // driverProfileId
    role: "DRIVER"; // role is always DRIVER for this payload
    type: "access"; // token type
    aud: string;    // JWT audience
    iss: string;    // JWT issuer
    iat: number;    // issued at (timestamp)
    exp: number;    // expiration (timestamp)
    jti: string;    // JWT ID (unique identifier for the token)
    ver: 1;          // version of the payload structureg
}

export interface JwtValidationResult {
    sub: string;        
    tenantId: string;
    driverProfileId: string;
    role: "DRIVER";
    jti?: string;    // optional JWT ID
}