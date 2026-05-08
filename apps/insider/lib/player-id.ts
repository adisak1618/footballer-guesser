import {
  getOrCreatePlayerId as coreGetOrCreatePlayerId,
  readPlayerId as coreReadPlayerId,
} from "@social-hub/core"

const PLAYER_ID_NAMESPACE = "insider"
export const PLAYER_ID_STORAGE_KEY = `${PLAYER_ID_NAMESPACE}_player_id`

export function getOrCreatePlayerId(): string {
  return coreGetOrCreatePlayerId(PLAYER_ID_NAMESPACE)
}

export function readPlayerId(): string | null {
  return coreReadPlayerId(PLAYER_ID_NAMESPACE)
}
