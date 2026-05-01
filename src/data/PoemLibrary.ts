import { openDB, type IDBPDatabase } from 'idb'
import type { SavedPoem } from '../types'

const DB_NAME = 'poem-library'
const STORE_NAME = 'poems'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase> | null = null

export function resetDBCache(): void {
  dbPromise = null
}

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        }
      },
      terminated() {
        dbPromise = null
      },
    })
  }
  return dbPromise
}

export async function savePoem(poem: SavedPoem): Promise<void> {
  const db = await getDB()
  await db.put(STORE_NAME, poem)
}

export async function listPoems(): Promise<SavedPoem[]> {
  const db = await getDB()
  const all = await db.getAll(STORE_NAME)
  return all.sort((a, b) => b.addedAt - a.addedAt)
}

export async function findByTitle(title: string): Promise<SavedPoem | undefined> {
  const db = await getDB()
  const all = await db.getAll(STORE_NAME)
  return all.find(p => p.title === title)
}

export async function removePoem(id: string): Promise<void> {
  const db = await getDB()
  await db.delete(STORE_NAME, id)
}
