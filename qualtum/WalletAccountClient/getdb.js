// indexeddb module 
import { openDB } from 'idb';

let db; // rename to avoid confusion

export const getDB = () => {
  if (typeof window === 'undefined') return null;
  if (!db) {
    db = openDB('qwallet-store', 1, {
      upgrade(db) {
        db.createObjectStore('keyval');
      },
    });
  }
  return db; // returns the Promise — callers always await it
};