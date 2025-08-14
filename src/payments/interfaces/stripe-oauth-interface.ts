

export interface OAuthResponse {
    redirectUrl: string;
    state: string;
    expiresAt: Date;
}

export interface StripeCallbackRequest {
  code: string;         // Authorization code from Stripe
  state: string;        // Your CSRF token (returned by Stripe)
  scope?: string;       // Granted permissions (optional)
  error?: string;       // If user denied (optional)
  error_description?: string; // Error details (optional)
}

export interface OAuthCompleteResponse {
  success: boolean;
  accountId: string;           // Stripe account ID (acct_xxx)
  livemode: boolean;          // Test vs Live mode
  scope: string;              // Granted permissions
  connectedAt: Date;          // When connected
  message: string;            // Success/error message
}