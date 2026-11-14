import type { NextFunction, Request, Response } from 'express'
import { COOKIE_NAME, isLoopback, safeEqual, sessionValue } from './config.js'

export interface Device {
  ip: string
  userAgent: string
  firstSeen: number
  lastSeen: number
}

/** In-memory record of paired phones, only used for the pairing screen. */
const devices = new Map<string, Device>()

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index < 0) continue
    out[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim())
  }
  return out
}

export function isAuthenticated(req: Request, token: string): boolean {
  const cookies = parseCookies(req.headers.cookie)
  return safeEqual(cookies[COOKIE_NAME], sessionValue(token))
}

export function sessionCookie(token: string, days: number): string {
  const maxAge = Math.round(days * 24 * 60 * 60)
  return [
    `${COOKIE_NAME}=${sessionValue(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ].join('; ')
}

export function clearedCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}

export function requireAuth(token: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (isAuthenticated(req, token)) {
      touchDevice(req)
      next()
      return
    }
    res.status(401).json({ error: 'Not paired. Scan the QR code shown on the PC.' })
  }
}

export function requireLocal(allowRemote: boolean) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (allowRemote || isLoopback(req.ip)) {
      next()
      return
    }
    res.status(403).json({ error: 'This is only available on the PC running translator.' })
  }
}

export function touchDevice(req: Request): void {
  const key = `${req.ip}|${req.headers['user-agent'] ?? 'unknown'}`
  const now = Date.now()
  const existing = devices.get(key)
  if (existing) {
    existing.lastSeen = now
    return
  }
  devices.set(key, {
    ip: req.ip ?? 'unknown',
    userAgent: req.headers['user-agent'] ?? 'unknown',
    firstSeen: now,
    lastSeen: now,
  })
}

export function listDevices(): Device[] {
  const cutoff = Date.now() - 1000 * 60 * 60 * 24 * 30
  for (const [key, device] of devices) {
    if (device.lastSeen < cutoff) devices.delete(key)
  }
  return [...devices.values()].sort((a, b) => b.lastSeen - a.lastSeen)
}


