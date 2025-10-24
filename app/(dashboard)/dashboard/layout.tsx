'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { 
  Users, Settings, Shield, Activity, Menu, 
  Building2, CreditCard, BarChart3, ChevronDown,
  Plus, DollarSign, TrendingUp,
  Calendar
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

type Organization = {
  id: string;
  name: string;
  logoUrl?: string;
};

type DashboardLayoutProps = {
  children: React.ReactNode;
};

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      const response = await fetch('/api/organizations');
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data.organizations || []);
        
        // Set current org from localStorage or first org
        const savedOrgId = localStorage.getItem('currentOrgId');
        const org = savedOrgId 
          ? data.organizations.find((o: Organization) => o.id === savedOrgId)
          : data.organizations[0];
        
        // console.log('Current organization set to:', org);
        localStorage.setItem('currentOrgId', org.id);
        setCurrentOrg(org || null);
      }
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const switchOrganization = (org: Organization) => {
    setCurrentOrg(org);
    localStorage.setItem('currentOrgId', org.id);
    // Refresh current page data
    window.location.reload();
  };

  const personalNavItems = [
    { href: '/dashboard', icon: Users, label: 'Team' },
    { href: '/dashboard/general', icon: Settings, label: 'General' },
    { href: '/dashboard/subscriptions', icon: Calendar, label: 'My Subscriptions' },
    { href: '/dashboard/activity', icon: Activity, label: 'Activity' },
    { href: '/dashboard/security', icon: Shield, label: 'Security' }
  ];

  const orgNavItems = [
    { href: '/dashboard/org/overview', icon: BarChart3, label: 'Overview' },
    { href: '/dashboard/org/products', icon: CreditCard, label: 'Products' },
    { href: '/dashboard/org/plans', icon: Calendar, label: 'Subscription Plans' },
    { href: '/dashboard/org/subscribers', icon: Users, label: 'Subscribers' },
    { href: '/dashboard/org/payments', icon: DollarSign, label: 'Payments' },
    { href: '/dashboard/org/revenue', icon: TrendingUp, label: 'Revenue' },
    { href: '/dashboard/org/settings', icon: Settings, label: 'Org Settings' }
  ];

  const isOrgRoute = pathname.startsWith('/dashboard/org');

  return (
    <div className="flex flex-col min-h-[calc(100dvh-68px)] max-w-7xl mx-auto w-full">
      {/* Mobile header */}
      <div className="lg:hidden flex items-center justify-between bg-white border-b border-gray-200 p-4">
        <div className="flex items-center gap-2">
          {currentOrg && isOrgRoute && (
            <Building2 className="h-5 w-5 text-orange-600" />
          )}
          <span className="font-medium">
            {isOrgRoute ? currentOrg?.name || 'Organization' : 'Settings'}
          </span>
        </div>
        <Button
          className="-mr-3"
          variant="ghost"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          <Menu className="h-6 w-6" />
          <span className="sr-only">Toggle sidebar</span>
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden h-full">
        {/* Sidebar */}
        <aside
          className={`w-64 bg-white lg:bg-gray-50 border-r border-gray-200 lg:block ${
            isSidebarOpen ? 'block' : 'hidden'
          } lg:relative absolute inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <nav className="h-full overflow-y-auto p-4">
            {/* Organization Selector */}
            {organizations.length > 0 && (
              <>
                <div className="mb-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-between"
                      >
                        <div className="flex items-center gap-2 truncate">
                          {currentOrg ? (
                            <>
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-xs">
                                  {currentOrg.name.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="truncate">{currentOrg.name}</span>
                            </>
                          ) : (
                            <span>Select Organization</span>
                          )}
                        </div>
                        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="start">
                      <DropdownMenuLabel>Organizations</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {organizations.map((org) => (
                        <DropdownMenuItem
                          key={org.id}
                          onClick={() => switchOrganization(org)}
                          className="cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs">
                                {org.name.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span>{org.name}</span>
                            {currentOrg?.id === org.id && (
                              <span className="ml-auto text-orange-600">✓</span>
                            )}
                          </div>
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard/org/create" className="cursor-pointer">
                          <Plus className="h-4 w-4 mr-2" />
                          Create Organization
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </>
            )}

            {/* Navigation Sections */}
            {currentOrg && (
              <>
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">
                    Organization
                  </h3>
                  {orgNavItems.map((item) => (
                    <Link key={item.href} href={item.href} passHref>
                      <Button
                        variant={pathname === item.href ? 'secondary' : 'ghost'}
                        className={`shadow-none my-1 w-full justify-start ${
                          pathname === item.href ? 'bg-orange-50 text-orange-600' : ''
                        }`}
                        onClick={() => setIsSidebarOpen(false)}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </Button>
                    </Link>
                  ))}
                </div>

                <div className="border-t border-gray-200 my-4" />
              </>
            )}

            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">
                Personal
              </h3>
              {personalNavItems.map((item) => (
                <Link key={item.href} href={item.href} passHref>
                  <Button
                    variant={pathname === item.href ? 'secondary' : 'ghost'}
                    className={`shadow-none my-1 w-full justify-start ${
                      pathname === item.href && !isOrgRoute ? 'bg-gray-100' : ''
                    }`}
                    onClick={() => setIsSidebarOpen(false)}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              ))}
            </div>
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-0 lg:p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}