/**
 * Pinecone Client
 * Queries Pinecone index for similar vectors
 */

import { Pinecone } from '@pinecone-database/pinecone';
import type { PineconeQueryResult, PineconeMatch } from '../types';

export class PineconeClient {
  private client: Pinecone;
  private indexName: string;
  private indexHost: string | null = null;

  constructor(apiKey: string, indexName: string) {
    this.client = new Pinecone({ apiKey });
    this.indexName = indexName;
  }

  /**
   * Initialize and cache index host
   */
  async init(): Promise<void> {
    if (this.indexHost) return;

    try {
      const indexDesc = await this.client.describeIndex(this.indexName);
      this.indexHost = indexDesc.host;
      console.log(`Connected to Pinecone index: ${this.indexName} (${this.indexHost})`);
    } catch (error) {
      throw new Error(`Failed to connect to Pinecone index: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  /**
   * List all namespaces in the index
   */
  async listNamespaces(): Promise<string[]> {
    if (!this.indexHost) {
      throw new Error('Index not initialized. Call init() first.');
    }

    try {
      const index = this.client.index(this.indexName, this.indexHost);
      const stats = await index.describeIndexStats();

      // Extract namespace names from stats
      const namespaces = stats.namespaces ? Object.keys(stats.namespaces) : [];
      return namespaces;
    } catch (error) {
      throw new Error(`Failed to list namespaces: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  /**
   * Query a single namespace
   */
  async queryNamespace(
    namespace: string,
    vector: number[],
    topK: number = 10
  ): Promise<PineconeQueryResult> {
    if (!this.indexHost) {
      throw new Error('Index not initialized. Call init() first.');
    }

    try {
      const index = this.client.index(this.indexName, this.indexHost);

      const response = await index.namespace(namespace).query({
        vector,
        topK,
        includeMetadata: true,
        includeValues: false
      });

      return {
        matches: response.matches as PineconeMatch[],
        namespace
      };
    } catch (error) {
      throw new Error(`Failed to query namespace ${namespace}: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  /**
   * Query multiple namespaces in parallel
   */
  async queryNamespaces(
    namespaces: string[],
    vector: number[],
    topK: number = 10
  ): Promise<PineconeQueryResult[]> {
    const queries = namespaces.map(ns =>
      this.queryNamespace(ns, vector, topK)
        .catch(error => {
          console.error(`Error querying namespace ${ns}:`, error);
          return { matches: [], namespace: ns };
        })
    );

    return await Promise.all(queries);
  }
}
