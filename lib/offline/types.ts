export type SyncStatus = "local_only" | "pending_sync" | "synced" | "sync_failed";

export type QueueStatus = "pending" | "processing" | "failed";
export type QueueEntityType = "transaction" | "service";

export type ReferenceItem = {
  id: string;
  name: string;
  active: boolean;
  expectedPrice?: number;
  localOnly?: boolean;
};

export type PaymentMethod = {
  id?: string;
  code: string;
  label: string;
  active?: boolean;
};

export type ReferenceCustomer = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  active?: boolean;
};

export type ReferenceCatalog = {
  staff: ReferenceItem[];
  services: ReferenceItem[];
  paymentMethods: PaymentMethod[];
  customers: ReferenceCustomer[];
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
  staffName?: string | null;
  paymentMethod: string;
  customerKind?: "walk_in" | "named";
  customerId?: string | null;
  customerName: string | null;
  customerPhone: string | null;
  notes: string | null;
  subtotal?: number;
  discountTotal?: number;
  transactionStatus?: "draft" | "confirmed" | "voided";
  finalTotal: number;
  items: Array<{
    type?: "service";
    serviceId: string;
    quantity: number;
    unitPrice: number;
    staffId?: string | null;
    staffName?: string | null;
    notes?: string | null;
  }>;
  payments?: Array<{
    amount: number;
    method: string;
    status?: "completed" | "pending" | "failed";
    reference?: string | null;
  }>;
};

export type StoredTransactionItem = {
  localId: string;
  type: "service";
  serviceId: string;
  serviceLabelRaw: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  staffId: string | null;
  staffName: string | null;
  notes: string | null;
};

export type StoredPaymentRecord = {
  localId: string;
  amount: number;
  method: string;
  status: "completed" | "pending" | "failed";
  reference: string | null;
};

export type StoredAuditEvent = {
  localId: string;
  type: "transaction.created";
  actorUserId: string | null;
  source: "manual";
  createdAt: string;
};

export type StoredTransactionRecord = {
  localId: string;
  remoteId: string | null;
  clientGeneratedId: string;
  businessId: string | null;
  transactionDate: string;
  transactionStatus: "draft" | "confirmed" | "voided";
  staffId: string;
  staffName: string;
  customerKind: "walk_in" | "named";
  customerId: string | null;
  paymentMethod: string;
  customerName: string | null;
  customerPhone: string | null;
  notes: string | null;
  subtotal: number;
  discountTotal: number;
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
  payments: StoredPaymentRecord[];
  auditEvents: StoredAuditEvent[];
};

export type LocalTransaction = StoredTransactionRecord;

export type SyncQueueItem = {
  id: string;
  entityType: QueueEntityType;
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
