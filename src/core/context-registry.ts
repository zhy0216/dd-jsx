// Registry of context collections for auto-injection
// Uses 'any' to avoid circular dependency with collection.ts
const registeredContexts: any[] = []

export function registerContext(collection: any): () => void {
  registeredContexts.push(collection)
  return () => {
    const idx = registeredContexts.indexOf(collection)
    if (idx >= 0) registeredContexts.splice(idx, 1)
  }
}

export function getRegisteredContexts(): any[] {
  return [...registeredContexts]
}
