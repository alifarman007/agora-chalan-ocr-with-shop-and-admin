/**
 * Loads env files the way Next.js does, for scripts run outside Next (migrate, seed).
 * Precedence: .env.local wins over .env.
 */
import { config } from 'dotenv'
config({ path: '.env.local', quiet: true })
config({ path: '.env', quiet: true })
