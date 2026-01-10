import { Injectable } from "@nestjs/common";
import * as jwt from "jsonwebtoken";

@Injectable()

export class ReceiptLinkTokenService {

    private readonly secretKey = process.env.RECEIPT_LINK_TOKEN_SECRET || "default";

    sign(params: { publicId: string; tenantId: string; expiresInMinutes: number }) {
        const { publicId, tenantId, expiresInMinutes } = params;

        return jwt.sign(
            { publicId, tenantId, typ: "receipt-link" },
            this.secretKey,
            { expiresIn: `${expiresInMinutes}m` }
        );
    }

    verify(token: string): { publicId: string; tenantId: string; typ?: string } {
        const decoded = jwt.verify(token, this.secretKey) as any;
        return { publicId: decoded.publicId, tenantId: decoded.tenantId, typ: decoded.typ };
    }
    
}