export const JWT_CONSTANTS = {
  TOKEN_TYPE: 'Bearer',
  ACCESS_TYPE: 'access',
  DRIVER_ROLE: 'DRIVER',
  VERSION: 1,
} as const;

export type JwtTokenType = typeof JWT_CONSTANTS.ACCESS_TYPE;
export type JwtRole = typeof JWT_CONSTANTS.DRIVER_ROLE;
