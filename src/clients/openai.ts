/**
 * OpenAI Client
 * Generates embeddings via OpenAI API
 */

import OpenAI from 'openai';

export class OpenAIClient {
  private client: OpenAI;
  private model: string = 'text-embedding-3-small';
  private dimensions: number = 768;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  /**
   * Generate embedding for a single query string
   */
  async embedQuery(query: string): Promise<number[]> {
    if (!query || query.trim().length === 0) {
      throw new Error('Query cannot be empty');
    }

    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: query,
        dimensions: this.dimensions,
        encoding_format: 'float'
      });

      return response.data[0].embedding;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to create embedding: ${error.message}`);
      }
      throw error;
    }
  }
}
