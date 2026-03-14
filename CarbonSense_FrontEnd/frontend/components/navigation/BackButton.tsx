'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Button from '@/components/Button';

interface BackButtonProps {
  href?: string;
  label?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  showIcon?: boolean;
}

/**
 * Back button component for navigation
 * Uses router.back() if no href provided, otherwise navigates to specific route
 */
export function BackButton({ 
  href, 
  label = 'Back', 
  variant = 'ghost',
  showIcon = true 
}: BackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    if (href) {
      router.push(href);
    } else {
      router.back();
    }
  };

  return (
    <Button 
      variant={variant} 
      onClick={handleBack}
      className="gap-2"
    >
      {showIcon && <ArrowLeft className="h-4 w-4" />}
      {label}
    </Button>
  );
}
