/**
 * Agora UI - the design-system barrel.
 *
 *   import { Button, Card, StatusBadge, toast } from '@/components/ui';
 *
 * Everything here is plain React 19 + Tailwind v4. There is no Radix, no Base
 * UI and no shadcn CLI in this project: overlays are built on the native
 * <dialog> element, menus on a click-outside listener, and every control on a
 * real form element so the keyboard and screen readers work by default.
 *
 * Note that most of these modules are client components. A server component
 * may import them freely, but if you only need one, import it from its own
 * file to keep the client bundle small.
 */

export * from './avatar';
export * from './badge';
export * from './button';
export * from './card';
export * from './checkbox';
export * from './dialog';
export * from './dropdown';
export * from './empty-state';
export * from './input';
export * from './label';
export * from './prompt-dialog';
export * from './select';
export * from './skeleton';
export * from './spinner';
export * from './status-badge';
export * from './table';
export * from './tabs';
export * from './toast';
