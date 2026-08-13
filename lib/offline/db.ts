import type {
  LocalTransaction,
  ReferenceCatalog,
  ReferenceItem,
  StoredTransactionRecord,
  SyncQueueItem,
  TransactionInput,
} from "@/lib/offline/types";

const DB_NAME = "binda-salon-os";
const DB_VERSION = 2;
const REFERENCE_STORE = "reference_catalog";
const TRANSACTION_STORE = "transactions";
const QUEUE_STORE = "sync_queue";
const REFERENCE_KEY = "primary";

const defaultCatalog: ReferenceCatalog = {
  staff: [
    { id: "staff-mary", name: "Mary", active: true },
    { id: "staff-janet", name: "Janet", active: true },
    { id: "staff-grace", name: "Grace", active: true },
  ],
  services: [
    {
      id: "service-wash",
      name: "Wash + Styling",
      active: true,
      expectedPrice: 3000,
    },
    { id: "service-braids", name: "Braids", active: true, expectedPrice: 12000 },
    { id: "service-wig", name: "Wig Install", active: true, expectedPrice: 15000 },
    {
      id: "service-treatment",
      name: "Treatment",
      active: true,
      expectedPrice: 4000,
    },
  ],
  paymentMethods: [
    { code: "cash", label: "Cash", active: true },
    { code: "transfer", label: "Transfer", active: true },
    { code: "pos", label: "POS", active: true },
    { code: "card", label: "Card", active: true },
  ],
  customers: [],
  source: "seed",
  refreshedAt: null,
  businessId: null,
};

function normalizeReferenceCatalog(catalog: ReferenceCatalog): ReferenceCatalog {
  return {
    ...catalog,
    paymentMethods:
      Array.isArray(catalog.paymentMethods) && catalog.paymentMethods.length > 0
        ? catalog.paymentMethods
        : defaultCatalog.paymentMethods,
    customers: Array.isArray(catalog.customers) ? catalog.customers : [],
  };
}

type ReferenceCatalogRecord = {
  id: string;
  catalog: ReferenceCatalog;
};

function normalizeStoredTransactionRecord(
  record: StoredTransactionRecord,
): StoredTransactionRecord {
  const payments =
    Array.isArray(record.payments) && record.payments.length > 0
      ? record.payments
      : [
          {
            localId: createLocalId(),
            amount: record.finalTotal,
            method: record.paymentMethod,
            status: "completed" as const,
            reference: null,
          },
        ];

  const items = (record.items ?? []).map((item) => ({
    ...item,
    type: item.type ?? "service",
    staffId: item.staffId ?? record.staffId,
    staffName: item.staffName ?? record.staffName ?? null,
    notes: item.notes ?? null,
  }));

  return {
    ...record,
    transactionStatus: record.transactionStatus ?? "confirmed",
    customerKind:
      record.customerKind ??
      (record.customerName || record.customerPhone ? "named" : "walk_in"),
    customerId: record.customerId ?? null,
    subtotal: record.subtotal ?? record.finalTotal,
    discountTotal: record.discountTotal ?? 0,
    items,
    payments,
    auditEvents: Array.isArray(record.auditEvents) ? record.auditEvents : [],
  };
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionToPromise(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function openDatabase() {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is not available in this environment.");
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(REFERENCE_STORE)) {
        database.createObjectStore(REFERENCE_STORE, {
          keyPath: "id",
        });
      }

      if (!database.objectStoreNames.contains(TRANSACTION_STORE)) {
        const transactionStore = database.createObjectStore(TRANSACTION_STORE, {
          keyPath: "localId",
        });
        transactionStore.createIndex("syncStatus", "syncStatus", {
          unique: false,
        });
      } else {
        const transactionStore = request.transaction?.objectStore(
          TRANSACTION_STORE,
        );

        if (
          transactionStore &&
          !transactionStore.indexNames.contains("syncStatus")
        ) {
          transactionStore.createIndex("syncStatus", "syncStatus", {
            unique: false,
          });
        }
      }

      if (!database.objectStoreNames.contains(QUEUE_STORE)) {
        const queueStore = database.createObjectStore(QUEUE_STORE, {
          keyPath: "id",
        });
        queueStore.createIndex("status", "status", {
          unique: false,
        });
        queueStore.createIndex("entityLocalId", "entityLocalId", {
          unique: false,
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function createLocalId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function seedCatalogIfNeeded() {
  const database = await openDatabase();
  const transaction = database.transaction(REFERENCE_STORE, "readwrite");
  const store = transaction.objectStore(REFERENCE_STORE);
  const existing = await requestToPromise<ReferenceCatalogRecord | undefined>(
    store.get(REFERENCE_KEY),
  );

  if (!existing) {
    store.put({
      id: REFERENCE_KEY,
      catalog: normalizeReferenceCatalog(defaultCatalog),
    });
  }

  await transactionToPromise(transaction);
  database.close();
}

export async function getReferenceCatalog() {
  await seedCatalogIfNeeded();
  const database = await openDatabase();
  const transaction = database.transaction(REFERENCE_STORE, "readonly");
  const store = transaction.objectStore(REFERENCE_STORE);
  const record = await requestToPromise<ReferenceCatalogRecord | undefined>(
    store.get(REFERENCE_KEY),
  );
  await transactionToPromise(transaction);
  database.close();

  return normalizeReferenceCatalog(record?.catalog ?? defaultCatalog);
}

export async function replaceReferenceCatalog(catalog: ReferenceCatalog) {
  const database = await openDatabase();
  const transaction = database.transaction(REFERENCE_STORE, "readwrite");
  const store = transaction.objectStore(REFERENCE_STORE);
  store.put({
    id: REFERENCE_KEY,
    catalog: normalizeReferenceCatalog(catalog),
  });
  await transactionToPromise(transaction);
  database.close();
}

export async function listTransactions() {
  const database = await openDatabase();
  const transaction = database.transaction(TRANSACTION_STORE, "readonly");
  const store = transaction.objectStore(TRANSACTION_STORE);
  const records = await requestToPromise<StoredTransactionRecord[]>(store.getAll());
  await transactionToPromise(transaction);
  database.close();

  return records
    .map((record) => normalizeStoredTransactionRecord(record))
    .sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
    );
}

export async function getTransaction(localId: string) {
  const database = await openDatabase();
  const transaction = database.transaction(TRANSACTION_STORE, "readonly");
  const store = transaction.objectStore(TRANSACTION_STORE);
  const record = await requestToPromise<StoredTransactionRecord | undefined>(
    store.get(localId),
  );
  await transactionToPromise(transaction);
  database.close();

  return record ? normalizeStoredTransactionRecord(record) : null;
}

export async function listQueueItems() {
  const database = await openDatabase();
  const transaction = database.transaction(QUEUE_STORE, "readonly");
  const store = transaction.objectStore(QUEUE_STORE);
  const records = await requestToPromise<SyncQueueItem[]>(store.getAll());
  await transactionToPromise(transaction);
  database.close();

  return records.sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );
}

export async function getPendingQueueItems() {
  const items = await listQueueItems();
  return items.filter((item) => item.status === "pending" || item.status === "failed");
}

export async function saveServiceDefinition(input: {
  name: string;
  expectedPrice: number;
}) {
  const [catalog, database] = await Promise.all([getReferenceCatalog(), openDatabase()]);
  const transaction = database.transaction([REFERENCE_STORE, QUEUE_STORE], "readwrite");
  const referenceStore = transaction.objectStore(REFERENCE_STORE);
  const queueStore = transaction.objectStore(QUEUE_STORE);
  const timestamp = new Date().toISOString();
  const serviceId = createLocalId();

  const service: ReferenceItem = {
    id: serviceId,
    name: input.name,
    active: true,
    expectedPrice: input.expectedPrice,
    localOnly: true,
  };

  referenceStore.put({
    id: REFERENCE_KEY,
    catalog: {
      ...catalog,
      services: [service, ...catalog.services],
      refreshedAt: timestamp,
    },
  });

  queueStore.put({
    id: createLocalId(),
    entityType: "service",
    entityLocalId: serviceId,
    operation: "upsert",
    status: "pending",
    attemptCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastError: null,
    nextRetryAt: null,
  });

  await transactionToPromise(transaction);
  database.close();

  return service;
}

export async function saveStaffDefinition(input: {
  name: string;
}) {
  const [catalog, database] = await Promise.all([getReferenceCatalog(), openDatabase()]);
  const transaction = database.transaction([REFERENCE_STORE, QUEUE_STORE], "readwrite");
  const referenceStore = transaction.objectStore(REFERENCE_STORE);
  const queueStore = transaction.objectStore(QUEUE_STORE);
  const timestamp = new Date().toISOString();
  const staffId = createLocalId();

  const staffMember: ReferenceItem = {
    id: staffId,
    name: input.name,
    active: true,
    localOnly: true,
  };

  referenceStore.put({
    id: REFERENCE_KEY,
    catalog: {
      ...catalog,
      staff: [staffMember, ...catalog.staff],
      refreshedAt: timestamp,
    },
  });

  queueStore.put({
    id: createLocalId(),
    entityType: "staff",
    entityLocalId: staffId,
    operation: "upsert",
    status: "pending",
    attemptCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastError: null,
    nextRetryAt: null,
  });

  await transactionToPromise(transaction);
  database.close();

  return staffMember;
}

export async function removeQueueItem(queueItemId: string) {
  const database = await openDatabase();
  const transaction = database.transaction(QUEUE_STORE, "readwrite");
  const store = transaction.objectStore(QUEUE_STORE);
  store.delete(queueItemId);
  await transactionToPromise(transaction);
  database.close();
}

export async function markQueueItemFailed(queueItemId: string, errorMessage: string) {
  const database = await openDatabase();
  const transaction = database.transaction(QUEUE_STORE, "readwrite");
  const store = transaction.objectStore(QUEUE_STORE);
  const item = await requestToPromise<SyncQueueItem | undefined>(store.get(queueItemId));

  if (item) {
    store.put({
      ...item,
      status: "failed",
      attemptCount: item.attemptCount + 1,
      updatedAt: new Date().toISOString(),
      lastError: errorMessage,
      nextRetryAt: null,
    });
  }

  await transactionToPromise(transaction);
  database.close();
}

export async function saveTransaction(input: TransactionInput) {
  const [catalog, database] = await Promise.all([getReferenceCatalog(), openDatabase()]);
  const transaction = database.transaction(
    [TRANSACTION_STORE, QUEUE_STORE],
    "readwrite",
  );
  const transactionStore = transaction.objectStore(TRANSACTION_STORE);
  const queueStore = transaction.objectStore(QUEUE_STORE);

  const now = new Date().toISOString();
  const localId = createLocalId();
  const clientGeneratedId = createLocalId();

  const staffName =
    input.staffName ??
    catalog.staff.find((member) => member.id === input.staffId)?.name ??
    "Unknown staff";

  const items = input.items.map((item) => {
    const serviceLabel =
      catalog.services.find((service) => service.id === item.serviceId)?.name ??
      "Service";

    const itemStaffName =
      item.staffName ??
      catalog.staff.find((member) => member.id === item.staffId)?.name ??
      null;

    return {
      localId: createLocalId(),
      type: "service" as const,
      serviceId: item.serviceId,
      serviceLabelRaw: serviceLabel,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.quantity * item.unitPrice,
      staffId: item.staffId ?? input.staffId,
      staffName: itemStaffName,
      notes: item.notes ?? null,
    };
  });

  const subtotal =
    input.subtotal ??
    items.reduce((sum, item) => sum + Number(item.lineTotal ?? 0), 0);
  const discountTotal = input.discountTotal ?? 0;
  const payments =
    input.payments?.length
      ? input.payments.map((payment) => ({
          localId: createLocalId(),
          amount: payment.amount,
          method: payment.method,
          status: payment.status ?? "completed",
          reference: payment.reference ?? null,
        }))
      : [
          {
            localId: createLocalId(),
            amount: input.finalTotal,
            method: input.paymentMethod,
            status: "completed" as const,
            reference: null,
          },
        ];

  const record: StoredTransactionRecord = {
    localId,
    remoteId: null,
    clientGeneratedId,
    businessId: catalog.businessId ?? null,
    transactionDate: input.transactionDate,
    transactionStatus: input.transactionStatus ?? "confirmed",
    staffId: input.staffId,
    staffName,
    customerKind:
      input.customerKind ??
      (input.customerName || input.customerPhone ? "named" : "walk_in"),
    customerId: input.customerId ?? null,
    paymentMethod: input.paymentMethod,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    notes: input.notes,
    subtotal,
    discountTotal,
    finalTotal: input.finalTotal,
    primaryServiceName: items[0]?.serviceLabelRaw ?? "Service",
    entrySource: "manual",
    reviewStatus: "saved",
    syncStatus: "pending_sync",
    syncError: null,
    lastSyncAttemptAt: null,
    createdAt: now,
    updatedAt: now,
    items,
    payments,
    auditEvents: [
      {
        localId: createLocalId(),
        type: "transaction.created",
        actorUserId: null,
        source: "manual",
        createdAt: now,
      },
    ],
  };

  const queueItem: SyncQueueItem = {
    id: createLocalId(),
    entityType: "transaction",
    entityLocalId: localId,
    operation: "upsert",
    status: "pending",
    attemptCount: 0,
    createdAt: now,
    updatedAt: now,
    lastError: null,
    nextRetryAt: null,
  };

  transactionStore.put(record);
  queueStore.put(queueItem);

  await transactionToPromise(transaction);
  database.close();

  return record;
}

export async function markTransactionSynced(localId: string, remoteId: string) {
  const database = await openDatabase();
  const transaction = database.transaction(
    [TRANSACTION_STORE, QUEUE_STORE],
    "readwrite",
  );
  const transactionStore = transaction.objectStore(TRANSACTION_STORE);
  const queueStore = transaction.objectStore(QUEUE_STORE);

  const record = await requestToPromise<StoredTransactionRecord | undefined>(
    transactionStore.get(localId),
  );

  if (record) {
    transactionStore.put({
      ...record,
      remoteId,
      syncStatus: "synced",
      syncError: null,
      lastSyncAttemptAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const queueItems = await requestToPromise<SyncQueueItem[]>(queueStore.getAll());
  queueItems
    .filter((item) => item.entityLocalId === localId)
    .forEach((item) => queueStore.delete(item.id));

  await transactionToPromise(transaction);
  database.close();
}

export async function markTransactionSyncFailed(localId: string, errorMessage: string) {
  const database = await openDatabase();
  const transaction = database.transaction(
    [TRANSACTION_STORE, QUEUE_STORE],
    "readwrite",
  );
  const transactionStore = transaction.objectStore(TRANSACTION_STORE);
  const queueStore = transaction.objectStore(QUEUE_STORE);
  const timestamp = new Date().toISOString();

  const record = await requestToPromise<StoredTransactionRecord | undefined>(
    transactionStore.get(localId),
  );

  if (record) {
    transactionStore.put({
      ...record,
      syncStatus: "sync_failed",
      syncError: errorMessage,
      lastSyncAttemptAt: timestamp,
      updatedAt: timestamp,
    });
  }

  const queueItems = await requestToPromise<SyncQueueItem[]>(queueStore.getAll());
  queueItems
    .filter((item) => item.entityLocalId === localId)
    .forEach((item) =>
      queueStore.put({
        ...item,
        status: "failed",
        attemptCount: item.attemptCount + 1,
        updatedAt: timestamp,
        lastError: errorMessage,
        nextRetryAt: null,
      }),
    );

  await transactionToPromise(transaction);
  database.close();
}

export async function markTransactionSyncPending(localId: string) {
  const database = await openDatabase();
  const transaction = database.transaction(
    [TRANSACTION_STORE, QUEUE_STORE],
    "readwrite",
  );
  const transactionStore = transaction.objectStore(TRANSACTION_STORE);
  const queueStore = transaction.objectStore(QUEUE_STORE);
  const timestamp = new Date().toISOString();

  const record = await requestToPromise<StoredTransactionRecord | undefined>(
    transactionStore.get(localId),
  );

  if (record) {
    transactionStore.put({
      ...record,
      syncStatus: "pending_sync",
      syncError: null,
      updatedAt: timestamp,
    });
  }

  const queueItems = await requestToPromise<SyncQueueItem[]>(queueStore.getAll());
  const existing = queueItems.find((item) => item.entityLocalId === localId);

  if (existing) {
    queueStore.put({
      ...existing,
      status: "pending",
      updatedAt: timestamp,
      lastError: null,
    });
  } else {
    queueStore.put({
      id: createLocalId(),
      entityType: "transaction",
      entityLocalId: localId,
      operation: "upsert",
      status: "pending",
      attemptCount: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastError: null,
      nextRetryAt: null,
    });
  }

  await transactionToPromise(transaction);
  database.close();
}

export async function setTransactionBusinessId(localId: string, businessId: string) {
  const database = await openDatabase();
  const transaction = database.transaction(TRANSACTION_STORE, "readwrite");
  const store = transaction.objectStore(TRANSACTION_STORE);
  const record = await requestToPromise<StoredTransactionRecord | undefined>(
    store.get(localId),
  );

  if (record) {
    store.put({
      ...record,
      businessId,
      updatedAt: new Date().toISOString(),
    });
  }

  await transactionToPromise(transaction);
  database.close();
}

export async function setTransactionCustomerId(
  localId: string,
  customerId: string,
) {
  const database = await openDatabase();
  const transaction = database.transaction(TRANSACTION_STORE, "readwrite");
  const store = transaction.objectStore(TRANSACTION_STORE);
  const record = await requestToPromise<StoredTransactionRecord | undefined>(
    store.get(localId),
  );

  if (record) {
    store.put({
      ...record,
      customerId,
      updatedAt: new Date().toISOString(),
    });
  }

  await transactionToPromise(transaction);
  database.close();
}

export async function getQueueDepth() {
  const items = await listQueueItems();
  return items.length;
}

export async function getPendingTransactions() {
  const transactions = await listTransactions();
  return transactions.filter(
    (transaction) =>
      transaction.syncStatus === "pending_sync" ||
      transaction.syncStatus === "sync_failed",
  );
}

export async function replaceTransaction(record: LocalTransaction) {
  const database = await openDatabase();
  const transaction = database.transaction(TRANSACTION_STORE, "readwrite");
  const store = transaction.objectStore(TRANSACTION_STORE);
  store.put(normalizeStoredTransactionRecord(record));
  await transactionToPromise(transaction);
  database.close();
}

export async function deleteTransaction(localId: string) {
  const database = await openDatabase();
  const transaction = database.transaction(
    [TRANSACTION_STORE, QUEUE_STORE],
    "readwrite",
  );
  const transactionStore = transaction.objectStore(TRANSACTION_STORE);
  const queueStore = transaction.objectStore(QUEUE_STORE);

  transactionStore.delete(localId);

  const queueItems = await requestToPromise<SyncQueueItem[]>(queueStore.getAll());
  queueItems
    .filter((item) => item.entityLocalId === localId)
    .forEach((item) => queueStore.delete(item.id));

  await transactionToPromise(transaction);
  database.close();
}
