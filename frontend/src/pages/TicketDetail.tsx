import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, Edit3, AlertTriangle, Send, Loader, Bot, User, Clock } from 'lucide-react';
import axios from 'axios';
import { format } from 'date-fns';
import clsx from 'clsx';

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editedResponse, setEditedResponse] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchTicket(); }, [id]);

  async function fetchTicket() {
    try {
      const { data } = await axios.get(`/api/tickets/${id}`);
      setTicket(data);
      if (data.ai_response) setEditedResponse(data.ai_response.draft_response);
    } catch {
      // Mock
      setTicket({
        id, subject: 'Refund request for order #4821', body: "Hi,\n\nI placed order #4821 two weeks ago but never received it. I've been waiting and would like a full refund of $42.99.\n\nPlease help!\n\nBest,\nJohn",
        channel: 'email', priority: 'high', status: 'human_review',
        requester_name: 'John Smith', requester_email: 'john@example.com',
        created_at: new Date(Date.now() - 3600000).toISOString(),
        sla_deadline: new Date(Date.now() + 7200000).toISOString(),
        ai_response: {
          id: 'ar-1',
          draft_response: "Hi John,\n\nThank you for reaching out. I'm sorry to hear that your order #4821 hasn't arrived.\n\nI've reviewed your order and can confirm it was placed successfully. I'll initiate a full refund of $42.99 to your original payment method immediately. You should see it within 3-5 business days.\n\nWe apologize for this inconvenience.\n\nBest regards,\nSupport Team",
          confidence_score: 0.73,
          rag_context: [{ title: 'Refund Policy', score: 0.89 }, { title: 'Order #4821 History', score: 0.78 }],
          model_used: 'claude-3-5-sonnet',
          latency_ms: 1243,
          reasons: ['High priority ticket - elevated scrutiny', 'Sensitive topic detected (billing)'],
        },
      });
      setEditedResponse("Hi John,\n\nThank you for reaching out. I'm sorry to hear that your order #4821 hasn't arrived.\n\nI've reviewed your order and can confirm it was placed successfully. I'll initiate a full refund of $42.99 to your original payment method immediately. You should see it within 3-5 business days.\n\nWe apologize for this inconvenience.\n\nBest regards,\nSupport Team");
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(action: string) {
    setSubmitting(true);
    try {
      await axios.post(`/api/tickets/${id}/review`, {
        action,
        ai_response_id: ticket.ai_response?.id,
        edited_response: action === 'edit' ? editedResponse : undefined,
      });
      navigate('/tickets');
    } catch (err) { console.error(err); }
    finally { setSubmitting(false); }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader className="w-8 h-8 text-cyan-400 animate-spin" />
    </div>
  );

  if (!ticket) return null;

  const ai = ticket.ai_response;
  const timeLeft = ticket.sla_deadline
    ? Math.max(0, new Date(ticket.sla_deadline).getTime() - Date.now())
    : null;

  return (
    <div className="max-w-4xl space-y-5">
      {/* Back */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Tickets
      </button>

      {/* Ticket Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white mb-2">{ticket.subject}</h1>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-slate-400">from <span className="text-slate-300">{ticket.requester_name}</span> &lt;{ticket.requester_email}&gt;</span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-500">{format(new Date(ticket.created_at), 'MMM d, yyyy HH:mm')}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={clsx('text-xs px-2.5 py-1 rounded-full font-medium', {
              'bg-red-900 text-red-400': ticket.priority === 'critical',
              'bg-amber-900 text-amber-400': ticket.priority === 'high',
              'bg-blue-900 text-blue-400': ticket.priority === 'medium',
              'bg-slate-800 text-slate-400': ticket.priority === 'low',
            })}>
              {ticket.priority}
            </span>
            {timeLeft !== null && (
              <span className={clsx('text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1', {
                'bg-red-900 text-red-400': timeLeft < 1800000,
                'bg-amber-900 text-amber-400': timeLeft >= 1800000 && timeLeft < 7200000,
                'bg-slate-800 text-slate-400': timeLeft >= 7200000,
              })}>
                <Clock className="w-3 h-3" />
                SLA: {Math.floor(timeLeft / 3600000)}h {Math.floor((timeLeft % 3600000) / 60000)}m
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Customer Message */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
            <User className="w-4 h-4 text-slate-500" /> Customer Message
          </div>
          <div className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed bg-slate-800 rounded-lg p-3">
            {ticket.body}
          </div>
          {ai?.rag_context?.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">KB Sources Used</p>
              {ai.rag_context.map((doc: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-slate-800 last:border-0">
                  <span className="text-slate-400">{doc.title}</span>
                  <span className="text-emerald-500">{Math.round(doc.score * 100)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Response */}
        <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
              <Bot className="w-4 h-4 text-cyan-500" /> AI Draft Response
            </div>
            {ai && (
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span>{ai.model_used}</span>
                <span>{ai.latency_ms}ms</span>
                <span className={clsx('font-bold', {
                  'text-emerald-400': ai.confidence_score >= 0.8,
                  'text-amber-400': ai.confidence_score >= 0.6,
                  'text-red-400': ai.confidence_score < 0.6,
                })}>
                  {Math.round(ai.confidence_score * 100)}% conf.
                </span>
              </div>
            )}
          </div>

          {ai?.reasons?.length > 0 && (
            <div className="flex flex-col gap-1">
              {ai.reasons.map((r: string, i: number) => (
                <div key={i} className="flex items-start gap-1.5 text-xs text-amber-600">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> {r}
                </div>
              ))}
            </div>
          )}

          {editMode ? (
            <textarea
              className="w-full bg-slate-800 border border-cyan-700 rounded-lg p-3 text-slate-200 text-sm leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-cyan-500"
              rows={10}
              value={editedResponse}
              onChange={e => setEditedResponse(e.target.value)}
            />
          ) : (
            <div className="bg-slate-800 rounded-lg p-3 text-slate-300 text-sm whitespace-pre-wrap leading-relaxed min-h-32">
              {ai?.draft_response || 'No AI response generated'}
            </div>
          )}

          {/* Actions */}
          {ai && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
              <button
                disabled={submitting} onClick={() => handleAction('approve')}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-sm rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {submitting ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Approve & Send
              </button>

              {editMode ? (
                <button
                  disabled={submitting} onClick={() => handleAction('edit')}
                  className="flex items-center gap-1.5 px-4 py-2 bg-cyan-700 hover:bg-cyan-600 text-white text-sm rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  <Send className="w-4 h-4" /> Send Edited
                </button>
              ) : (
                <button
                  onClick={() => setEditMode(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg font-medium transition-colors"
                >
                  <Edit3 className="w-4 h-4" /> Edit
                </button>
              )}

              <button
                disabled={submitting} onClick={() => handleAction('escalate')}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-900 hover:bg-amber-800 text-amber-300 text-sm rounded-lg font-medium transition-colors disabled:opacity-50 ml-auto"
              >
                <AlertTriangle className="w-4 h-4" /> Escalate
              </button>
              <button
                disabled={submitting} onClick={() => handleAction('reject')}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-900 hover:bg-red-800 text-red-400 text-sm rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" /> Reject
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
