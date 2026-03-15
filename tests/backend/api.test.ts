import request from 'supertest';
import app from '../../src/server';

// Mock DB and Redis for tests
jest.mock('../../src/db', () => ({
  query: jest.fn(),
  queryOne: jest.fn(),
  connectDatabase: jest.fn(),
}));

jest.mock('../../src/config/redis', () => ({
  connectRedis: jest.fn(),
  getRedis: jest.fn(() => ({ get: jest.fn(), setex: jest.fn() })),
}));

jest.mock('../../src/queues/ticketProcessor', () => ({
  initializeQueue: jest.fn(),
  enqueueTicket: jest.fn(),
}));

const mockToken = 'Bearer test-token';

describe('Ticket API', () => {
  beforeEach(() => jest.clearAllMocks());

  test('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('GET /api/tickets requires auth', async () => {
    const res = await request(app).get('/api/tickets');
    expect(res.status).toBe(401);
  });

  test('POST /api/tickets validates required fields', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', mockToken)
      .send({ subject: '' }); // missing required fields
    expect(res.status).toBe(400);
  });
});

describe('Analytics API', () => {
  test('GET /api/analytics/summary requires auth', async () => {
    const res = await request(app).get('/api/analytics/summary');
    expect(res.status).toBe(401);
  });
});
