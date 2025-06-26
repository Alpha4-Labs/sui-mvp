import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  HeartIcon as HeartOutline, 
  ShareIcon, 
  ClockIcon,
  TagIcon,
  UserGroupIcon,
  SparklesIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid';
import { Button } from './ui/Button';
import { useMarketplaceStore } from '../stores/marketplaceStore';
import type { PerkData } from '../stores/marketplaceStore';
import { brandConfig } from '../config/brand';

interface PerkCardProps {
  perk: PerkData;
  onClaim: (perkId: string) => void;
  isLoading?: boolean;
  gridView?: 'compact' | 'comfortable' | 'spacious';
}

export const PerkCard: React.FC<PerkCardProps> = ({ 
  perk, 
  onClaim, 
  isLoading = false,
  gridView = 'comfortable'
}) => {
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [shareTooltip, setShareTooltip] = useState(false);
  
  const { 
    favoritePerks, 
    claimedPerks, 
    userBalance,
    toggleFavorite,
    canAffordPerk 
  } = useMarketplaceStore();
  
  const isFavorite = favoritePerks.has(perk.id);
  const isClaimed = claimedPerks.has(perk.id);
  const canAfford = canAffordPerk(perk.id);
  const isExpired = perk.expiresAt && perk.expiresAt < new Date();
  
  // Handle both camelCase and snake_case formats
  const maxClaims = perk.maxClaims || perk.max_claims;
  const claimCount = perk.claimCount || perk.totalClaimsCount || perk.total_claims_count || 0;
  const claimPercentage = maxClaims ? (claimCount / maxClaims) * 100 : 0;
  const isLowStock = maxClaims && (maxClaims - claimCount) <= 5;
  
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat().format(price);
  };
  
  const formatTimeRemaining = (expiresAt: Date) => {
    const now = new Date();
    const diff = expiresAt.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h`;
    return 'Expires soon';
  };
  
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: perk.name,
          text: perk.description,
          url: window.location.href,
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      setShareTooltip(true);
      setTimeout(() => setShareTooltip(false), 2000);
    }
  };
  
  const cardVariants = {
    rest: {
      scale: 1,
      y: 0,
      transition: { duration: 0.2 }
    },
    hover: {
      scale: gridView === 'compact' ? 1.02 : 1.03,
      y: -4,
      transition: { duration: 0.2 }
    },
    tap: {
      scale: 0.98,
      transition: { duration: 0.1 }
    }
  };
  
  const getCardHeight = () => {
    switch (gridView) {
      case 'compact': return 'h-80';
      case 'spacious': return 'h-96';
      default: return 'h-88';
    }
  };
  
  return (
    <motion.div
      variants={cardVariants}
      initial="rest"
      whileHover="hover"
      whileTap="tap"
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className={`
        ${getCardHeight()} bg-[var(--color-background-card)]/80 backdrop-blur-lg
        border border-[var(--color-border)] rounded-2xl overflow-hidden
        shadow-lg hover:shadow-xl transition-all duration-300
        relative group cursor-pointer
        ${isExpired ? 'opacity-75 grayscale' : ''}
        ${isClaimed ? 'ring-2 ring-[var(--color-success)]/50' : ''}
      `}
    >
      {/* Status Badges */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
        {isClaimed && (
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            className="flex items-center gap-1 bg-[var(--color-success)]/90 text-white px-2 py-1 rounded-full text-xs font-medium backdrop-blur-sm"
          >
            <CheckCircleIcon className="w-3 h-3" />
            Claimed
          </motion.div>
        )}
        
        {isExpired && (
          <div className="flex items-center gap-1 bg-red-500/90 text-white px-2 py-1 rounded-full text-xs font-medium backdrop-blur-sm">
            <ExclamationTriangleIcon className="w-3 h-3" />
            Expired
          </div>
        )}
        
        {isLowStock && !isExpired && (
          <div className="flex items-center gap-1 bg-orange-500/90 text-white px-2 py-1 rounded-full text-xs font-medium backdrop-blur-sm">
            <SparklesIcon className="w-3 h-3" />
            Low Stock
          </div>
        )}
      </div>
      
      {/* Action Buttons */}
      <div className="absolute top-3 right-3 z-10 flex gap-2">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(perk.id);
          }}
          className="p-2 rounded-full bg-black/20 backdrop-blur-md hover:bg-black/30 transition-colors"
        >
          {isFavorite ? (
            <HeartSolid className="w-5 h-5 text-red-500" />
          ) : (
            <HeartOutline className="w-5 h-5 text-white" />
          )}
        </motion.button>
        
        <div className="relative">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => {
              e.stopPropagation();
              handleShare();
            }}
            className="p-2 rounded-full bg-black/20 backdrop-blur-md hover:bg-black/30 transition-colors"
          >
            <ShareIcon className="w-5 h-5 text-white" />
          </motion.button>
          
          {shareTooltip && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="absolute -bottom-8 right-0 bg-black/80 text-white px-2 py-1 rounded text-xs whitespace-nowrap"
            >
              Copied to clipboard!
            </motion.div>
          )}
        </div>
      </div>
      
      {/* Image */}
      <div className="relative h-40 overflow-hidden">
        {perk.imageUrl && !imageError ? (
          <motion.img
            src={perk.imageUrl}
            alt={perk.name}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.3 }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[var(--color-primary)]/20 to-[var(--color-secondary)]/20 flex items-center justify-center">
            <TagIcon className="w-12 h-12 text-[var(--color-text-muted)]" />
          </div>
        )}
        
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        
        {/* Price Badge */}
        <div className="absolute bottom-3 left-3">
          <div className="bg-black/60 backdrop-blur-md text-white px-3 py-1 rounded-full text-sm font-bold">
            {formatPrice(perk.price)} {brandConfig.features.showUSDPricing ? 'AP' : 'Points'}
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4 flex flex-col flex-1">
        {/* Company */}
        {brandConfig.features.showPartnerNames && (
          <div className="text-xs text-[var(--color-text-muted)] mb-1 uppercase tracking-wide">
            {perk.company}
          </div>
        )}
        
        {/* Title */}
        <h3 className="font-bold text-[var(--color-text)] text-lg mb-2 line-clamp-2 group-hover:text-[var(--color-primary)] transition-colors">
          {perk.name}
        </h3>
        
        {/* Description */}
        <p className="text-[var(--color-text-muted)] text-sm mb-3 line-clamp-2 flex-1">
          {perk.description}
        </p>
        
        {/* Tags */}
        {perk.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {perk.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-xs bg-[var(--color-primary)]/10 text-[var(--color-primary)] px-2 py-1 rounded-full"
              >
                {tag}
              </span>
            ))}
            {perk.tags.length > 3 && (
              <span className="text-xs text-[var(--color-text-muted)]">
                +{perk.tags.length - 3} more
              </span>
            )}
          </div>
        )}
        
        {/* Stats */}
        <div className="flex items-center gap-4 mb-3 text-xs text-[var(--color-text-muted)]">
          {brandConfig.features.showClaimCounts && (
            <div className="flex items-center gap-1">
              <UserGroupIcon className="w-4 h-4" />
              {perk.claimCount} claimed
            </div>
          )}
          
          {perk.expiresAt && !isExpired && (
            <div className="flex items-center gap-1">
              <ClockIcon className="w-4 h-4" />
              {formatTimeRemaining(perk.expiresAt)}
            </div>
          )}
        </div>
        
        {/* Progress Bar for Limited Perks */}
        {perk.maxClaims && (
          <div className="mb-3">
            <div className="flex justify-between text-xs text-[var(--color-text-muted)] mb-1">
              <span>Availability</span>
              <span>{perk.maxClaims - perk.claimCount} left</span>
            </div>
            <div className="w-full bg-[var(--color-background)]/50 rounded-full h-2">
              <motion.div
                className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] h-2 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${claimPercentage}%` }}
                transition={{ duration: 1, delay: 0.2 }}
              />
            </div>
          </div>
        )}
        
        {/* Action Button */}
        <Button
          onClick={(e) => {
            e.stopPropagation();
            onClaim(perk.id);
          }}
          disabled={isLoading || isClaimed || isExpired || !canAfford}
          loading={isLoading}
          variant={isClaimed ? 'success' : canAfford ? 'default' : 'secondary'}
          className="w-full mt-auto"
          animation="shimmer"
        >
          {isClaimed ? (
            <>
              <CheckCircleIcon className="w-4 h-4 mr-2" />
              Claimed
            </>
          ) : isExpired ? (
            'Expired'
          ) : !canAfford ? (
            `Need ${formatPrice(perk.price - userBalance)} more points`
          ) : (
            'Claim Perk'
          )}
        </Button>
      </div>
      
      {/* Hover glow effect */}
      <motion.div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: isHovered ? 0.1 : 0 }}
        transition={{ duration: 0.2 }}
        style={{
          background: `linear-gradient(135deg, var(--color-primary), var(--color-secondary))`,
        }}
      />
    </motion.div>
  );
}; 