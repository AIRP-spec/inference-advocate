// First-run intro dialog persistence.
//
// Paper: steps 1 and 12 (presentation). The dialog is demonstration chrome, not a product
// surface. A single localStorage key records that the visitor asked not to see it on startup.
// Nothing else is read or written here.

export const INTRO_STORAGE_KEY = 'airp.intro.dismissed';

export function readIntroDismissed(storage: Pick<Storage, 'getItem'> | null): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(INTRO_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export function writeIntroDismissed(
  storage: Pick<Storage, 'setItem' | 'removeItem'> | null,
  dismissed: boolean,
): void {
  if (!storage) return;
  try {
    if (dismissed) storage.setItem(INTRO_STORAGE_KEY, '1');
    else storage.removeItem(INTRO_STORAGE_KEY);
  } catch {
    // private mode / blocked storage: the in-session checkbox still works
  }
}
