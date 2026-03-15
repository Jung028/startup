import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Ticket, BarChart3, BookOpen, LogOut, Bot, Bell, InboxIcon } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import clsx from 'clsx';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/tickets', icon: Ticket, label: 'All Tickets' },
  { to: '/review', icon: InboxIcon, label: 'Review Queue' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/knowledge-base', icon: BookOpen, label: 'Knowledge Base' },
];

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a0f]">
      {/* Sidebar */}
      <aside className="w-60 flex flex-col border-r border-white/[0.06] bg-[#0d0d15]">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-900/50">
              <Bot size={16} className="text-white" />
            </div>
            <div>
              <p className="font-display text-sm font-700 text-white leading-tight">AECSA</p>
              <p className="text-[10px] text-white/30 leading-tight">AI Support Platform</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-brand-600/20 text-brand-400 shadow-sm'
                  : 'text-white/40 hover:text-white/80 hover:bg-white/5'
              )}
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-7 h-7 rounded-lg bg-brand-700 flex items-center justify-center text-xs font-semibold text-white">
              {user?.name?.[0]?.toUpperCase() || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white/80 truncate">{user?.name}</p>
              <p className="text-[10px] text-white/30 capitalize">{user?.role}</p>
            </div>
            <button onClick={handleLogout} className="text-white/30 hover:text-white/70 transition-colors">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {/* Topbar */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3.5 border-b border-white/[0.05] bg-[#0a0a0f]/80 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-white/30">AI engine active</span>
          </div>
          <button className="relative text-white/40 hover:text-white/70 transition-colors">
            <Bell size={16} />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-brand-500 rounded-full" />
          </button>
        </div>

        <div className="p-6 animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
