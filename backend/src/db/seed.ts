import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { config } from '../config';

const db = new Pool({ connectionString: config.db.url });

async function seed() {
  console.log('🌱 Seeding database...');

  // Create demo organization
  const [org] = await db.query<any>(
    `INSERT INTO organizations (name, domain, crm_provider, subscription_tier)
     VALUES ('Acme Corp', 'acme.com', 'zendesk', 'growth')
     ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    []
  ).then(r => r.rows);

  const orgId = org.id;
  console.log(`✅ Organization: ${orgId}`);

  // Create demo users
  const passwordHash = await bcrypt.hash('demo1234', 12);
  const users = [
    { email: 'admin@demo.com', name: 'Alex Admin', role: 'admin' },
    { email: 'agent@demo.com', name: 'Sam Agent', role: 'agent' },
    { email: 'manager@demo.com', name: 'Morgan Manager', role: 'manager' },
  ];

  for (const u of users) {
    await db.query(
      `INSERT INTO users (organization_id, email, password_hash, name, role)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO NOTHING`,
      [orgId, u.email, passwordHash, u.name, u.role]
    );
  }
  console.log(`✅ Users: ${users.map(u => u.email).join(', ')}`);

  // Create Knowledge Base documents
  const kbDocs = [
    {
      title: 'Password Reset Guide',
      content: `To reset your password:
1. Visit the login page and click "Forgot Password"
2. Enter your registered email address
3. Check your inbox for the reset link (also check spam folder)
4. Click the link within 24 hours — it expires after that
5. Choose a new password with at least 8 characters

If you don't receive the email within 5 minutes, please check your spam folder or contact support.`,
      doc_type: 'faq',
      tags: ['password', 'login', 'account', 'reset'],
    },
    {
      title: 'Refund Policy',
      content: `Our refund policy:
- Full refunds are available within 30 days of purchase for unused products
- Partial refunds (50%) are available 31-60 days after purchase
- No refunds after 60 days, except for defective products
- Digital products are non-refundable once downloaded
- Refunds are processed to the original payment method within 3-5 business days
- Large refunds over $500 require manager approval and may take 7-10 business days

To request a refund, provide your order number and reason for return.`,
      doc_type: 'policy',
      tags: ['refund', 'billing', 'payment', 'return'],
    },
    {
      title: 'Account Cancellation Process',
      content: `To cancel your account:
1. Log in to your account dashboard
2. Navigate to Settings → Account → Cancel Subscription
3. Select your reason for cancellation
4. Choose between immediate cancellation or end-of-billing-cycle cancellation
5. Confirm by entering your password

Important: Your data will be retained for 30 days after cancellation for export purposes.
After 30 days, all data is permanently deleted per our privacy policy.`,
      doc_type: 'policy',
      tags: ['cancel', 'account', 'subscription', 'delete'],
    },
    {
      title: 'API Rate Limits',
      content: `API rate limits by plan:
- Starter: 100 requests/minute, 10,000 requests/day
- Growth: 500 requests/minute, 100,000 requests/day  
- Enterprise: 2,000 requests/minute, unlimited/day

If you hit a rate limit, you'll receive HTTP 429. Implement exponential backoff starting at 1 second.
Enterprise customers can request higher limits by contacting sales.

Rate limit headers:
- X-RateLimit-Limit: your limit
- X-RateLimit-Remaining: requests left
- X-RateLimit-Reset: timestamp when limit resets`,
      doc_type: 'manual',
      tags: ['api', 'rate-limit', 'developer', '429'],
    },
    {
      title: 'Billing FAQ',
      content: `Common billing questions:

Q: When am I billed?
A: Monthly subscriptions bill on the same date each month. Annual plans bill once per year.

Q: What payment methods are accepted?
A: Visa, Mastercard, Amex, PayPal, and bank transfer for Enterprise plans.

Q: Can I change my plan mid-cycle?
A: Yes — upgrades are prorated immediately. Downgrades take effect at the next billing cycle.

Q: How do I update my credit card?
A: Go to Settings → Billing → Payment Method → Update Card.

Q: Why was I charged twice?
A: This can happen if a previous payment failed and was retried. Contact billing@company.com with your invoice number.`,
      doc_type: 'faq',
      tags: ['billing', 'payment', 'invoice', 'subscription'],
    },
    {
      title: 'Order Tracking',
      content: `To track your order:
1. Check your confirmation email for a tracking number
2. Visit our tracking page at orders.company.com/track
3. Enter your order number or tracking number
4. Real-time updates are available for all carriers

Estimated delivery times:
- Standard shipping: 5-7 business days
- Express shipping: 2-3 business days
- Overnight: Next business day

If your order shows "delivered" but you haven't received it, wait 24 hours and check with neighbours. Then contact support with your order number.`,
      doc_type: 'manual',
      tags: ['order', 'tracking', 'shipping', 'delivery'],
    },
  ];

  for (const doc of kbDocs) {
    await db.query(
      `INSERT INTO knowledge_base (organization_id, title, content, doc_type, tags)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [orgId, doc.title, doc.content, doc.doc_type, doc.tags]
    );
  }
  console.log(`✅ Knowledge base: ${kbDocs.length} documents`);

  // Seed sample tickets
  const sampleTickets = [
    { subject: 'Cannot login - forgot password', body: 'Hi, I forgot my password and cannot log into my account. Can someone help me reset it?', channel: 'email', priority: 'low', requester_name: 'John Smith', requester_email: 'john@customer.com' },
    { subject: 'Unauthorized charge on my account', body: 'There is a $150 charge on my account that I did not authorize. I need this refunded immediately.', channel: 'email', priority: 'high', requester_name: 'Sarah Lee', requester_email: 'sarah@customer.com' },
    { subject: 'API returning 429 errors', body: 'Our integration is getting rate limited despite being on the Growth plan. Error: HTTP 429 on /v1/messages endpoint.', channel: 'form', priority: 'high', requester_name: 'Dev Team', requester_email: 'dev@startup.io' },
    { subject: 'How do I export my data?', body: 'I need to export all our account data before we switch providers. What formats are available?', channel: 'chat', priority: 'medium', requester_name: 'Mike Chen', requester_email: 'mike@company.com' },
    { subject: 'Order not received - #48219', body: 'I placed order #48219 two weeks ago and tracking shows it is still in transit. Please help.', channel: 'email', priority: 'medium', requester_name: 'Emma Wilson', requester_email: 'emma@personal.com' },
  ];

  const slaMap: Record<string, number> = { low: 72, medium: 24, high: 8, critical: 2 };

  for (const t of sampleTickets) {
    const slaDeadline = new Date();
    slaDeadline.setHours(slaDeadline.getHours() + slaMap[t.priority]);
    await db.query(
      `INSERT INTO tickets (organization_id, subject, body, channel, priority, requester_name, requester_email, sla_deadline)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT DO NOTHING`,
      [orgId, t.subject, t.body, t.channel, t.priority, t.requester_name, t.requester_email, slaDeadline]
    );
  }
  console.log(`✅ Tickets: ${sampleTickets.length} sample tickets`);

  // Seed 30 days of daily metrics for charts
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    const total = Math.floor(Math.random() * 80) + 120;
    const autoResolved = Math.floor(total * (0.75 + Math.random() * 0.15));
    const humanReviewed = Math.floor((total - autoResolved) * 0.7);
    const escalated = total - autoResolved - humanReviewed;

    await db.query(
      `INSERT INTO daily_metrics
         (organization_id, date, total_tickets, auto_resolved, human_reviewed, escalated,
          avg_confidence, avg_resolution_time_minutes, avg_csat, cost_savings_usd, sla_compliance_rate)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (organization_id, date) DO NOTHING`,
      [
        orgId, dateStr, total, autoResolved, humanReviewed, escalated,
        (0.78 + Math.random() * 0.15).toFixed(4),
        Math.floor(3 + Math.random() * 5),
        (3.8 + Math.random() * 1.2).toFixed(2),
        (autoResolved * 14.5).toFixed(2),
        (0.88 + Math.random() * 0.1).toFixed(4),
      ]
    );
  }
  console.log(`✅ Metrics: 30 days of daily analytics`);

  await db.end();
  console.log('\n🚀 Seed complete! Login with:');
  console.log('   Email: admin@demo.com');
  console.log('   Password: demo1234');
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
