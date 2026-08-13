export type SyncStatus = "local_only" | "pending_sync" | "synced" | "sync_failed";

export type QueueStatus = "pending" | "processing" | "failed";

export type ReferenceItem = {
  id: string;
  name: string;
  active: boolean;
  expectedPrice?: number;
};

export type PaymentMethod = {
  id?: string;
  code: string;
  label: string;
  active?: boolean;
};

export type ReferenceCatalog = {
  staff: ReferenceItem[];
  services: ReferenceItem[];
  paymentMethods: PaymentMethod[];
  businessId?: string | null;
  refreshedAt?: string | null;
  source?: "seed" | "remote";
};

export type TransactionFormItem = {
  serviceId: string;
  quantity: string;
  unitPrice: string;
};

export type TransactionFormState = {
  transactionDate: string;
  staffId: string;
  paymentMethod: string;
  customerName: string;
  customerPhone: string;
  notes: string;
  items: TransactionFormItem[];
};

export type TransactionInput = {
  transactionDate: string;
  staffId: string;
  paymentMethod: string;
  customerName: string | null;
  customerPhone: string | null;
  notes: string | null;
  finalTotal: number;
  items: Array<{
    serviceId: string;
    quantity: number;
    unitPrice: number;
  }>;
};

export type StoredTransactionItem = {
  localId: string;
  serviceId: string;
  serviceLabelRaw: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type StoredTransactionRecord = {
  localId: string;
  remoteId: string | null;
  clientGeneratedId: string;
  businessId: string | null;
  transactionDate: string;
  staffId: string;
  staffName: string;
  paymentMethod: string;
  customerName: string | null;
  customerPhone: string | null;
  notes: string | null;
  finalTotal: number;
  primaryServiceName: string;
  entrySource: "manual";
  reviewStatus: "saved";
  syncStatus: SyncStatus;
  syncError: string | null;
  lastSyncAttemptAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: StoredTransactionItem[];
};

export type LocalTransaction = StoredTransactionRecord;

export type SyncQueueItem = {
  id: string;
  entityType: "transaction";
  entityLocalId: string;
  operation: "upsert";
  status: QueueStatus;
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
  lastError: string | null;
  nextRetryAt: string | null;
};

export type SyncSummary = {
  businessId: string | null;
  pulledReferenceData: boolean;
  syncedTransactions: number;
  failedTransactions: number;
  skipped: boolean;
  reason?: string;
};
