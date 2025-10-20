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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // GET /namespaces - List available namespaces
    if (request.method === 'GET' && url.pathname === '/namespaces') {
      try {
        const pinecone = new PineconeClient(env.PINECONE_API_KEY, env.PINECONE_INDEX_NAME);
        await pinecone.init();
        const namespaces = await pinecone.listNamespaces();

        return new Response(
          JSON.stringify({
            namespaces,
            count: namespaces.length,
            description: {
              institution: 'Institutional collections',
              collection: 'Record collections',
              series: 'Record series',
              fileUnit: 'File units',
              digitalObject: 'Digital objects (scanned documents, images, etc.)'
            }
          }, null, 2),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          }
        );
      } catch (error) {
        console.error('Namespace listing error:', error);
        return new Response(
          JSON.stringify({
            error: 'Failed to list namespaces',
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
    }

    // POST / - Search endpoint
    if (request.method !== 'POST' || url.pathname !== '/') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed or invalid path. Use POST / for search or GET /namespaces.' }),
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
