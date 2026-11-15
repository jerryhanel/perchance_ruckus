const DB_NAME = 'ruckus-chatbot';
const db = new Dexie(DB_NAME);
window.db = db;

// Never edit old version blocks — Dexie treats a changed primary key
// in an already-shipped version as "changing primary key" and throws UpgradeError.
db.version(3).stores({
  threads: 'uuid, createdAt, lastActive',
  messages: '++id, threadUuid, timestamp',
  misc: 'key',
  personalities: 'name',
  videoCache: 'filename',
  references: '++id, query, expiresAt'
});

async function openDbWithRecovery() {
  try {
    await db.open();
  } catch (err) {
    const msg = String(err && (err.message || err.name || err));
    const isUpgradeProblem =
      err && (err.name === 'UpgradeError' || err.name === 'SchemaError' ||
      /primary key/i.test(msg) || /upgrade/i.test(msg));
    if (!isUpgradeProblem) throw err;
    console.warn('[db] incompatible IndexedDB schema, recreating fresh DB:', err);
    try { db.close(); } catch (_) {}
    await Dexie.delete(DB_NAME);
    await db.open();
  }
}

window.addEventListener('unhandledrejection', (e) => {
  const msg = String(e.reason && (e.reason.message || e.reason));
  if (/UpgradeError|changing primary key/i.test(msg)) {
    console.warn('[db] suppressed UpgradeError (see openDbWithRecovery):', e.reason);
    e.preventDefault();
  }
});

function generateUUID() {
  return crypto.randomUUID();
}

export { db, DB_NAME, openDbWithRecovery, generateUUID };
