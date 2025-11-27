// src/viva-webhook/viva-webhook.dto.ts
export type VivaEventName =
  | 'Transaction Payment Created'
  | 'Transaction Failed'
  | 'Transaction Reversal Created'
  | string;

// Flexible interface for webhook payload (no class-validator decorators)
export interface VivaWebhookPayload {
  Url?: string;
  EventTypeId?: number; // 1796 for "Transaction Payment Created"
  EventName?: VivaEventName;
  Created?: string; // ISO time
  RetryCount?: number | null;
  EventData?: {
    TransactionId?: string;
    OrderCode?: string;
    MerchantId?: string;
    Amount?: number; // total paid (includes fee)
    StatusId?: string; // expect "F" for finished
    CurrencyCode?: string | number; // "978" for EUR
    ReferenceNumber?: number;
    ResponseCode?: string; // "00" typical success
    // ... dozens of other fields – only pull what you need
  };
  [key: string]: any; // Allow any additional fields
}

export class VivaWebhookDto {
  EventTypeId!: number;
  EventData?: {
    TransactionId?: string;
    OrderCode?: string;
    StatusId?: string;
    Amount?: number;
    CurrencyCode?: string;
    MerchantId?: string;
    // Add other fields as needed
  };
}
