import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Cache } from "cache-manager";


@Injectable()
export class JwtRevocationService {
    private readonly ttlHours: number;

    constructor(
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private readonly config: ConfigService,
    ) {
        this.ttlHours = parseInt(this.config.get("REDIS_TTL_HOURS") || "12");
    }

    // Revoke a token by its JTI (JWT ID)
    async revokeToken(jti: string, exp: number): Promise<void> {
        const now = Math.floor(Date.now() / 1000);
        const ttlSeconds = Math.max(exp - now, 0);

        if (ttlSeconds > 0) {
          await this.cacheManager.set(`revoked:${jti}`, '1', ttlSeconds * 1000); // TTL in milliseconds
        }
    }

    // Check if a token is revoked
    async isTokenRevoked(jti: string): Promise<boolean> {
        const result = await this.cacheManager.get(`revoked:${jti}`);
        return result === '1'; // If found, token is revoked
    }

    async revokeAllUserTokens(userId: string): Promise<void> {
        const ttl = this.ttlHours * 3600 * 1000; // Convert hours to milliseconds
        await this.cacheManager.set(`user_revoked:${userId}`, Date.now().toString(), ttl);
    }

    async isUserRevoked(userId: string, iat: number): Promise<boolean> {
        const revokedAt = await this.cacheManager.get(`user_revoked:${userId}`);
        if (!revokedAt) return false;

        return iat < parseInt(revokedAt as string) / 1000; // Convert to seconds for comparison
    }
}