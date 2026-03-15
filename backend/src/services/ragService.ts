import { Pinecone } from '@pinecone-database/pinecone';
import { config } from '../config';
import { logger } from '../config/logger';
import { query } from '../db';
import { RAGDocument, Ticket } from '../types';
import { generateEmbedding } from './llmService';
import { getRedis } from '../config/redis';

const pinecone = new Pinecone({ apiKey: config.pinecone.apiKey });

export async function retrieveContext(ticket: Ticket): Promise<RAGDocument[]> {
  const cacheKey = `rag:${ticket.organization_id}:${ticket.id}`;
  const redis = getRedis();

  // Check cache first
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      logger.debug({ ticketId: ticket.id }, 'RAG cache hit');
      return JSON.parse(cached);
    }
  } catch (err) {
    logger.warn('Redis cache read failed, proceeding without cache');
  }

  // Combine subject + body for embedding
  const queryText = `${ticket.subject}\n\n${ticket.body}`;

  try {
    const [vectorResults, dbResults] = await Promise.all([
      retrieveFromVectorDB(queryText, ticket.organization_id),
      retrieveFromDatabase(ticket.organization_id, extractKeyTerms(ticket)),
    ]);

    // Merge and deduplicate
    const combined = deduplicateDocuments([...vectorResults, ...dbResults]);
    const topResults = combined.slice(0, 5);

    // Cache for 30 minutes
    try {
      await redis.setex(cacheKey, 1800, JSON.stringify(topResults));
    } catch (err) {
      logger.warn('Redis cache write failed');
    }

    logger.debug({ ticketId: ticket.id, count: topResults.length }, 'RAG context retrieved');
    return topResults;
  } catch (error) {
    logger.error({ error, ticketId: ticket.id }, 'RAG retrieval failed');
    return [];
  }
}

async function retrieveFromVectorDB(
  queryText: string,
  organizationId: string
): Promise<RAGDocument[]> {
  if (!config.pinecone.apiKey) {
    logger.warn('Pinecone not configured, skipping vector retrieval');
    return [];
  }

  const embedding = await generateEmbedding(queryText);
  const index = pinecone.index(config.pinecone.indexName);

  const results = await index.query({
    vector: embedding,
    topK: 5,
    filter: { organization_id: organizationId },
    includeMetadata: true,
  });

  return results.matches.map((match) => ({
    id: match.id,
    title: (match.metadata?.title as string) || 'Knowledge Base Article',
    content: (match.metadata?.content as string) || '',
    score: match.score || 0,
    doc_type: (match.metadata?.doc_type as string) || 'unknown',
  }));
}

async function retrieveFromDatabase(
  organizationId: string,
  keyTerms: string[]
): Promise<RAGDocument[]> {
  if (keyTerms.length === 0) return [];

  const searchPattern = keyTerms.map(t => `%${t}%`).join('|');
  const rows = await query<any>(
    `SELECT id, title, content, doc_type, 0.7 as score
     FROM knowledge_base
     WHERE organization_id = $1
       AND is_active = true
       AND (title ILIKE ANY($2) OR content ILIKE ANY($2))
     LIMIT 5`,
    [organizationId, keyTerms.map(t => `%${t}%`)]
  );

  return rows.map(row => ({
    id: row.id,
    title: row.title,
    content: row.content,
    score: parseFloat(row.score),
    doc_type: row.doc_type,
  }));
}

function extractKeyTerms(ticket: Ticket): string[] {
  // Simple keyword extraction - in production use NLP library
  const text = `${ticket.subject} ${ticket.body}`.toLowerCase();
  const stopWords = new Set(['the', 'a', 'an', 'is', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'but', 'i', 'my', 'me', 'we', 'our']);

  return text
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word))
    .slice(0, 10);
}

function deduplicateDocuments(docs: RAGDocument[]): RAGDocument[] {
  const seen = new Set<string>();
  return docs
    .filter(doc => {
      if (seen.has(doc.id)) return false;
      seen.add(doc.id);
      return true;
    })
    .sort((a, b) => b.score - a.score);
}

export async function upsertDocument(
  organizationId: string,
  doc: { id: string; title: string; content: string; doc_type: string }
): Promise<void> {
  const embedding = await generateEmbedding(`${doc.title}\n\n${doc.content}`);
  const index = pinecone.index(config.pinecone.indexName);

  await index.upsert([{
    id: doc.id,
    values: embedding,
    metadata: {
      organization_id: organizationId,
      title: doc.title,
      content: doc.content.substring(0, 1000), // Pinecone metadata limit
      doc_type: doc.doc_type,
    },
  }]);

  logger.info({ docId: doc.id }, 'Document upserted to vector DB');
}
