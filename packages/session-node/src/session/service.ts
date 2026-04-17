import Crypto from "node:crypto";
import { access } from "node:fs/promises";
import Path from "node:path";
import type { TexDocumentPayload, TexSessionOpenResult, TexSessionSnapshot, TexSessionUpdateArgs } from "@tex/editor";
import { openTexDocument } from "../docx/open";
import { saveTexDocument } from "../docx/save";
import { FsSessionRepository, type SessionRecord } from "./repository";

const ensureDocxPath = (filePath: string) =>
  filePath.toLowerCase().endsWith(".docx") ? filePath : `${filePath}.docx`;

const sessionIdForFilePath = (filePath: string) =>
  Crypto.createHash("sha1").update(filePath).digest("hex").slice(0, 16);

const snapshotFromDocument = (
  sessionId: string,
  version: number,
  dirty: boolean,
  document: TexDocumentPayload
): TexSessionSnapshot => ({
  sessionId,
  version,
  dirty,
  ...document
});

const cloneRecord = (record: SessionRecord): SessionRecord => ({
  updatedAtMs: record.updatedAtMs,
  snapshot: {
    ...record.snapshot,
    blocks: record.snapshot.blocks.map((block) => ({
      ...block,
      runs: block.runs.map((run) => ({ ...run }))
    }))
  }
});

export class SessionService {
  private readonly repository: FsSessionRepository;
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly fileToSession = new Map<string, string>();

  constructor(appDataDir: string) {
    this.repository = new FsSessionRepository(appDataDir);
  }

  async openSessionFromFile(filePath: string): Promise<TexSessionOpenResult> {
    const absolutePath = Path.resolve(filePath);
    const existingSessionId = this.fileToSession.get(absolutePath);

    if (existingSessionId) {
      const existing = this.sessions.get(existingSessionId);
      if (existing) {
        return { kind: "opened", snapshot: existing.snapshot };
      }
      this.fileToSession.delete(absolutePath);
    }

    const sessionId = sessionIdForFilePath(absolutePath);
    const persisted = await this.repository.loadSession(sessionId);
    if (persisted && persisted.snapshot.filePath === absolutePath && persisted.snapshot.dirty) {
      this.fileToSession.set(absolutePath, sessionId);
      this.sessions.set(sessionId, cloneRecord(persisted));
      return { kind: "opened", snapshot: cloneRecord(persisted).snapshot };
    }

    const document = await openTexDocument(absolutePath);
    const record: SessionRecord = {
      snapshot: snapshotFromDocument(sessionId, 0, false, document),
      updatedAtMs: Date.now()
    };

    this.fileToSession.set(absolutePath, sessionId);
    this.sessions.set(sessionId, record);
    return { kind: "opened", snapshot: cloneRecord(record).snapshot };
  }

  async createSessionAtPath(filePath: string): Promise<TexSessionOpenResult> {
    const absolutePath = Path.resolve(ensureDocxPath(filePath));
    const existing = await access(absolutePath).then(() => true).catch(() => false);

    if (existing) {
      throw new Error(`'${absolutePath}' already exists. Use Open to edit an existing document.`);
    }

    const document = await saveTexDocument(absolutePath, []);
    const sessionId = sessionIdForFilePath(absolutePath);
    const record: SessionRecord = {
      snapshot: snapshotFromDocument(sessionId, 0, false, document),
      updatedAtMs: Date.now()
    };

    this.fileToSession.set(absolutePath, sessionId);
    this.sessions.set(sessionId, record);
    return { kind: "opened", snapshot: cloneRecord(record).snapshot };
  }

  async updateSession(args: TexSessionUpdateArgs): Promise<TexSessionSnapshot> {
    const record = this.sessions.get(args.sessionId);
    if (!record) {
      throw new Error(`Session '${args.sessionId}' was not found.`);
    }

    if (record.snapshot.version !== args.baseVersion) {
      throw new Error(
        `Session '${args.sessionId}' is stale. Expected version ${record.snapshot.version}, received ${args.baseVersion}.`
      );
    }

    record.snapshot = snapshotFromDocument(args.sessionId, args.baseVersion + 1, true, args.document);
    record.updatedAtMs = Date.now();
    await this.repository.persistSession(cloneRecord(record));
    return cloneRecord(record).snapshot;
  }

  async saveSession(sessionId: string): Promise<TexSessionSnapshot> {
    const record = this.sessions.get(sessionId);
    if (!record) {
      throw new Error(`Session '${sessionId}' was not found.`);
    }

    const savedDocument = await saveTexDocument(record.snapshot.filePath, record.snapshot.blocks);
    record.snapshot = snapshotFromDocument(sessionId, record.snapshot.version + 1, false, savedDocument);
    record.updatedAtMs = Date.now();
    await this.repository.deleteSession(sessionId);
    return cloneRecord(record).snapshot;
  }
}
