# Arke Search API

Cloudflare Worker API for semantic search across Arke Institute entities using Pinecone vector search and OpenAI embeddings.

## Features

- 🔍 **Semantic Search**: Natural language queries using OpenAI embeddings
- ⚡ **Parallel Processing**: Queries multiple Pinecone namespaces simultaneously
- 🎯 **Namespace Filtering**: Search all namespaces or filter to specific entity types
- 📦 **Complete Entity Data**: Returns manifests + metadata from Arke IPFS API
- 🚀 **Fast**: Sub-second response times with parallel API calls

## Architecture

```
User Query
    ↓
OpenAI Embeddings (text-embedding-3-small, 768d)
    ↓
Pinecone Query (5 namespaces in parallel)
    ↓
Arke IPFS API (manifest + metadata fetching in parallel)
    ↓
Combined Results (sorted by similarity score)
```

## API Endpoints

**Production**: `https://search.arke.institute`
**Local Dev**: `http://localhost:8787`

### 1. List Namespaces

**`GET /namespaces`**

Returns all available namespaces with descriptions.

```bash
curl https://search.arke.institute/namespaces
```

**Response:**
```json
{
  "namespaces": ["digitalObject", "institution", "series", "fileUnit", "collection"],
  "count": 5,
  "description": {
    "institution": "Institutional collections",
    "collection": "Record collections",
    "series": "Record series",
    "fileUnit": "File units",
    "digitalObject": "Digital objects (scanned documents, images, etc.)"
  }
}
```

### 2. Search

**`POST /`**

Perform semantic search across entities.

```bash
POST /
Content-Type: application/json

{
  "query": "World War II photographs",
  "topK": 10,  // optional, default: 10, max: 100
  "namespaces": ["fileUnit", "digitalObject"]  // optional, searches all if omitted
}
```

## Response Format

```json
{
  "query": "World War II photographs",
  "namespaces": ["institution", "collection", "series", "fileUnit", "digitalObject"],
  "total_results": 3,
  "results": [
    {
      "score": 0.87,
      "pi": "01K7ZG1BTFDPMRJWEQB4JBYR42",
      "namespace": "fileUnit",
      "pinecone_metadata": {
        "pi": "01K7ZG1BTFDPMRJWEQB4JBYR42",
        "schema": "nara-fileunit@v1",
        "nara_naId": 158703098,
        "date_start": 19930101,
        "date_end": 20011231,
        "parent_ancestry": ["01K7ZG10MPNWKHKMVEE4550Y20", "..."],
        "last_updated": "2025-10-20T00:24:19.510Z"
      },
      "manifest": {
        "pi": "01K7ZG1BTFDPMRJWEQB4JBYR42",
        "ver": 2,
        "ts": "2025-10-20T00:24:19.510Z",
        "manifest_cid": "baguqeera...",
        "components": {
          "catalog_record": "bafkreib..."
        },
        "children_pi": ["01K7ZG1C7A0Q2EF71JJ2FD19AB"],
        "parent_pi": "01K7ZG10MPNWKHKMVEE4550Y20"
      },
      "metadata": {
        "title": "Coast Guard Academy [1]",
        "level": "fileUnit",
        "nara_naId": 158703098,
        "record_types": ["Textual Records"],
        "access_restriction": { ... },
        "physical_location": { ... },
        ...
      },
      "metadata_cid": "bafkreib..."
    }
  ],
  "took_ms": 894
}
```

## Namespaces

The API supports 5 entity types (namespaces):

- `institution` - Institutional collections
- `collection` - Record collections
- `series` - Record series
- `fileUnit` - File units
- `digitalObject` - Digital objects (scanned documents, images, etc.)

## Example Queries

### Search All Namespaces

```bash
curl -X POST https://search.arke.institute \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "Apollo moon landing mission",
    "topK": 5
  }'
```

### Search Specific Namespace

```bash
curl -X POST https://search.arke.institute \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "presidential speeches",
    "topK": 10,
    "namespaces": ["fileUnit"]
  }'
```

### Multiple Namespaces

```bash
curl -X POST https://search.arke.institute \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "World War II photographs",
    "topK": 20,
    "namespaces": ["fileUnit", "digitalObject"]
  }'
```

## Local Development

### Prerequisites

- Node.js 18+
- npm or yarn
- Cloudflare account (for deployment)

### Setup

1. **Install dependencies**

```bash
npm install
```

2. **Configure environment variables**

Create `.dev.vars` file:

```bash
PINECONE_API_KEY=pcsk_...
PINECONE_INDEX_NAME=arke-institute-prod
OPENAI_API_KEY=sk-...
```

3. **Start dev server**

```bash
npm run dev
```

Server runs at `http://localhost:8787`

4. **Test locally**

```bash
curl -X POST http://localhost:8787 \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "presidential records",
    "topK": 3
  }'
```

## Deployment

### Set Production Secrets

```bash
# Pinecone API key
wrangler secret put PINECONE_API_KEY
# Enter: pcsk_...

# OpenAI API key
wrangler secret put OPENAI_API_KEY
# Enter: sk-...
```

### Deploy to Cloudflare

```bash
npm run deploy
```

The worker will be deployed to `search.arke.institute`.

### View Logs

```bash
npm run tail
```

## Project Structure

```
query-pinecone/
├── src/
│   ├── index.ts              # Worker entry point
│   ├── types.ts              # TypeScript interfaces
│   ├── clients/
│   │   ├── openai.ts         # OpenAI embeddings client
│   │   ├── pinecone.ts       # Pinecone vector search client
│   │   └── arke.ts           # Arke IPFS API client
│   └── services/
│       └── search.ts         # Search orchestration logic
├── wrangler.jsonc            # Cloudflare Worker config
├── package.json
├── tsconfig.json
└── .dev.vars                 # Local environment variables (gitignored)
```

## Performance

- **Embedding generation**: ~100-200ms (OpenAI API)
- **Pinecone query**: ~50-150ms per namespace (parallelized)
- **Entity fetching**: ~100-300ms (parallelized)
- **Total**: ~500-900ms for complete search with 10 results

## Error Handling

The API returns appropriate HTTP status codes:

- `200 OK` - Success
- `400 Bad Request` - Invalid query or parameters
- `405 Method Not Allowed` - Non-POST request
- `500 Internal Server Error` - Server-side error

Error response format:

```json
{
  "error": "Internal server error",
  "message": "Failed to create embedding: API rate limit exceeded"
}
```

## CORS

The API supports CORS with the following headers:

- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type`

## Metadata Support

The API automatically resolves metadata components with different naming conventions:

- `metadata` (generic)
- `catalog_record` (fileUnit)
- `digital_object_metadata` (digitalObject)
- `collection_metadata` (collection)
- `series_metadata` (series)

If no metadata component exists, `metadata` will be `null` in the response.

## Integration with Arke APIs

This service integrates with two Arke endpoints:

1. **Arke API** (`https://api.arke.institute`)
   - `/entities/{pi}` - Fetch entity manifests

2. **IPFS Gateway** (`https://ipfs.arke.institute`)
   - `/ipfs/{cid}` - Retrieve component data

## Dependencies

- `@pinecone-database/pinecone` (^4.0.0) - Pinecone vector database client
- `openai` (^4.77.0) - OpenAI API client for embeddings
- `wrangler` (^3.90.0) - Cloudflare Workers CLI
- `typescript` (^5.7.2) - TypeScript compiler

## License

MIT

## Support

For issues or questions, contact the Arke Institute team.
