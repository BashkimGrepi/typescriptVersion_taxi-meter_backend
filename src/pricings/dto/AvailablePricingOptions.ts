// for mobile app

import { RidePricingMode } from "@prisma/client";

// before starting a ride the app fetches available pricing options for the driver
export interface AvailablePricingOptionsDto {
  meterPolicy: meterPolicy;   // only active meter policy shown
  fixedPricePolicies: fixedPricePolicies[]; // all the fixed polices available
  customFixedOption: customFixedOption; // custom fixed option available
}

interface meterPolicy {
  id: string;
  name: string;
  isActive: boolean;
  baseFare: string;
  perKm: string;
  perMin: string;
  description?: string; // needs to be added in the database
  mode: RidePricingMode;
  tenant: {
    id: string;
    name: string;
    businessId: string;
  }
}

interface fixedPricePolicies {
  id: string;
  name: string;
  amount: string;
  description?: string; // needs to be added in the database
  mode: RidePricingMode;
  tenant: {
    id: string;
    name: string;
    businessId: string;
  };
}

interface customFixedOption {
  // enabled: boolean;
  minAmount: string; // "5.00"
  maxAmount: string; // "999.99"
  description: string; // "Set your own fare amount"
  mode: RidePricingMode;
};

