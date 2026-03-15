import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { TrendingUp, Ticket, Clock, DollarSign, Bot, Users, AlertTriangle, CheckCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import clsx from 'clsx';

export default function Dashboard() {
  const { data: summary } = useQuery({
    queryKey: ['analytics-summary'],
    queryFn: () => axios.get('/api/analytics/summary?days=30').then(r => r.data),
    refetchInterval: 30_000,
  });

  const { data: resolutionData } = useQuery({
    queryKey: ['resolution-rate'],
    queryFn: () => axios.get('/api/analytics/resolution-rate?days=14').then(r => r.data),
  });

  const { data: pendingTickets } = useQuery({
    queryKey: ['pending-tickets'],
    queryFn: () => axios.get('/api/tickets?status=human_review&limit=5').then(r => r.data),
    refetchInterval: 15_000,
  });

  const autoRate = Math.round((summary?.auto_resolve_rate || 0) * 100);
  const escalationRate = Math.round((summary?.escalation_rate || 0) * 100);
  const avgConfidence = Math.round((summary?.avg_confidence || 0) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-700 text-white">Dashboard</h1>
        <p className="text-sm text-white/40 mt-0.5">Last 30 days · Live</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={<Bot size={16} />}
          label="Auto-Resolved"
          value={`${autoRate}%`}
          sub={`${summary?.auto_resolved || 0} tickets`}
          color="emerald"
        />
        <StatCard
          icon={<Ticket size={16} />}
          label="Total Tickets"
          value={summary?.total_tickets?.toLocaleString() || '—'}
          sub="Past 30 days"
          color="brand"
        />
        <StatCard
          icon={<DollarSign size={16} />}
          label="Cost Savings"
          value={`$${Number(summary?.total_cost_savings || 0).toLocaleString()}`}
          sub="vs. human handling"
          color="violet"
        />
        <StatCard
          icon={<TrendingUp size={16} />}
          label="AI Confidence"
          value={`${avgConfidence}%`}
          sub="avg score"
          color="amber"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Resolution trend */}
        <div className="col-span-2 card p-5">
          <p className="text-sm font-medium text-white/70 mb-4">Resolution Rate — 14 Days</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={resolutionData || []} margin={{ left: -20, right: 0 }}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#555577' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#555577' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
              <Tooltip
                contentStyle={{ background: '#1a1a24', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}
                labelStyle={{ color: '#8888aa', fontSize: 11 }}
                itemStyle={{ color: '#a5b8fc', fontSize: 12 }}
              />
              <Area type="monotone" dataKey="resolution_rate" stroke="#6366f1" strokeWidth={2} fill="url(#grad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Ticket status breakdown */}
        <div className="card p-5">
          <p className="text-sm font-medium text-white/70 mb-4">Routing Breakdown</p>
          <div className="space-y-3 mt-6">
            <BreakdownRow label="Auto-Resolved" pct={autoRate} color="bg-emerald-500" />
            <BreakdownRow label="Human Review" pct={Math.round((summary?.human_review_rate || 0) * 100)} color="bg-brand-500" />
            <BreakdownRow label="Escalated" pct={escalationRate} color="bg-rose-500" />
          </div>

          <div className="mt-6 pt-4 border-t border-white/[0.05] grid grid-cols-2 gap-3">
            <MiniStat label="SLA %" value={`${Math.round((summary?.avg_sla_compliance || 0) * 100)}%`} />
            <MiniStat label="CSAT" value={summary?.avg_csat ? `${summary.avg_csat}/5` : '—'} />
          </div>
        </div>
      </div>

      {/* Pending Reviews */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium text-white/70">Awaiting Human Review</p>
          <span className="badge bg-amber-500/15 text-amber-400">
            {pendingTickets?.total || 0} pending
          </span>
        </div>

        {!pendingTickets?.data?.length ? (
          <div className="flex items-center gap-3 py-6 text-white/30 justify-center">
            <CheckCircle size={16} />
            <span className="text-sm">Queue is clear</span>
          </div>
        ) : (
          <div className="space-y-2">
            {pendingTickets.data.map((t: any) => (
              <TicketRow key={t.id} ticket={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, color }: any) {
  const colors: Record<string, string> = {
    emerald: 'text-emerald-400 bg-emerald-500/10',
    brand: 'text-brand-400 bg-brand-500/10',
    violet: 'text-violet-400 bg-violet-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
  };

  return (
    <div className="stat-card">
      <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center', colors[color])}>
        {icon}
      </div>
      <p className="text-2xl font-display font-700 text-white mt-1">{value}</p>
      <p className="text-xs font-medium text-white/50">{label}</p>
      <p className="text-[10px] text-white/25">{sub}</p>
    </div>
  );
}

function BreakdownRow({ label, pct, color }: any) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-white/50">
        <span>{label}</span>
        <span className="text-white/70 font-medium">{pct}%</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className={clsx('h-full rounded-full transition-all duration-700', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/[0.03] rounded-xl p-3">
      <p className="text-[10px] text-white/30">{label}</p>
      <p className="text-sm font-semibold text-white mt-0.5">{value}</p>
    </div>
  );
}

function TicketRow({ ticket }: { ticket: any }) {
  const priorityColors: Record<string, string> = {
    critical: 'text-rose-400', high: 'text-orange-400', medium: 'text-amber-400', low: 'text-white/30',
  };
  return (
    <a href={`/tickets/${ticket.id}`} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition-colors group">
      <AlertTriangle size={13} className={priorityColors[ticket.priority] || 'text-white/30'} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white/80 truncate group-hover:text-white transition-colors">{ticket.subject}</p>
        <p className="text-[10px] text-white/30">{ticket.requester_email} · {ticket.channel}</p>
      </div>
      <span className="text-[10px] font-mono text-white/20">
        {ticket.confidence_score ? `${Math.round(ticket.confidence_score * 100)}%` : '—'}
      </span>
    </a>
  );
}
