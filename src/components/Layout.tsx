import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Home, Calendar, MapPin, User, ShoppingBag } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import NotificationCenter from './NotificationCenter';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Layout() {
  return (
    <div className="flex flex-col min-h-screen bg-wine-cream max-w-md mx-auto shadow-2xl relative overflow-hidden">
      {/* Top Header */}
      <header className="glass-effect sticky top-0 z-50 px-6 py-4 flex justify-between items-center">
        <NavLink to="/" className="flex items-center">
          <img 
            src="https://storage.googleapis.com/static.aistudio.google.com/content/file-2-savvy-new-logo.png" 
            alt="Savvy Logo" 
            className="h-12 w-auto object-contain"
            referrerPolicy="no-referrer"
          />
        </NavLink>
        <NotificationCenter />
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-24 overflow-y-auto">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="glass-effect fixed bottom-0 left-0 right-0 max-w-md mx-auto px-4 py-3 flex justify-between items-center z-50 rounded-t-3xl shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
        <NavButton to="/" icon={<Home className="w-5 h-5" />} label="Home" />
        <NavButton to="/events" icon={<Calendar className="w-5 h-5" />} label="Events" />
        <NavButton to="/stores" icon={<MapPin className="w-5 h-5" />} label="Stores" />
        <NavButton to="/shop" icon={<ShoppingBag className="w-5 h-5" />} label="Shop" />
        <NavButton to="/profile" icon={<User className="w-5 h-5" />} label="Profile" />
      </nav>
    </div>
  );
}

function NavButton({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex flex-col items-center gap-1 transition-all duration-300 group",
          isActive ? "text-wine-red scale-110" : "text-wine-black/40 hover:text-wine-black/60"
        )
      }
    >
      <div className="relative">
        {icon}
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-wine-red rounded-full opacity-0 group-[.active]:opacity-100 transition-opacity" />
      </div>
      <span className="text-[10px] font-medium uppercase tracking-widest">{label}</span>
    </NavLink>
  );
}
