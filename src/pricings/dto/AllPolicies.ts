export interface AllPolicies {
    meterPolicies: MeterPolicies[];
    fixedPricePolicies: FixedPricePolicies[];
    customFixedPricePolicies: {
        id: string
        amount: string;
        createdAt: string;
    }
}

interface MeterPolicies {
    id: string;
    tenantId: string;
    name: string;
    perKm: string;
    perMin: string;
    baseFare: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    tenant: {
        tenantName: string;
        businessId: string;
    }
}

interface FixedPricePolicies {
    id: string;
    tenantId: string;
    name: string;
    amount: string;
    createdAt: string;
    tenant: {
        tenantName: string;
        businessId: string;
    }
}