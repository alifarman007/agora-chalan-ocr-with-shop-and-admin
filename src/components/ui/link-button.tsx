'use client'

/**
 * A Next.js <Link> that looks like a Button.
 *
 * Button has no `asChild`, and `buttonVariants` lives in a 'use client' module, so a
 * Server Component cannot call it directly. This component can be rendered from the
 * server because it is a client component itself.
 */
import Link from 'next/link'
import type { ComponentProps } from 'react'
import { buttonVariants, type ButtonSize, type ButtonVariant } from './button'
import { cn } from '@/lib/cn'

export type LinkButtonProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant
  size?: ButtonSize
}

export function LinkButton({ variant, size, className, ...props }: LinkButtonProps) {
  return <Link {...props} className={cn(buttonVariants({ variant, size }), className)} />
}
