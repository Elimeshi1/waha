import Database = require('better-sqlite3');

/**
 * Per-session persistent counter for `status@broadcast` acks (GOWS engine).
 *
 * For every status we send, it records each participant that received it
 * (DEVICE, ack >= 2) or read/viewed it (READ, ack >= 3), keyed by message id.
 *
 * The counting is fed from the RAW receipt stream, BEFORE the `ignore` filter
 * (see session.gows.core.ts), so it keeps working even when status/broadcast
 * events are ignored for webhooks (e.g. huge contact lists sending with
 * WAHA_SESSION_CONFIG_IGNORE_STATUS=true).
 *
 * Participants are stored as their raw JID - usually a `@lid`. A `@lid` is a
 * stable per-contact identifier, so distinct `@lid` == distinct viewer and no
 * phone-number resolution is required just to count.
 */

// WAHA WAMessageAck levels we care about.
export const ACK_DELIVERED = 2; // DEVICE
export const ACK_READ = 3; // READ

// How long status ack rows are kept. WhatsApp statuses expire after 24h, so
// acks older than this are meaningless; prune them to keep the table small
// even for huge contact lists.
export const RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
// How often to prune in the background (in addition to pruning on startup).
const PRUNE_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

export interface StatusAckSummaryData {
  messageId: string;
  received: number;
  read: number;
  // Only populated when participants are explicitly requested.
  receivedParticipants?: string[];
  readParticipants?: string[];
}

export class StatusAckStore {
  private readonly db: Database.Database;
  private readonly upsertStmt: Database.Statement;
  private readonly selectStmt: Database.Statement;
  private readonly pruneStmt: Database.Statement;
  private pruneTimer?: ReturnType<typeof setInterval>;

  constructor(filePath: string) {
    this.db = new Database(filePath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS status_ack (
        message_id  TEXT    NOT NULL,
        participant TEXT    NOT NULL,
        ack         INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL,
        PRIMARY KEY (message_id, participant)
      );
      CREATE INDEX IF NOT EXISTS status_ack_message_id_idx
        ON status_ack (message_id);
    `);
    // Keep the highest ack ever seen for a (message, participant) pair.
    this.upsertStmt = this.db.prepare(`
      INSERT INTO status_ack (message_id, participant, ack, updated_at)
      VALUES (@messageId, @participant, @ack, @updatedAt)
      ON CONFLICT(message_id, participant) DO UPDATE SET
        ack = excluded.ack,
        updated_at = excluded.updated_at
      WHERE excluded.ack > status_ack.ack
    `);
    this.selectStmt = this.db.prepare(
      'SELECT participant, ack FROM status_ack WHERE message_id = ?',
    );
    this.pruneStmt = this.db.prepare(
      'DELETE FROM status_ack WHERE updated_at < ?',
    );
    // Prune stale rows on startup, then periodically in the background.
    this.prune();
    this.pruneTimer = setInterval(() => this.prune(), PRUNE_INTERVAL_MS);
    // Don't let the prune timer keep the process alive.
    this.pruneTimer.unref?.();
  }

  /** Delete ack rows older than the retention window. */
  prune(): void {
    try {
      this.pruneStmt.run(Date.now() - RETENTION_MS);
    } catch (e) {
      // ignore
    }
  }

  /**
   * Record a single (message, participant, ack) observation.
   * Keeps the highest ack ever seen for the pair.
   */
  record(messageId: string, participant: string, ack: number): void {
    if (!messageId || !participant || !ack) {
      return;
    }
    this.upsertStmt.run({
      messageId,
      participant,
      ack,
      updatedAt: Date.now(),
    });
  }

  /**
   * Record a raw whatsmeow `events.Receipt` for a status@broadcast.
   * A single receipt carries one Sender (the viewer) and a batch of MessageIDs.
   */
  recordReceipt(receipt: any): void {
    const ack = receiptTypeToAck(receipt?.Type);
    if (!ack) {
      return;
    }
    const participant: string = receipt?.Sender || receipt?.MessageSender;
    if (!participant) {
      return;
    }
    const messageIds: string[] = receipt?.MessageIDs || [];
    if (messageIds.length === 0) {
      return;
    }
    const writeAll = this.db.transaction((ids: string[]) => {
      for (const id of ids) {
        this.record(id, participant, ack);
      }
    });
    writeAll(messageIds);
  }

  // `includeParticipants` controls whether the @lid lists are returned; by
  // default only the counts are computed (cheaper and smaller for huge lists).
  getSummary(
    messageId: string,
    includeParticipants = false,
  ): StatusAckSummaryData {
    const rows = this.selectStmt.all(messageId) as Array<{
      participant: string;
      ack: number;
    }>;

    let received = 0;
    let read = 0;
    const receivedParticipants: string[] = [];
    const readParticipants: string[] = [];
    for (const row of rows) {
      if (row.ack >= ACK_DELIVERED) {
        received++;
        if (includeParticipants) {
          receivedParticipants.push(row.participant);
        }
      }
      if (row.ack >= ACK_READ) {
        read++;
        if (includeParticipants) {
          readParticipants.push(row.participant);
        }
      }
    }
    return {
      messageId,
      received,
      read,
      receivedParticipants: includeParticipants ? receivedParticipants : undefined,
      readParticipants: includeParticipants ? readParticipants : undefined,
    };
  }

  close(): void {
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer);
      this.pruneTimer = undefined;
    }
    try {
      this.db.close();
    } catch (e) {
      // ignore
    }
  }
}

/**
 * Map a whatsmeow receipt Type to a WAHA ack level.
 * Mirrors the mapping used by the engine's receiptToMessageAck.
 *   - ''      => delivered to device (DEVICE / ack 2)
 *   - 'read'  => read/viewed        (READ / ack 3)
 *   - 'played'=> played             (treated as viewed)
 * Anything else (errors, presence-style receipts) is ignored.
 */
function receiptTypeToAck(type: string | undefined | null): number {
  switch (type) {
    case '':
    case undefined:
    case null:
      return ACK_DELIVERED;
    case 'read':
    case 'read-self':
    case 'played':
      return ACK_READ;
    default:
      return 0;
  }
}
