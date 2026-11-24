import type { IStorageProvider } from "./types";
import { getStorageProviderId } from "./config";
import { createR2Provider } from "./providers/r2Provider";

let _cached: IStorageProvider | null = null;

export function getStorageProvider(): IStorageProvider {
  if (_cached) return _cached;

  const id = getStorageProviderId();
  switch (id) {
    case "cloudflare_r2":
      _cached = createR2Provider();
      return _cached;
    default:
      throw new Error(`Storage provider "${id}" غير مدعوم بعد — استخدم STORAGE_PROVIDER=cloudflare_r2`);
  }
}

/** Reset cached provider (tests only). */
export function resetStorageProviderCache(): void {
  _cached = null;
}
