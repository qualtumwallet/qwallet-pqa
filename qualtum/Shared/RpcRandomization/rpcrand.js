// RPC Pool Configuration
// All API keys are loaded from environment variables


const env = process.env;

// Pool Builder
// Reads env vars by convention: {CHAIN}_RPC_1 … {CHAIN}_RPC_10
function buildPool(chain) {
  return Array.from({ length: 10 }, (_, i) =>
    env[`VITE_${chain.toUpperCase()}_RPC_${i + 1}`]
  ).filter(Boolean);
}

const RPC_POOLS = {
  solana:   buildPool("solana"),
  ethereum: buildPool("ethereum"),
  bnb:      buildPool("bnb"),
};

// Round-Robin State 
// Tracks the next index per chain so requests are distributed evenly
// across the pool rather than always hammering the same node.

const rrIndex = Object.fromEntries(Object.keys(RPC_POOLS).map(k => [k, 0]));

// Blacklist
// RPCs are temporarily blacklisted after a failure and retried after the cooldown.
const BLACKLIST_COOLDOWN_MS = 30_000; // 30 seconds
const blacklist = new Map(); // url  timestamp of when it was blacklisted

/**
 * Returns true if the given RPC URL is currently blacklisted.
 * Automatically clears the entry once the cooldown has elapsed.
 *
 * @param {string} url
 * @returns {boolean}
 */
function isBlacklisted(url) {
  if (!blacklist.has(url)) return false;
  const since = blacklist.get(url);
  if (Date.now() - since >= BLACKLIST_COOLDOWN_MS) {
    blacklist.delete(url); // cooldown expired
    return false;
  }
  return true;
}

/**
 * Marks an RPC URL as temporarily unavailable.
 *
 * @param {string} url
 */
export function blacklistRPC(url) {
  console.warn(`[assignRPC] Blacklisting RPC: ${url}`);
  blacklist.set(url, Date.now());
}


/**
 * Returns a healthy RPC URL for the requested chain using round-robin selection.
 * Skips any URLs that are currently blacklisted.

 *
 * @param {"solana"|"ethereum"|"bnb"} chain
 * @returns {string} RPC endpoint URL
 *
 * @throws {Error} If the chain is unrecognised.
 * @throws {Error} If every URL in the pool is currently blacklisted.
 * @throws {Error} If the pool for the chain is empty (missing env vars).
 */
export function assignRPC(chain) {
  const pool = RPC_POOLS[chain];

  if (!pool) {
    throw new Error(
      `[assignRPC] Unknown chain "${chain}". Valid options: ${Object.keys(RPC_POOLS).join(", ")}`
    );
  }

  if (pool.length === 0) {
    throw new Error(
      `[assignRPC] RPC pool for "${chain}" is empty. ` +
      `Check that the required environment variables are set.`
    );
  }

  // Walk the pool round-robin, skipping blacklisted entries.
  for (let attempts = 0; attempts < pool.length; attempts++) {
    const idx = rrIndex[chain] % pool.length;
    rrIndex[chain] = idx + 1; // advance for next call

    const url = pool[idx];
    if (!isBlacklisted(url)) return url;

    console.warn(`[assignRPC] Skipping blacklisted RPC (${url}), trying next…`);
  }

  throw new Error(
    `[assignRPC] All RPCs for "${chain}" are currently blacklisted. ` +
    `They will recover after ${BLACKLIST_COOLDOWN_MS / 1000}s.`
  );
}