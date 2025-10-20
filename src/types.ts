// ============================================================================
// Pinecone Types
// ============================================================================

export interface PineconeMetadata {
  pi: string;                     // Entity PI (same as vector ID)
  schema: string;                 // e.g., "nara-fileunit@v1"
  nara_naId?: number;             // NARA identifier
  date_start?: number;            // YYYYMMDD format
  date_end?: number;              // YYYYMMDD format
  parent_ancestry?: string[];     // Parent PIs from immediate to root
  last_updated?: string;          // ISO timestamp
  [key: string]: any;             // Allow other metadata fields
}

export interface PineconeMatch {
  id: string;                     // Vector ID (PI)
  score: number;                  // Similarity score
  values?: number[];              // Vector values (optional)
  metadata: PineconeMetadata;
}

export interface PineconeQueryResult {
  matches: PineconeMatch[];
  namespace: string;
}

// ============================================================================
// Arke API Types
// ============================================================================

export interface EntityManifest {
  pi: string;
  ver: number;
  ts: string;                     // ISO timestamp
  manifest_cid: string;
  prev_cid?: string;
  components: Record<string, string>;  // component_name -> CID
  children_pi?: string[];
  parent_pi?: string;
  note?: string;
}

export interface EntityMetadata {
  name?: string;
  type?: string;
  description?: string;
  note?: string;
  [key: string]: any;             // Flexible metadata structure
}

// ============================================================================
// Search Types
// ============================================================================

export interface SearchResult {
  score: number;
  pi: string;
  namespace: string;
  pinecone_metadata: PineconeMetadata;
  manifest: EntityManifest;
  metadata: EntityMetadata | null;  // null if metadata component missing
  metadata_cid?: string;
}

export interface SearchResponse {
  query: string;
  namespaces: string[];           // Namespaces searched
  total_results: number;
  results: SearchResult[];
  took_ms: number;
}

// ============================================================================
// API Request/Response
// ============================================================================

export interface SearchRequest {
  query: string;
  topK?: number;                  // Default: 10, max: 100
  namespaces?: string[];          // Optional: filter to specific namespaces
}

// ============================================================================
// Environment Variables
// ============================================================================

export interface Env {
  PINECONE_API_KEY: string;
  PINECONE_INDEX_NAME: string;
  OPENAI_API_KEY: string;
}
