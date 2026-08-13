import type {
  LocalTransaction,
  ReferenceCatalog,
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
  source: "seed",
  refreshedAt: null,
  businessId: null,
};

type ReferenceCatalogRecord = {
  id: string;
  catalog: ReferenceCatalog;
};

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
      catalog: defaultCatalog,
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

  return record?.catalog ?? defaultCatalog;
}

export async function replaceReferenceCatalog(catalog: ReferenceCatalog) {
  const database = await openDatabase();
  const transaction = database.transaction(REFERENCE_STORE, "readwrite");
  const store = transaction.objectStore(REFERENCE_STORE);
  store.put({
    id: REFERENCE_KEY,
    catalog,
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

  return records.sort((left, right) =>
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

  return record ?? null;
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
    catalog.staff.find((member) => member.id === input.staffId)?.name ??
    "Unknown staff";

  const items = input.items.map((item) => {
    const serviceLabel =
      catalog.services.find((service) => service.id === item.serviceId)?.name ??
      "Service";

    return {
      localId: createLocalId(),
      serviceId: item.serviceId,
      serviceLabelRaw: serviceLabel,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.quantity * item.unitPrice,
    };
  });

  const record: StoredTransactionRecord = {
    localId,
    remoteId: null,
    clientGeneratedId,
    businessId: catalog.businessId ?? null,
    transactionDate: input.transactionDate,
    staffId: input.staffId,
    staffName,
    paymentMethod: input.paymentMethod,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    notes: input.notes,
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
  store.put(record);
  await transactionToPromise(transaction);
  database.close();
}
