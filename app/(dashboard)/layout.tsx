'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Home, LogOut, ShoppingBag, Package } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import useSWR, { mutate } from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// SubFlow Logo Component
function SubFlowLogo() {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-8 w-8"
    >
      <rect width="32" height="32" rx="8" fill="#EA580C" />
      <path
        d="M16 8L22 14L16 20L10 14L16 8Z"
        fill="white"
        opacity="0.9"
      />
      <path
        d="M16 14L20 18L16 22L12 18L16 14Z"
        fill="white"
        opacity="0.7"
      />
      <circle cx="16" cy="16" r="2" fill="white" />
    </svg>
  );
}

function UserMenu() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { data: user } = useSWR('/api/user', fetcher);
  const router = useRouter();

  async function handleSignOut() {
    try {
      // Call signout endpoint to delete session cookie
      await fetch('/api/auth/signout', { 
        method: 'POST',
        credentials: 'include'
      });
      
      // Clear SWR cache
      mutate('/api/user', null);
      
      // Redirect to home
      router.push('/');
      router.refresh();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }

  if (!user) {
    return (
      <div className="flex items-center gap-3">
        <Link
          href="/products"
          className="text-sm font-medium text-gray-700 hover:text-gray-900 hidden sm:block"
        >
          Browse
        </Link>
        <Button asChild variant="ghost" size="sm">
          <Link href="/sign-in">Sign In</Link>
        </Button>
        <Button asChild className="bg-orange-600 hover:bg-orange-700 rounded-full" size="sm">
          <Link href="/sign-up">Get Started</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Desktop Navigation - Only shown when authenticated */}
      <nav className="hidden md:flex items-center gap-6 text-sm font-medium mr-6">
        <Link href="/products" className="text-gray-700 hover:text-gray-900">
          Marketplace
        </Link>
        <Link href="/my-purchase" className="text-gray-700 hover:text-gray-900">
          My Purchases
        </Link>
      </nav>

      <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <DropdownMenuTrigger>
          <Avatar className="cursor-pointer size-9">
            <AvatarImage alt={user.name || ''} />
            <AvatarFallback className="bg-orange-100 text-orange-700">
              {user.email
                ?.split(' ')
                .map((n: string) => n[0])
                .join('')
                .toUpperCase() || 
                user.name
                  ?.split(' ')
                  .map((n: string) => n[0])
                  .join('')
                  .toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="flex flex-col gap-1 w-48">
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium">{user.name || 'User'}</p>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="cursor-pointer" asChild>
            <Link href="/my-purchase" className="flex w-full items-center">
              <ShoppingBag className="mr-2 h-4 w-4" />
              <span>My Purchases</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer" asChild>
            <Link href="/dashboard/org/overview" className="flex w-full items-center">
              <Package className="mr-2 h-4 w-4" />
              <span>Seller Dashboard</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer" asChild>
            <Link href="/dashboard" className="flex w-full items-center">
              <Home className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
            onClick={handleSignOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>Sign out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

function Header() {
  const { data: user } = useSWR('/api/user', fetcher);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <SubFlowLogo />
          <div className="flex flex-col">
            <span className="text-xl font-bold text-gray-900">SubFlow</span>
            <span className="text-[10px] text-gray-500 -mt-1 hidden sm:block">
              Powered by Sanctum
            </span>
          </div>
        </Link>

        {/* Navigation - only shown when NOT authenticated */}
        {!user && (
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link href="/products" className="text-gray-700 hover:text-gray-900">
              Marketplace
            </Link>
            <Link href="/dashboard/org/create" className="text-gray-700 hover:text-gray-900">
              Start Selling
            </Link>
            <Link 
              href="https://github.com/Emengkeng/subflow" 
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-700 hover:text-gray-900"
            >
              GitHub
            </Link>
          </nav>
        )}

        <div className="flex items-center">
          <Suspense fallback={<div className="h-9 w-24 animate-pulse bg-gray-100 rounded" />}>
            <UserMenu />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex flex-col min-h-screen">
      <Header />
      {children}
    </section>
  );
}