'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Zap, Menu, X, FolderKanban, Music, User, LogOut, Plus } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils/helpers';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { label: 'Create', href: '/create', icon: <Plus className="w-4 h-4" /> },
  { label: 'Projects', href: '/projects', icon: <FolderKanban className="w-4 h-4" /> },
  { label: 'My Mashups', href: '/mashups', icon: <Music className="w-4 h-4" /> },
  { label: 'Profile', href: '/profile', icon: <User className="w-4 h-4" /> },
];

export function Navigation() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === '/create') {
      return pathname === '/create';
    }
    // For project detail pages, parent "Projects" should be active
    if (href === '/projects' && pathname.startsWith('/projects')) {
      return true;
    }
    return pathname === href;
  };

  return (
    <header className="fixed top-0 w-full z-50 border-b border-white/5 bg-background/60 backdrop-blur-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <Link href="/create">
            <div className="flex items-center group cursor-pointer">
              <div className="w-10 h-10 bg-gradient-to-tr from-primary to-orange-600 rounded-xl flex items-center justify-center mr-3 shadow-lg group-hover:shadow-primary/50 transition-all duration-300">
                <Zap className="w-6 h-6 text-white fill-white" />
              </div>
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 group-hover:to-white transition-all">
                InfinityMix
              </h1>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-2" role="navigation" aria-label="Main navigation">
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant="ghost"
                    className={cn(
                      'relative transition-all duration-200',
                      active
                        ? 'text-white bg-white/10 hover:bg-white/15'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    )}
                    aria-current={active ? 'page' : undefined}
                  >
                    <span className="flex items-center gap-2">
                      {item.icon}
                      {item.label}
                    </span>
                    {active && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
                    )}
                  </Button>
                </Link>
              );
            })}
            
            {/* Sign Out Button */}
            <Link href="/login">
              <Button
                variant="outline"
                className="border-white/10 hover:bg-white/5 hover:text-white ml-2"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </Link>
          </nav>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-gray-400 hover:text-white transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-navigation"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Overlay */}
      {isMobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 top-20 bg-background/95 backdrop-blur-lg z-40"
          id="mobile-navigation"
          role="dialog"
          aria-label="Mobile navigation"
          aria-modal="true"
        >
          <nav className="flex flex-col p-6 space-y-2">
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
                    active
                      ? 'bg-white/10 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  {item.icon}
                  <span className="text-lg font-medium">{item.label}</span>
                  {active && <span className="ml-auto w-2 h-2 bg-primary rounded-full" />}
                </Link>
              );
            })}
            
            <div className="pt-4 border-t border-white/10 mt-4">
              <Link
                href="/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-200"
              >
                <LogOut className="w-5 h-5" />
                <span className="text-lg font-medium">Sign Out</span>
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
