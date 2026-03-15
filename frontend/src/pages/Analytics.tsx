import { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, DollarSign, Zap, Users, Star } from 'lucide-react';
import axios from 'axios';
import { format, subDays } from 'date-fns';
import clsx from 'clsx';

interface MetricsOverview {
  total_tickets: number;
  auto_resolved: number;
  human_reviewed: number;
  escalated: number;
  resolution_rate: number;
  avg_confidence: number;
  avg_resolution_time: number;
  cost_savings_usd: number;
  avg_csat: number;
  sla_compliance_rate: number;
}

interface DailyData {
  date: string;
  total_tickets: number;
  auto_resolved: number;
  human_reviewed: number;
  escalated: number;
  cost_savings_usd: number;
  avg_confidence: number;
  sla_compliance_rate: number;
}

const COLORS = {
  auto: '#10b981',
  human: '#f59e0b',
  escalated: '#ef4444',
  confidence: '#06b6d4',
};

function StatCard({ label, value, icon: Icon, sub, trend, color }: {
  label: string; value: string; icon: any; sub?: string; trend?: number; color?: string;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-slate-400 text-sm font-medium">{label}</p>
        <div className={clsx('p-2 rounded-lg', color || 'bg-slate-800')}>
          <Icon className="w-4 h-4 text-slate-300" />
        </div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
      {trend !== undefined && (
        <div className={clsx('flex items-center gap-1 text-xs mt-2', {
          'text-emerald-400': trend > 0,
          'text-red-400': trend < 0,
          'text-slate-500': trend === 0,
        })}>
          {trend > 0 ? <TrendingUp className="w-3 h-3" /> : trend < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
          {Math.abs(trend)}% vs last week
        </div>
      )}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-slate-400 mb-2">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: <span className="font-bold">{p.value}</span></p>
      ))}
    </div>
  );
};

export default function Analytics() {
  const [overview, setOverview] = useState<MetricsOverview | null>(null);
  const [daily, setDaily] = useState<DailyData[]>([]);
  const [range, setRange] = useState<7 | 14 | 30>(14);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, [range]);

  async function fetchData() {
    try {
      const [ovRes, dailyRes] = await Promise.all([
        axios.get('/api/analytics/overview'),
        axios.get(`/api/analytics/daily?days=${range}`),
      ]);
      setOverview(ovRes.data);
      setDaily(dailyRes.data);
    } catch {
      // Use mock data for demo
      setOverview({
        total_tickets: 2847, auto_resolved: 2278, human_reviewed: 398, escalated: 171,
        resolution_rate: 0.88, avg_confidence: 0.82, avg_resolution_time: 4.2,
        cost_savings_usd: 34200, avg_csat: 4.3, sla_compliance_rate: 0.94,
      });
      setDaily(Array.from({ length: range }, (_, i) => ({
        date: format(subDays(new Date(), range - i - 1), 'MMM d'),
        total_tickets: Math.floor(Math.random() * 80) + 140,
        auto_resolved: Math.floor(Math.random() * 60) + 110,
        human_reviewed: Math.floor(Math.random() * 20) + 20,
        escalated: Math.floor(Math.random() * 10) + 5,
        cost_savings_usd: Math.floor(Math.random() * 1000) + 1500,
        avg_confidence: parseFloat((Math.random() * 0.2 + 0.75).toFixed(2)),
        sla_compliance_rate: parseFloat((Math.random() * 0.1 + 0.88).toFixed(2)),
      })));
    } finally {
      setLoading(false);
    }
  }

  const pieData = overview ? [
    { name: 'Auto-Resolved', value: overview.auto_resolved, color: COLORS.auto },
    { name: 'Human Review', value: overview.human_reviewed, color: COLORS.human },
    { name: 'Escalated', value: overview.escalated, color: COLORS.escalated },
  ] : [];

  if (loading || !overview) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Analytics</h1>
          <p className="text-slate-400 text-sm mt-1">Performance metrics and AI resolution insights</p>
        </div>
        <div className="flex gap-2">
          {([7, 14, 30] as const).map(d => (
            <button
              key={d}
              onClick={() => setRange(d)}
              className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium transition-all', {
                'bg-cyan-500 text-black': range === d,
                'bg-slate-800 text-slate-400 hover:bg-slate-700': range !== d,
              })}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Resolution Rate" value={`${Math.round(overview.resolution_rate * 100)}%`}
          icon={Zap} color="bg-emerald-900" trend={5.2}
          sub={`${overview.auto_resolved.toLocaleString()} auto-resolved`}
        />
        <StatCard
          label="Cost Savings" value={`$${(overview.cost_savings_usd / 1000).toFixed(1)}k`}
          icon={DollarSign} color="bg-cyan-900" trend={12.4}
          sub="This period"
        />
        <StatCard
          label="Avg CSAT" value={`${overview.avg_csat.toFixed(1)} / 5`}
          icon={Star} color="bg-amber-900" trend={2.1}
          sub={`${Math.round(overview.sla_compliance_rate * 100)}% SLA compliance`}
        />
        <StatCard
          label="Avg AI Confidence" value={`${Math.round(overview.avg_confidence * 100)}%`}
          icon={Users} color="bg-purple-900" trend={-1.3}
          sub={`${overview.avg_resolution_time}m avg resolve time`}
        />
      </div>

      {/* Volume Chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-white font-semibold mb-4">Ticket Volume & Resolution</h2>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={daily} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradAuto" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.auto} stopOpacity={0.3} />
                <stop offset="95%" stopColor={COLORS.auto} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="total_tickets" name="Total" stroke="#6366f1" fill="url(#gradTotal)" strokeWidth={2} />
            <Area type="monotone" dataKey="auto_resolved" name="Auto-Resolved" stroke={COLORS.auto} fill="url(#gradAuto)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Resolution Breakdown Pie */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4">Resolution Breakdown</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(val: number) => val.toLocaleString()} />
              <Legend formatter={(val) => <span style={{ color: '#94a3b8', fontSize: 12 }}>{val}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Cost Savings Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4">Daily Cost Savings ($)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={daily.slice(-10)} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="cost_savings_usd" name="Savings" fill="#06b6d4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
