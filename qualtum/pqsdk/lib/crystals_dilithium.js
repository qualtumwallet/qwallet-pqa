import {
  cryptoSignKeypair,
  cryptoSign,
  cryptoSignOpen,
  CryptoPublicKeyBytes,
  CryptoSecretKeyBytes,
} from '@theqrl/dilithium5';

/**
 * Generates a Dilithium5 Keypair.
 * @returns {Object} An object containing the public and secret keys.
 * @throws {Error} If key generation fails.
 */
export function generateCDPair() {
  try {
    const pk = new Uint8Array(CryptoPublicKeyBytes);
    const sk = new Uint8Array(CryptoSecretKeyBytes);

    const result = cryptoSignKeypair(pk, sk);
    
    if (result !== undefined) {
      throw new Error(`Keypair generation failed with code: ${result}`);
    }

    return { pk, sk };
  } catch (error) {
    console.error('[Crypto] Failed to generate Dilithium5 keypair:', error);
    throw new Error('Keypair generation failed. Ensure the library is initialized correctly.');
  }
}

/**
 * Signs a message using a Dilithium5 Secret Key.
 * @param {string|Uint8Array} msg =The message to sign.
 * @param {Uint8Array} sk = The secret key buffer.
 * @returns {Uint8Array} The signed message.
 * @throws {Error} If signing fails or inputs are invalid.
 */
export function signViaCD(msg, sk) {
  // Validate Secret Key length
  if (!(sk instanceof Uint8Array) || sk.length !== CryptoSecretKeyBytes) {
    throw new Error(`Invalid Secret Key: Expected Uint8Array of ${CryptoSecretKeyBytes} bytes.`);
  }

  try {
    const message = typeof msg === 'string' ? new TextEncoder().encode(msg) : msg;
    
    const signedMessage = cryptoSign(message, sk, false);

    if (!signedMessage) {
      throw new Error('Cryptographic signing returned an empty result.');
    }

    return signedMessage;
  } catch (error) {
    console.error('[Crypto] Signing Error:', error);
    throw new Error('Failed to sign message. Verify secret key integrity.');
  }
}

/**
 * Verifies a Dilithium5 signature.
 * @param {Uint8Array} signedMsg = The signed message buffer.
 * @param {Uint8Array} pk = The public key buffer.
 * @returns {Uint8Array|null} The original message if valid, null otherwise.
 */
export function verifyCDSignature(signedMsg, pk) {
  
  if (!(pk instanceof Uint8Array) || pk.length !== CryptoPublicKeyBytes) {
    throw new Error(`Invalid Public Key: Expected Uint8Array of ${CryptoPublicKeyBytes} bytes.`);
  }

  try {
    const openedMessage = cryptoSignOpen(signedMsg, pk);
    return openedMessage || null;
  } catch (error) {
    console.warn('[Crypto] Verification failed:', error.message);
    return null;
  }
  
}