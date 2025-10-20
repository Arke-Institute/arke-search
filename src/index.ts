/**
 * Arke Search API
 * Cloudflare Worker for querying Pinecone and retrieving Arke entities
 */

import { OpenAIClient } from './clients/openai';
import { PineconeClient } from './clients/pinecone';
import { ArkeClient } from './clients/arke';
import { SearchService } from './services/search';
import type { Env, SearchRequest } from './types';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Only allow POST
    if (request.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed. Use POST.' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
      // Parse request body
      const body = await request.json() as SearchRequest;

      // Validate query
      if (!body.query || typeof body.query !== 'string' || body.query.trim().length === 0) {
        return new Response(
          JSON.stringify({ error: 'Missing or invalid "query" field' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate topK
      if (body.topK !== undefined) {
        if (typeof body.topK !== 'number' || body.topK < 1 || body.topK > 100) {
          return new Response(
            JSON.stringify({ error: 'Invalid "topK" value. Must be between 1 and 100.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Initialize clients
      const openai = new OpenAIClient(env.OPENAI_API_KEY);
      const pinecone = new PineconeClient(env.PINECONE_API_KEY, env.PINECONE_INDEX_NAME);
      const arke = new ArkeClient();

      // Initialize Pinecone (caches index host)
      await pinecone.init();

      // Create search service
      const searchService = new SearchService(openai, pinecone, arke);

      // Perform search
      const result = await searchService.search(body);

      // Return results
      return new Response(
        JSON.stringify(result, null, 2),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );

    } catch (error) {
      console.error('Search error:', error);

      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error'
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }
  },
};
