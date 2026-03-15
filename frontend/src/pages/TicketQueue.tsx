import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, RefreshCw, Plus, Clock, CheckCircle, AlertTriangle, Eye } from 'lucide-react';
import axios from 'axios';
import { format } from 'date-fns';
import clsx from 'clsx';

interface Ticket {
  id: string;
  subject: string;
  body: string;
  channel: string;
  priority: string;
  status: string;
  requester_name?: string;
  requester_email?: string;
  created_at: string;
  sla_deadline?: string;
  confidence_score?: number;
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-slate-800 text-slate-400',
  processing: 'bg-blue-900 text-blue-400',
  ai_resolved: 'bg-emerald-900 text-emerald-400',
  human_review: 'bg-amber-900 text-amber-400',
  escalated: 'bg-red-900 text-red-400',
  resolved: 'bg-slate-700 text-slate-300',
  closed: 'bg-slate-800 text-slate-500',
};

const PRIORITY_DOT: Record<string, string> = {
  low: 'bg-slate-500', medium: 'bg-blue-400', high: 'bg-amber-400', critical: 'bg-red-500',
};

export default function TicketQueue() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const navigate = useNavigate();

  useEffect(() => { fetchTickets(); }, [statusFilter, priorityFilter]);

  async function fetchTickets() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      params.set('limit', '50');
      const { data } = await axios.get(`/api/tickets?${params}`);
      setTickets(data.data || []);
    } catch {
      // Mock data fallback
      setTickets(Array.from({ length: 12 }, (_, i) => ({
        id: `t-${i}`,
        subject: ['Cannot login to account', 'Refund request for order #4821', 'Password reset not working',
          'Billing discrepancy on invoice', 'Feature request: dark mode', 'Slow page load times',
          'Account locked after 3 attempts', 'Data export failing', 'API rate limit exceeded',
          'Webhook not firing on event', 'Cannot update billing info', 'Email notifications broken'][i % 12],
        body: 'Lorem ipsum dolor sit amet consectetur adipiscing elit.',
        channel: ['email', 'chat', 'form'][i % 3],
        priority: ['low', 'medium', 'high', 'critical'][i % 4],
        status: ['pending', 'processing', 'ai_resolved', 'human_review', 'escalated', 'resolved'][i % 6],
        requester_name: `Customer ${i + 1}`,
        requester_email: `customer${i + 1}@example.com`,
        created_at: new Date(Date.now() - i * 3600000).toISOString(),
        confidence_score: Math.random() * 0.4 + 0.6,
      })));
    } finally {
      setLoading(false);
    }
  }

  const filtered = tickets.filter(t =>
    !search || t.subject.toLowerCase().includes(search.toLowerCase()) ||
    t.requester_email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">All Tickets</h1>
          <p className="text-slate-400 text-sm mt-1">{tickets.length} total tickets</p>
        </div>
        <button
          onClick={() => navigate('/tickets/new')}
          className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-black text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> New Ticket
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tickets..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="human_review">Human Review</option>
          <option value="ai_resolved">AI Resolved</option>
          <option value="escalated">Escalated</option>
          <option value="resolved">Resolved</option>
        </select>

        <select
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        >
          <option value="">All Priority</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <button onClick={fetchTickets} className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors">
          <RefreshCw className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              {['Subject', 'Requester', 'Channel', 'Priority', 'Status', 'AI Conf.', 'Created', ''].map(h => (
                <th key={h} className="text-left text-xs text-slate-500 font-medium uppercase tracking-wider px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-12 text-slate-500">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-slate-500">No tickets found</td></tr>
            ) : filtered.map(ticket => (
              <tr
                key={ticket.id}
                className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer transition-colors"
                onClick={() => navigate(`/tickets/${ticket.id}`)}
              >
                <td className="px-4 py-3 max-w-xs">
                  <p className="text-white font-medium truncate">{ticket.subject}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-slate-300 text-xs">{ticket.requester_name}</p>
                  <p className="text-slate-600 text-xs">{ticket.requester_email}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="text-slate-400 text-xs uppercase">{ticket.channel}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className={clsx('w-2 h-2 rounded-full', PRIORITY_DOT[ticket.priority])} />
                    <span className="text-slate-400 text-xs capitalize">{ticket.priority}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_STYLES[ticket.status])}>
                    {ticket.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {ticket.confidence_score != null && (
                    <span className={clsx('text-xs font-mono font-semibold', {
                      'text-emerald-400': ticket.confidence_score >= 0.8,
                      'text-amber-400': ticket.confidence_score >= 0.6 && ticket.confidence_score < 0.8,
                      'text-red-400': ticket.confidence_score < 0.6,
                    })}>
                      {Math.round(ticket.confidence_score * 100)}%
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                  {format(new Date(ticket.created_at), 'MMM d, HH:mm')}
                </td>
                <td className="px-4 py-3">
                  <Eye className="w-4 h-4 text-slate-600 hover:text-slate-300 transition-colors" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
