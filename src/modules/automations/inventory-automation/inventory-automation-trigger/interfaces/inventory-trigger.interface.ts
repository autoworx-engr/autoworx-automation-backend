export interface InventoryProductInfo {
  id: number;
  name: string;
  quantity: number;
  lowInventoryAlert?: number;
  unit?: string;
}

export interface LowStockProduct {
  id: number;
  name: string;
  currentQuantity: number;
  lowStockThreshold: number;
  unit?: string;
}

export interface OutOfStockProduct {
  id: number;
  name: string;
  unit?: string;
}

export interface InventoryCheckResult {
  lowStockProducts: LowStockProduct[];
  outOfStockProducts: OutOfStockProduct[];
  hasLowStock: boolean;
  hasOutOfStock: boolean;
}

export interface NotificationRecipient {
  userId: number;
  name: string;
  email?: string;
  phone?: string;
}

export interface NotificationData {
  companyId: number;
  ruleTitle: string;
  condition: 'LOW_STOCK' | 'OUT_OF_STOCK' | 'BOTH';
  lowStockProducts: LowStockProduct[];
  outOfStockProducts: OutOfStockProduct[];
  recipients: NotificationRecipient[];
  action: 'EMAIL' | 'SMS' | 'BOTH';
}
