// ============================================================
//  privateConfig.js — the lessor's identity, bank details and lease terms
//
//  These are NOT in CONFIG. CONFIG is the public host config: it is compiled into
//  the JavaScript every visitor downloads and is served, with no login, by the
//  getAppConfig action, so a bank account number or a PAN in it is readable by
//  anyone. They live in hosts/<id>/private.js, which only the worker imports, and
//  reach the browser only through getPrivateConfig, which answers an owner and
//  nobody else.
//
//  Fetched at the moment a document is generated and then dropped: never put into
//  CONFIG, localStorage or a module-level cache (a stale copy would outlive a
//  sign-out, or follow a master_owner who switches tenant).
// ============================================================
import { api } from '../api'

// This tenant's private block. Throws when the worker cannot be reached or the
// signed-in user is not an owner, so a document is never drawn up with blanks.
export async function loadPrivateConfig() {
  const data = await api.getPrivateConfig()
  if (!data || typeof data !== 'object') {
    throw new Error('Could not load the lessor details. Please sign in again and retry.')
  }
  return data
}

// The India lessor + standard lease terms, or null when this host has none.
export async function loadLeaseOrNull() {
  const priv = await loadPrivateConfig()
  return priv.leaseIndia || null
}
