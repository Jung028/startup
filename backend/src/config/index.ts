import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  db: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/aecsa_db',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  ai: {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    provider: (process.env.LLM_PROVIDER || 'anthropic') as 'anthropic' | 'openai',
    model: process.env.LLM_MODEL || 'claude-3-5-sonnet-20241022',
  },

  pinecone: {
    apiKey: process.env.PINECONE_API_KEY || '',
    environment: process.env.PINECONE_ENVIRONMENT || '',
    indexName: process.env.PINECONE_INDEX_NAME || 'aecsa-knowledge-base',
  },

  crm: {
    salesforce: {
      clientId: process.env.SALESFORCE_CLIENT_ID || '',
      clientSecret: process.env.SALESFORCE_CLIENT_SECRET || '',
      redirectUri: process.env.SALESFORCE_REDIRECT_URI || '',
    },
    zendesk: {
      subdomain: process.env.ZENDESK_SUBDOMAIN || '',
      email: process.env.ZENDESK_EMAIL || '',
      apiToken: process.env.ZENDESK_API_TOKEN || '',
    },
    intercom: {
      accessToken: process.env.INTERCOM_ACCESS_TOKEN || '',
    },
  },

  confidence: {
    autoResolveThreshold: parseFloat(process.env.AUTO_RESOLVE_CONFIDENCE_THRESHOLD || '0.85'),
    escalationThreshold: parseFloat(process.env.ESCALATION_CONFIDENCE_THRESHOLD || '0.60'),
  },

  queue: {
    concurrency: parseInt(process.env.BULL_CONCURRENCY || '5', 10),
    processingDelay: parseInt(process.env.TICKET_PROCESSING_DELAY_MS || '500', 10),
  },
};
