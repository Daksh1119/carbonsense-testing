'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import { usePathname } from 'next/navigation';

interface BreadcrumbItem {
  label: string;
  href: string;
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[];
  showHome?: boolean;
}

/**
 * Breadcrumb navigation component for showing current page hierarchy
 * Automatically generates breadcrumbs from pathname if items not provided
 */
export function Breadcrumb({ items, showHome = true }: BreadcrumbProps) {
  const pathname = usePathname();

  // Auto-generate breadcrumbs from pathname if not provided
  const breadcrumbItems = items || generateBreadcrumbs(pathname);

  return (
    <nav aria-label="Breadcrumb" className="flex items-center space-x-1 text-sm text-muted-foreground">
      {showHome && (
        <>
          <Link
            href="/dashboard"
            className="flex items-center hover:text-foreground transition-colors"
            aria-label="Home"
          >
            <Home className="h-4 w-4" />
          </Link>
          {breadcrumbItems.length > 0 && (
            <ChevronRight className="h-4 w-4 flex-shrink-0" />
          )}
        </>
      )}
      
      {breadcrumbItems.map((item, index) => {
        const isLast = index === breadcrumbItems.length - 1;
        
        return (
          <React.Fragment key={item.href}>
            {isLast ? (
              <span className="font-medium text-foreground" aria-current="page">
                {item.label}
              </span>
            ) : (
              <>
                <Link
                  href={item.href}
                  className="hover:text-foreground transition-colors"
                >
                  {item.label}
                </Link>
                <ChevronRight className="h-4 w-4 flex-shrink-0" />
              </>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

/**
 * Generate breadcrumbs automatically from pathname
 */
function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  // Remove trailing slash and split
  const segments = pathname.replace(/^\/|\/$/g, '').split('/');
  
  // Route mapping for better labels
  const routeLabels: Record<string, string> = {
    'dashboard': 'Dashboard',
    'emissions': 'Emissions',
    'detailed-log': 'Detailed Log',
    'analytics': 'Analytics & Simulation',
    'teme': 'Tree Engine',
    'policy-intelligence': 'Policy Intelligence',
    'compliance': 'Compliance Command',
    'recommendations': 'Recommendations',
    'team': 'Team Management',
    'settings': 'Settings',
    'data-ingestion': 'Data Ingestion',
    'bulk-import': 'Bulk Import',
    'edit-permissions': 'Edit Permissions',
    'user-profile': 'User Profile',
    'login': 'Login',
    'register': 'Register',
    'new': 'New',
    'edit': 'Edit',
  };

  const breadcrumbs: BreadcrumbItem[] = [];
  let currentPath = '';

  segments.forEach((segment, index) => {
    if (!segment) return;
    
    currentPath += `/${segment}`;
    const label = routeLabels[segment] || formatSegment(segment);
    
    breadcrumbs.push({
      label,
      href: currentPath,
    });
  });

  return breadcrumbs;
}

/**
 * Format segment for display (fallback)
 */
function formatSegment(segment: string): string {
  return segment
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
