import { getDb } from './db.js';

export interface PlayerRow {
  id: string;
  username: string;
  password_hash: string;
  room_id: string | null;
  pos_x: number;
  pos_y: number;
  rot_y: number;
}

export function findByUsername(username: string): PlayerRow | undefined {
  return getDb().prepare(`SELECT * FROM players WHERE username = ?`).get(username) as PlayerRow | undefined;
}

export function findById(id: string): PlayerRow | undefined {
  return getDb().prepare(`SELECT * FROM players WHERE id = ?`).get(id) as PlayerRow | undefined;
}

export function createPlayer(id: string, username: string, passwordHash: string) {
  getDb().prepare(`INSERT INTO players (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)`)
    .run(id, username, passwordHash, Date.now());
}

export function saveState(id: string, data: { roomId: string | null; posX: number; posY: number; rotY: number }) {
  getDb().prepare(`UPDATE players SET room_id=?, pos_x=?, pos_y=?, rot_y=?, last_seen=? WHERE id=?`)
    .run(data.roomId, data.posX, data.posY, data.rotY, Date.now(), id);
}
