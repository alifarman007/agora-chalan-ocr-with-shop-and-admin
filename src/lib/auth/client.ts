'use client'
import { createAuthClient } from 'better-auth/react'

/**
 * No baseURL on purpose.
 *
 * Better Auth then calls the origin the page was served from, which is always right:
 * localhost in development, the production domain in production, and the one-off
 * deployment URL on a preview. Hard-coding NEXT_PUBLIC_APP_URL here breaks sign-in the
 * moment you open any URL that does not match it exactly — the request goes to the
 * other host, fails, and the form can only say "could not sign in".
 */
export const authClient = createAuthClient()

export const { signIn, signOut, useSession } = authClient
