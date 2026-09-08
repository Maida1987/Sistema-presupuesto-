export interface DashboardSummary {
  indicators: {
    activeAccounts: number;
    totalReceivable: number;
    pendingSettlementDeliveryNotes: number;
    productsCount: number;
    suppliersCount: number;
    priceListsCount: number;
  };
  recentDeliveryNotes: {
    id: string;
    number: number;
    series: string;
    issuedAt: string;
    status: string;
    customerName: string;
  }[];
  recentPayments: {
    id: string;
    paymentDate: string;
    amount: number;
    customerName: string;
  }[];
  significantPriceChanges: {
    productId: string;
    productDescription: string;
    previousPrice: number;
    newPrice: number;
    percentChange: number;
  }[];
  alerts: {
    staleSupplierLists: { supplierId: string; supplierName: string; lastImportedAt: string | null }[];
    productsWithoutPrice: number;
    unmatchedSupplierReferences: number;
    unsignedDeliveryNotes: number;
    highBalanceCustomers: { customerId: string; customerName: string; balance: number; creditLimit: number }[];
  };
}
