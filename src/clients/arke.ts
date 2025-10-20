/**
 * Arke API Client
 * Fetches entity manifests and components from Arke IPFS API
 */

import type { EntityManifest, EntityMetadata } from '../types';

const ARKE_API_BASE = 'https://api.arke.institute';
const ARKE_GATEWAY_BASE = 'https://ipfs.arke.institute';

export class ArkeClient {
  /**
   * Fetch entity manifest from Arke API
   */
  async getManifest(pi: string): Promise<EntityManifest> {
    try {
      const response = await fetch(`${ARKE_API_BASE}/entities/${pi}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Entity not found: ${pi}`);
        }
        throw new Error(`Failed to fetch manifest: ${response.status} ${response.statusText}`);
      }

      return await response.json() as EntityManifest;
    } catch (error) {
      throw new Error(`Failed to get manifest for ${pi}: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  /**
   * Fetch component data from IPFS Gateway
   */
  async getComponent(cid: string): Promise<any> {
    try {
      const response = await fetch(`${ARKE_GATEWAY_BASE}/ipfs/${cid}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Component not found: ${cid}`);
        }
        throw new Error(`Failed to fetch component: ${response.status} ${response.statusText}`);
      }

      // Try to parse as JSON, otherwise return text
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return await response.json();
      }
      return await response.text();
    } catch (error) {
      throw new Error(`Failed to get component ${cid}: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  /**
   * Fetch manifest + metadata component
   * Supports multiple metadata component names based on entity type
   */
  async getEntityWithMetadata(pi: string): Promise<{
    manifest: EntityManifest;
    metadata: EntityMetadata | null;
    metadata_cid?: string;
  }> {
    const manifest = await this.getManifest(pi);

    // Check for metadata component (try multiple common names)
    const metadataKeys = [
      'metadata',
      'catalog_record',
      'digital_object_metadata',
      'collection_metadata',
      'series_metadata'
    ];

    let metadataCid: string | undefined;
    for (const key of metadataKeys) {
      if (manifest.components?.[key]) {
        metadataCid = manifest.components[key];
        break;
      }
    }

    if (!metadataCid) {
      return {
        manifest,
        metadata: null
      };
    }

    // Fetch metadata
    try {
      const metadata = await this.getComponent(metadataCid) as EntityMetadata;
      return {
        manifest,
        metadata,
        metadata_cid: metadataCid
      };
    } catch (error) {
      console.error(`Failed to fetch metadata for ${pi}:`, error);
      return {
        manifest,
        metadata: null,
        metadata_cid: metadataCid
      };
    }
  }

  /**
   * Batch fetch entities with metadata in parallel
   */
  async batchGetEntitiesWithMetadata(pis: string[]): Promise<Array<{
    pi: string;
    manifest: EntityManifest;
    metadata: EntityMetadata | null;
    metadata_cid?: string;
  }>> {
    const promises = pis.map(async (pi) => {
      try {
        const result = await this.getEntityWithMetadata(pi);
        return { pi, ...result };
      } catch (error) {
        console.error(`Failed to fetch entity ${pi}:`, error);
        return null;
      }
    });

    const results = await Promise.all(promises);
    return results.filter((r): r is NonNullable<typeof r> => r !== null);
  }
}
