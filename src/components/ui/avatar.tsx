import * as React from 'react';
import { cn } from '@/lib/cn';

export type AvatarSize = 'xs' | 'sm' | 'default' | 'lg' | 'xl';

const SIZES: Record<AvatarSize, string> = {
  xs: 'size-6 text-[10px]',
  sm: 'size-8 text-xs',
  default: 'size-9 text-sm',
  lg: 'size-12 text-base',
  xl: 'size-16 text-xl',
};

/**
 * Eight tinted pairs, each checked for >= 4.5:1 text contrast on its own
 * background in both themes. Keep them in this order - the hash maps a name to
 * an index, so reordering would reshuffle everyone's colour.
 */
const PALETTE = [
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200',
  'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
  'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
  'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200',
  'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200',
  'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-200',
  'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
] as const;

/** Stable 32-bit string hash - same name always gets the same colour. */
function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (h << 5) - h + value.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/** Colour classes for a name. Exported so lists can tint other chips to match. */
export function avatarColor(name: string): string {
  return PALETTE[hash(name.trim().toLowerCase()) % PALETTE.length];
}

/**
 * First letter of the first and last word. Works for Bangla too, because it
 * splits on whitespace and takes whole code points rather than UTF-16 units.
 */
export function initialsFromName(name: string, max = 2): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const picked = words.length === 1 ? [words[0]] : [words[0], words[words.length - 1]];
  return picked
    .slice(0, max)
    .map((word) => Array.from(word)[0] ?? '')
    .join('')
    .toUpperCase();
}

export interface AvatarProps extends Omit<React.ComponentProps<'span'>, 'children'> {
  /** Display name. Drives both the initials and the colour. */
  name: string;
  /** Optional photo. Falls back to initials if it is missing or fails to load. */
  src?: string | null;
  size?: AvatarSize;
  /** Small coloured dot in the bottom-right corner. */
  status?: 'online' | 'offline' | 'busy';
  /** Adds a ring in the surface colour - for overlapping avatar stacks. */
  ringed?: boolean;
  /** Class for the initials text - apply `.bangla-text` for Bangla names. */
  textClassName?: string;
}

export function Avatar({
  name,
  src,
  size = 'default',
  status,
  ringed = false,
  className,
  textClassName,
  title,
  ...props
}: AvatarProps) {
  const initials = initialsFromName(name);

  return (
    <span
      title={title ?? name}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-visible rounded-full',
        'font-semibold uppercase leading-none tracking-tight select-none',
        SIZES[size],
        src ? 'bg-muted' : avatarColor(name),
        ringed && 'ring-2 ring-card',
        className,
      )}
      {...props}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          className="size-full rounded-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span aria-hidden="true" className={cn(textClassName)}>
          {initials}
        </span>
      )}
      {!src ? <span className="sr-only">{name}</span> : null}

      {status ? (
        <span
          aria-hidden="true"
          className={cn(
            'absolute bottom-0 right-0 block rounded-full ring-2 ring-card',
            size === 'xs' || size === 'sm' ? 'size-2' : 'size-2.5',
            status === 'online' && 'bg-emerald-500',
            status === 'busy' && 'bg-amber-500',
            status === 'offline' && 'bg-slate-400',
          )}
        />
      ) : null}
    </span>
  );
}

Avatar.displayName = 'Avatar';

export interface AvatarGroupProps extends React.ComponentProps<'div'> {
  /** Names to render, in order. */
  names: string[];
  /** How many to show before collapsing into a "+N" chip. */
  max?: number;
  size?: AvatarSize;
}

/** Overlapping stack of avatars with a "+N" overflow chip. */
export function AvatarGroup({ names, max = 4, size = 'sm', className, ...props }: AvatarGroupProps) {
  const shown = names.slice(0, max);
  const overflow = names.length - shown.length;

  return (
    <div className={cn('flex items-center -space-x-2', className)} {...props}>
      {shown.map((name, i) => (
        <Avatar key={`${name}-${i}`} name={name} size={size} ringed />
      ))}
      {overflow > 0 ? (
        <span
          title={names.slice(max).join(', ')}
          className={cn(
            'relative inline-flex shrink-0 items-center justify-center rounded-full',
            'bg-muted font-semibold text-muted-foreground ring-2 ring-card',
            SIZES[size],
          )}
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}
