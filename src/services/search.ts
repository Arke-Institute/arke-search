/**
 * Search Service
 * Orchestrates the search flow: embed query → query Pinecone → fetch entities
 */

import { OpenAIClient } from '../clients/openai';
import { PineconeClient } from '../clients/pinecone';
import { ArkeClient } from '../clients/arke';
import type { SearchRequest, SearchResponse, SearchResult } from '../types';

export class SearchService {
  constructor(
    private openai: OpenAIClient,
    private pinecone: PineconeClient,
    private arke: ArkeClient
  ) {}

  async search(request: SearchRequest): Promise<SearchResponse> {
    const startTime = Date.now();
    const topK = Math.min(request.topK || 10, 100); // Max 100

    // Step 1: Generate embedding
    console.log(`Generating embedding for query: "${request.query}"`);
    const embedding = await this.openai.embedQuery(request.query);

    // Step 2: Determine namespaces to query
    let namespacesToQuery: string[];
    if (request.namespaces && request.namespaces.length > 0) {
      namespacesToQuery = request.namespaces;
    } else {
      // Query all namespaces
      namespacesToQuery = await this.pinecone.listNamespaces();
    }

    console.log(`Querying namespaces: ${namespacesToQuery.join(', ')}`);

    // Step 3: Query Pinecone across all namespaces in parallel
    const pineconeResults = await this.pinecone.queryNamespaces(
      namespacesToQuery,
      embedding,
      topK
    );

    // Step 4: Flatten and sort all matches by score
    const allMatches = pineconeResults
      .flatMap(result =>
        result.matches.map(match => ({
          ...match,
          namespace: result.namespace
        }))
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, topK); // Take top K across all namespaces

    console.log(`Found ${allMatches.length} total matches`);

    if (allMatches.length === 0) {
      return {
        query: request.query,
        namespaces: namespacesToQuery,
        total_results: 0,
        results: [],
        took_ms: Date.now() - startTime
      };
    }

    // Step 5: Extract unique PIs
    const pis = allMatches.map(match => match.id);

    // Step 6: Fetch manifests + metadata in parallel
    console.log(`Fetching ${pis.length} entities from Arke API`);
    const entities = await this.arke.batchGetEntitiesWithMetadata(pis);

    // Step 7: Build entity lookup map
    const entityMap = new Map(entities.map(e => [e.pi, e]));

    // Step 8: Merge Pinecone results with entity data
    const results: SearchResult[] = allMatches
      .map(match => {
        const entity = entityMap.get(match.id);
        if (!entity) {
          console.warn(`Entity not found for PI: ${match.id}`);
          return null;
        }

        return {
          score: match.score,
          pi: match.id,
          namespace: match.namespace,
          pinecone_metadata: match.metadata,
          manifest: entity.manifest,
          metadata: entity.metadata,
          metadata_cid: entity.metadata_cid
        };
      })
      .filter((r): r is SearchResult => r !== null);

    return {
      query: request.query,
      namespaces: namespacesToQuery,
      total_results: results.length,
      results,
      took_ms: Date.now() - startTime
    };
  }
}
