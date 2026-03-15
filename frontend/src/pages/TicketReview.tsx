import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Edit3, AlertTriangle, Clock, ChevronDown, ChevronUp, Loader, Send } from 'lucide-react';
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
  ai_response?: {
    id: string;
    draft_response: string;
    confidence_score: number;
    rag_context: Array<{ title: string; score: number }>;
    model_used: string;
    latency_ms: number;
    reasons?: string[];
  };
}

const priorityColors: Record<string, string> = {
  low: 'bg-slate-700 text-slate-300',
  medium: 'bg-blue-900 text-blue-300',
  high: 'bg-amber-900 text-amber-300',
  critical: 'bg-red-900 text-red-400',
};

const channelIcons: Record<string, string> = {
  email: '✉', chat: '💬', form: '📋', api: '⚡',
};

export default function TicketReview() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<string | null>(null);
  const [editedResponses, setEditedResponses] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'human_review' | 'escalated'>('human_review');

  useEffect(() => {
    fetchTickets();
    const interval = setInterval(fetchTickets, 15000);
    return () => clearInterval(interval);
  }, [filter]);

  async function fetchTickets() {
    try {
      const { data } = await axios.get(`/api/tickets?status=${filter === 'all' ? '' : filter}&limit=20`);
      setTickets(data.data || []);
    } catch (err) {
      console.error('Failed to fetch tickets:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(ticketId: string, action: 'approve' | 'edit' | 'reject' | 'escalate', aiResponseId: string) {
    setSubmitting(ticketId);
    try {
      await axios.post(`/api/tickets/${ticketId}/review`, {
        action,
        ai_response_id: aiResponseId,
        edited_response: action === 'edit' ? editedResponses[ticketId] : undefined,
      });
      setTickets(prev => prev.filter(t => t.id !== ticketId));
      setExpanded(null);
      setEditMode(null);
    } catch (err) {
      console.error('Action failed:', err);
    } finally {
      setSubmitting(null);
    }
  }

  function isSlaBreach(deadline?: string) {
    if (!deadline) return false;
    return new Date(deadline) < new Date();
  }

  function getSlaTimeLeft(deadline?: string) {
    if (!deadline) return null;
    const diff = new Date(deadline).getTime() - Date.now();
    if (diff < 0) return 'BREACHED';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Ticket Review Queue</h1>
          <p className="text-slate-400 text-sm mt-1">Human-in-the-loop review for AI-flagged tickets</p>
        </div>
        <div className="flex gap-2">
          {(['human_review', 'escalated', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx('px-4 py-2 rounded-lg text-sm font-medium transition-all', {
                'bg-cyan-500 text-black': filter === f,
                'bg-slate-800 text-slate-400 hover:bg-slate-700': filter !== f,
              })}
            >
              {f === 'human_review' ? 'For Review' : f === 'escalated' ? 'Escalated' : 'All Pending'}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        {tickets.length} ticket{tickets.length !== 1 ? 's' : ''} awaiting review
      </div>

      {/* Ticket List */}
      {tickets.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-600" />
          <p className="text-lg font-medium text-slate-400">Queue is clear</p>
          <p className="text-sm">No tickets awaiting review</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map(ticket => {
            const ai = ticket.ai_response;
            const isOpen = expanded === ticket.id;
            const isEditing = editMode === ticket.id;
            const slaBreached = isSlaBreach(ticket.sla_deadline);
            const slaLeft = getSlaTimeLeft(ticket.sla_deadline);

            return (
              <div
                key={ticket.id}
                className={clsx(
                  'bg-slate-900 border rounded-xl overflow-hidden transition-all',
                  slaBreached ? 'border-red-800' : 'border-slate-800 hover:border-slate-600'
                )}
              >
                {/* Ticket Header */}
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer"
                  onClick={() => setExpanded(isOpen ? null : ticket.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-slate-400 text-sm">{channelIcons[ticket.channel]}</span>
                      <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', priorityColors[ticket.priority])}>
                        {ticket.priority}
                      </span>
                      {slaBreached && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-900 text-red-400 font-medium animate-pulse">
                          SLA BREACHED
                        </span>
                      )}
                      {!slaBreached && slaLeft && (
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {slaLeft}
                        </span>
                      )}
                    </div>
                    <p className="text-white font-medium truncate">{ticket.subject}</p>
                    <p className="text-slate-500 text-xs mt-0.5">
                      {ticket.requester_name || ticket.requester_email || 'Unknown'} · {format(new Date(ticket.created_at), 'MMM d, HH:mm')}
                    </p>
                  </div>
                  {ai && (
                    <div className="text-right shrink-0">
                      <div className={clsx('text-sm font-bold tabular-nums', {
                        'text-emerald-400': ai.confidence_score >= 0.7,
                        'text-amber-400': ai.confidence_score >= 0.5 && ai.confidence_score < 0.7,
                        'text-red-400': ai.confidence_score < 0.5,
                      })}>
                        {Math.round(ai.confidence_score * 100)}%
                      </div>
                      <div className="text-xs text-slate-600">confidence</div>
                    </div>
                  )}
                  {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />}
                </div>

                {/* Expanded Content */}
                {isOpen && (
                  <div className="border-t border-slate-800 p-4 space-y-4">
                    {/* Customer Message */}
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Customer Message</p>
                      <div className="bg-slate-800 rounded-lg p-3 text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">
                        {ticket.body}
                      </div>
                    </div>

                    {/* AI Response */}
                    {ai && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-slate-500 uppercase tracking-wider">AI Draft Response</p>
                          <div className="flex items-center gap-3 text-xs text-slate-600">
                            <span>{ai.model_used}</span>
                            <span>{ai.latency_ms}ms</span>
                          </div>
                        </div>

                        {isEditing ? (
                          <textarea
                            className="w-full bg-slate-800 border border-cyan-700 rounded-lg p-3 text-slate-200 text-sm leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-cyan-500"
                            rows={8}
                            value={editedResponses[ticket.id] ?? ai.draft_response}
                            onChange={e => setEditedResponses(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                          />
                        ) : (
                          <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">
                            {ai.draft_response}
                          </div>
                        )}

                        {/* RAG Context Sources */}
                        {ai.rag_context.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            <span className="text-xs text-slate-600">Sources:</span>
                            {ai.rag_context.map((doc, i) => (
                              <span key={i} className="text-xs bg-slate-800 text-slate-500 px-2 py-0.5 rounded border border-slate-700">
                                {doc.title.substring(0, 30)}… ({Math.round(doc.score * 100)}%)
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Confidence reasons */}
                        {ai.reasons && ai.reasons.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {ai.reasons.map((reason, i) => (
                              <div key={i} className="flex items-start gap-1.5 text-xs text-slate-500">
                                <AlertTriangle className="w-3 h-3 text-amber-600 mt-0.5 shrink-0" />
                                {reason}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Buttons */}
                    {ai && (
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                        <button
                          disabled={!!submitting}
                          onClick={() => handleAction(ticket.id, 'approve', ai.id)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-sm rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                          {submitting === ticket.id ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                          Approve & Send
                        </button>

                        {isEditing ? (
                          <button
                            disabled={!!submitting}
                            onClick={() => handleAction(ticket.id, 'edit', ai.id)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-cyan-700 hover:bg-cyan-600 text-white text-sm rounded-lg font-medium transition-colors disabled:opacity-50"
                          >
                            <Send className="w-4 h-4" /> Send Edited
                          </button>
                        ) : (
                          <button
                            onClick={() => setEditMode(ticket.id)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg font-medium transition-colors"
                          >
                            <Edit3 className="w-4 h-4" /> Edit Response
                          </button>
                        )}

                        <button
                          disabled={!!submitting}
                          onClick={() => handleAction(ticket.id, 'escalate', ai.id)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-amber-900 hover:bg-amber-800 text-amber-300 text-sm rounded-lg font-medium transition-colors disabled:opacity-50 ml-auto"
                        >
                          <AlertTriangle className="w-4 h-4" /> Escalate
                        </button>

                        <button
                          disabled={!!submitting}
                          onClick={() => handleAction(ticket.id, 'reject', ai.id)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-red-900 hover:bg-red-800 text-red-400 text-sm rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
