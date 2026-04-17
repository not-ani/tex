import Path from "node:path";
import { promises as Fs } from "node:fs";
import type { TexSessionSnapshot } from "@tex/editor";

type PersistedSessionRecord = {
  snapshot: TexSessionSnapshot;
  updatedAtMs: number;
};

export type SessionRecord = PersistedSessionRecord;

const sessionsDirName = "sessions";

export class FsSessionRepository {
  private readonly sessionsDir: string;

  constructor(appDataDir: string) {
    this.sessionsDir = Path.join(appDataDir, sessionsDirName);
  }

  async init() {
    await Fs.mkdir(this.sessionsDir, { recursive: true });
  }

  sessionPath(sessionId: string) {
    return Path.join(this.sessionsDir, `${sessionId}.json`);
  }

  async loadSession(sessionId: string): Promise<SessionRecord | null> {
    const path = this.sessionPath(sessionId);
    let payload: string;

    try {
      payload = await Fs.readFile(path, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw new Error(`Could not read persisted session '${sessionId}': ${(error as Error).message}`);
    }

    try {
      return JSON.parse(payload) as PersistedSessionRecord;
    } catch (error) {
      throw new Error(`Could not parse persisted session '${sessionId}': ${(error as Error).message}`);
    }
  }

  async persistSession(record: SessionRecord) {
    await this.init();
    const payload = JSON.stringify(record, null, 2);
    const path = this.sessionPath(record.snapshot.sessionId);
    const tempPath = `${path}.tmp`;

    await Fs.writeFile(tempPath, payload, "utf8").catch((error: Error) => {
      throw new Error(`Could not write temporary session '${record.snapshot.sessionId}': ${error.message}`);
    });
    await Fs.rename(tempPath, path).catch((error: Error) => {
      throw new Error(`Could not finalize session '${record.snapshot.sessionId}': ${error.message}`);
    });
  }

  async deleteSession(sessionId: string) {
    const path = this.sessionPath(sessionId);

    try {
      await Fs.unlink(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return;
      }
      throw new Error(`Could not delete persisted session '${sessionId}': ${(error as Error).message}`);
    }
  }
}
