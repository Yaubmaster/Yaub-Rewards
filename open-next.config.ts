import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import staticAssetsIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache';

// Sin ISR ni revalidación: las páginas prerenderizadas en el build (/login,
// /registro…) se leen de los assets del Worker; el resto es force-dynamic.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
