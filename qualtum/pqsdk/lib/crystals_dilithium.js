/**
 * 
 * open source under MIT
 */

import {
  cryptoSignKeypair,
  cryptoSign,
  cryptoSignOpen,
  CryptoPublicKeyBytes,
  CryptoSecretKeyBytes,
} from '@theqrl/dilithium5';



// Encoding Helpers 

/**
 * Normalizes any message input to a Uint8Array with consistent encoding.
 * string      UTF-8 encoded bytes
 * Buffer      wrapped as Uint8Array (zero-copy)
 * Uint8Array  passed through
 * ArrayBuffer wrapped as Uint8Array
 * Anything else throws immediately rather than silently misbehaving.
 */


function normalizeMessage(msg, argName = "msg") {
  if (typeof msg === "string") {
    if (msg.length === 0) {
      throw new Error(`${argName}: message string must not be empty.`);
    }
    return new TextEncoder().encode(msg);
  }

  if (msg instanceof Uint8Array) {          // covers Buffer (subclass of Uint8Array)
    if (msg.length === 0) {
      throw new Error(`${argName}: message buffer must not be empty.`);
    }
    return msg instanceof Buffer
      ? new Uint8Array(msg.buffer, msg.byteOffset, msg.byteLength) 
      : msg;
  }

  if (msg instanceof ArrayBuffer) {
    if (msg.byteLength === 0) {
      throw new Error(`${argName}: ArrayBuffer message must not be empty.`);
    }
    return new Uint8Array(msg);
  }

  throw new Error(
    `${argName}: unsupported message type "${typeof msg}". ` +
    `Expected string, Uint8Array, Buffer, or ArrayBuffer.`
  );
}

// Key Generation

/**
 * Generates a Dilithium5 Keypair.
 * @returns {{ pubickey and secrerkey : Uint8Array, secretkey: Uint8Array }}
 * @throws {Error} If key generation fails.
 */
export function generateCDPair(seed) {
  try {
    const publickeybytes = new Uint8Array(CryptoPublicKeyBytes);
    const secretkeybytes = new Uint8Array(CryptoSecretKeyBytes);

   
    const result = cryptoSignKeypair(seed,publickeybytes, secretkeybytes);

    if (result !== undefined) {
      throw new Error(`Keypair generation failed with code: ${result}`);
    }

    
    return {publickeybytes,secretkeybytes};
  } catch (error) {
    console.error('[Crypto] Failed to generate Dilithium5 keypair:', error);
    throw new Error('Keypair generation failed. Ensure the library is initialized correctly.');
  }
}

// Sign 


/**
 * Signs a message using a Dilithium5 secret key.
 * @param {string|Uint8Array|Buffer|ArrayBuffer} msg  Message to sign.
 * @param {Uint8Array} secretkey   Dilithium5 secret key.
 * @returns {Uint8Array} Signed message blob.
 * @throws {Error} If inputs are invalid or signing fails.
 */
export function signViaCD(msg, secretkey) {
  // Validate secret key
  if (!(secretkey instanceof Uint8Array) || secretkey.length !== CryptoSecretKeyBytes) {
    throw new Error(
      `Invalid secret key: expected Uint8Array of ${CryptoSecretKeyBytes} bytes, ` +
      `got ${secretkey?.constructor?.name ?? typeof secretkey} of length ${secretkey?.length ?? "unknown"}.`
    );
  }

  // Normalize message throws on bad type or empty input
  const message = normalizeMessage(msg, "msg");

  try {
    const signedMessage = cryptoSign(message, secretkey, false);

    if (!signedMessage || signedMessage.length === 0) {
      throw new Error('Cryptographic signing returned an empty result.');
    }

    return signedMessage;
  } catch (error) {
    console.error('[Crypto] Signing error:', error);
    throw new Error(`Failed to sign message: ${error.message}`);
  }
}

// Verify

/**
 * Verifies a Dilithium5 signature and returns the original message.
 * @param {Uint8Array} signedMsg    The signed message buffer from signViaCD.
 * @param {Uint8Array} publickey    Dilithium5 public key.
 * @returns {Uint8Array|null}       Original message bytes if valid, null if invalid.
 * @throws {Error} If inputs are structurally invalid.
 */

export function verifyCDSignature(signedMsg, publickey) {
  // Validate public key
  if (!(publickey instanceof Uint8Array) || publickey.length !== CryptoPublicKeyBytes) {
    throw new Error(
      `Invalid public key: expected Uint8Array of ${CryptoPublicKeyBytes} bytes, ` +
      `got ${publickey?.constructor?.name ?? typeof publickey} of length ${publickey?.length ?? "unknown"}.`
    );
  }

  // Validate signed message
  if (!(signedMsg instanceof Uint8Array) || signedMsg.length === 0) {
    throw new Error("Invalid signedMsg: expected a non-empty Uint8Array.");
  }

  try {
    const opened = cryptoSignOpen(signedMsg, publickey);
    return opened ?? null;
  } catch (error) {
    console.warn('[Crypto] Verification failed:', error.message);
    return null;
  }
}