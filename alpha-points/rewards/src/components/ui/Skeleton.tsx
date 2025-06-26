import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface SkeletonProps {
  className?: string;
  variant?: 'default' | 'circular' | 'rectangular' | 'text';
  animation?: 'pulse' | 'wave' | 'none';
  width?: string | number;
  height?: string | number;
}

const Skeleton: React.FC<SkeletonProps> = ({
  className,
  variant = 'default',
  animation = 'pulse',
  width,
  height,
}) => {
  const baseClass = cn(
    'bg-gradient-to-r from-[var(--color-background)]/50 via-[var(--color-border)] to-[var(--color-background)]/50',
    {
      'rounded-md': variant === 'default' || variant === 'rectangular',
      'rounded-full': variant === 'circular',
      'rounded-sm': variant === 'text',
    },
    className
  );

  const style = {
    width: width,
    height: height,
  };

  if (animation === 'wave') {
    return (
      <div className={cn(baseClass, 'relative overflow-hidden')} style={style}>
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
          animate={{
            x: ['-100%', '100%'],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>
    );
  }

  if (animation === 'pulse') {
    return (
      <motion.div
        className={baseClass}
        style={style}
        animate={{
          opacity: [0.5, 1, 0.5],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    );
  }

  return <div className={baseClass} style={style} />;
};

// Perk Card Skeleton
export const PerkCardSkeleton: React.FC<{ gridView?: 'compact' | 'comfortable' | 'spacious' }> = ({ 
  gridView = 'comfortable' 
}) => {
  const getCardHeight = () => {
    switch (gridView) {
      case 'compact': return 'h-80';
      case 'spacious': return 'h-96';
      default: return 'h-88';
    }
  };

  return (
    <div className={`${getCardHeight()} bg-[var(--color-background-card)]/80 backdrop-blur-lg border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-lg`}>
      {/* Image skeleton */}
      <Skeleton className="h-40 w-full" animation="wave" />
      
      {/* Content skeleton */}
      <div className="p-4 space-y-3">
        {/* Company name */}
        <Skeleton className="h-3 w-20" />
        
        {/* Title */}
        <Skeleton className="h-6 w-3/4" />
        
        {/* Description */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
        
        {/* Tags */}
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-12 rounded-full" />
        </div>
        
        {/* Stats */}
        <div className="flex gap-4">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
        
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-12" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
        
        {/* Button */}
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    </div>
  );
};

// Grid Skeleton
export const PerkGridSkeleton: React.FC<{ 
  count?: number; 
  gridView?: 'compact' | 'comfortable' | 'spacious' 
}> = ({ 
  count = 6, 
  gridView = 'comfortable' 
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.1 }}
        >
          <PerkCardSkeleton gridView={gridView} />
        </motion.div>
      ))}
    </div>
  );
};

// Header Skeleton
export const HeaderSkeleton: React.FC = () => {
  return (
    <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
      <div className="flex items-center gap-4">
        <Skeleton variant="circular" width={40} height={40} />
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-24 rounded-xl" />
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>
    </div>
  );
};

// Filter Bar Skeleton
export const FilterBarSkeleton: React.FC = () => {
  return (
    <div className="flex items-center gap-4 p-4 bg-[var(--color-background-card)]/50 backdrop-blur-sm rounded-xl border border-[var(--color-border)]">
      <Skeleton className="h-8 w-8 rounded-lg" />
      <Skeleton className="h-8 flex-1 rounded-lg" />
      <Skeleton className="h-8 w-20 rounded-lg" />
      <Skeleton className="h-8 w-16 rounded-lg" />
    </div>
  );
};

// Balance Card Skeleton
export const BalanceCardSkeleton: React.FC = () => {
  return (
    <div className="bg-[var(--color-background-card)]/80 backdrop-blur-lg border border-[var(--color-border)] rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-5 w-24" />
        <Skeleton variant="circular" width={32} height={32} />
      </div>
      
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-32" />
      </div>
      
      <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    </div>
  );
};

// Modal Skeleton
export const ModalSkeleton: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--color-background-card)]/95 backdrop-blur-lg border border-[var(--color-border)] rounded-2xl shadow-2xl p-6 w-full max-w-2xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton variant="circular" width={32} height={32} />
        </div>
        
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-10 flex-1 rounded-lg" />
          ))}
        </div>
        
        {/* Content */}
        <div className="space-y-4 mb-6">
          <Skeleton className="h-12 w-full rounded-xl" />
          
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        </div>
        
        {/* Footer */}
        <div className="flex gap-3 pt-4 border-t border-[var(--color-border)]">
          <Skeleton className="h-10 flex-1 rounded-xl" />
          <Skeleton className="h-10 flex-1 rounded-xl" />
        </div>
      </div>
    </div>
  );
};

export { Skeleton }; 