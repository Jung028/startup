import { useState, useEffect } from 'react';
import { Search, Plus, FileText, Tag, Trash2, Edit3, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { format } from 'date-fns';
import clsx from 'clsx';

interface KBDoc {
  id: string;
  title: string;
  content: string;
  doc_type: string;
  tags: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const DOC_TYPE_COLORS: Record<string, string> = {
  faq: 'bg-cyan-900 text-cyan-400',
  manual: 'bg-blue-900 text-blue-400',
  policy: 'bg-purple-900 text-purple-400',
  past_ticket: 'bg-slate-700 text-slate-400',
};

export default function KnowledgeBase() {
  const [docs, setDocs] = useState<KBDoc[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', doc_type: 'faq', tags: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchDocs(); }, [typeFilter]);

  async function fetchDocs() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set('type', typeFilter);
      if (search) params.set('search', search);
      const { data } = await axios.get(`/api/knowledge-base?${params}`);
      setDocs(data.data || []);
    } catch {
      setDocs([
        { id: '1', title: 'Refund Policy', content: 'Refunds are processed within 3-5 business days...', doc_type: 'policy', tags: ['refund', 'billing'], is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: '2', title: 'Password Reset FAQ', content: 'To reset your password, click "Forgot Password"...', doc_type: 'faq', tags: ['password', 'account'], is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: '3', title: 'Order Tracking Guide', content: 'Track your order using the order number from your confirmation email...', doc_type: 'manual', tags: ['order', 'tracking', 'shipping'], is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function saveDoc() {
    setSaving(true);
    try {
      await axios.post('/api/knowledge-base', {
        ...form,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      });
      setShowForm(false);
      setForm({ title: '', content: '', doc_type: 'faq', tags: '' });
      fetchDocs();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  const filtered = docs.filter(d =>
    !search ||
    d.title.toLowerCase().includes(search.toLowerCase()) ||
    d.content.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Knowledge Base</h1>
          <p className="text-slate-400 text-sm mt-1">Documents and FAQs used for RAG retrieval</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchDocs} className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors">
            <RefreshCw className="w-4 h-4 text-slate-400" />
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-black text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Document
          </button>
        </div>
      </div>

      {/* Add Document Form */}
      {showForm && (
        <div className="bg-slate-900 border border-cyan-800 rounded-xl p-5 space-y-4">
          <h2 className="text-white font-semibold">New Knowledge Base Document</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-slate-400 text-xs mb-1 block">Title</label>
              <input
                value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                placeholder="e.g. Refund Policy v2"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Type</label>
              <select
                value={form.doc_type} onChange={e => setForm(p => ({ ...p, doc_type: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none"
              >
                <option value="faq">FAQ</option>
                <option value="manual">Manual</option>
                <option value="policy">Policy</option>
                <option value="past_ticket">Past Ticket</option>
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Tags (comma-separated)</label>
              <input
                value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                placeholder="refund, billing, account"
              />
            </div>
            <div className="col-span-2">
              <label className="text-slate-400 text-xs mb-1 block">Content</label>
              <textarea
                value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                rows={5}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-none"
                placeholder="Document content used for RAG retrieval…"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={saveDoc} disabled={saving || !form.title || !form.content}
              className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              {saving ? 'Saving…' : 'Save & Index Document'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search documents…"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>
        <select
          value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none"
        >
          <option value="">All Types</option>
          <option value="faq">FAQ</option>
          <option value="manual">Manual</option>
          <option value="policy">Policy</option>
          <option value="past_ticket">Past Tickets</option>
        </select>
        <span className="text-slate-500 text-sm">{filtered.length} documents</span>
      </div>

      {/* Document Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(doc => (
          <div key={doc.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-600 transition-colors group">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                <p className="text-white text-sm font-medium leading-snug">{doc.title}</p>
              </div>
              <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium shrink-0', DOC_TYPE_COLORS[doc.doc_type] || 'bg-slate-700 text-slate-400')}>
                {doc.doc_type}
              </span>
            </div>
            <p className="text-slate-500 text-xs leading-relaxed line-clamp-3 mb-3">
              {doc.content}
            </p>
            {doc.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {doc.tags.slice(0, 4).map(tag => (
                  <span key={tag} className="flex items-center gap-1 text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                    <Tag className="w-2.5 h-2.5" />{tag}
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>Updated {format(new Date(doc.updated_at), 'MMM d')}</span>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="hover:text-cyan-400 transition-colors"><Edit3 className="w-3.5 h-3.5" /></button>
                <button className="hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
