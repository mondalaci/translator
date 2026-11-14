import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Playing the synthesised speech on the PC rather than on the phone is the point
 * of the whole feature: the desktop is where the headphones are, so a look-up
 * from the phone is heard in-game. This shells out to whatever audio player the
 * machine has, preferring the PipeWire/PulseAudio native ones.
 */

interface Player {
  command: string
  args: (file: string) => string[]
}

const PLAYERS: Player[] = [
  { command: 'paplay', args: (file) => [file] },
  { command: 'pw-play', args: (file) => [file] },
  { command: 'ffplay', args: (file) => ['-nodisp', '-autoexit', '-loglevel', 'error', file] },
  { command: 'mpv', args: (file) => ['--no-video', '--really-quiet', file] },
  { command: 'aplay', args: (file) => ['-q', file] },
]

let current: ChildProcess | null = null
let currentName: string | null = null

function inPath(command: string): boolean {
  const parts = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)
  for (const dir of parts) {
    try {
      fs.accessSync(path.join(dir, command), fs.constants.X_OK)
      return true
    } catch {
      /* keep looking */
    }
  }
  return false
}

export function detectPlayer(configured: string): string | null {
  const wanted = configured.trim()
  if (wanted) return inPath(wanted) ? wanted : null
  for (const player of PLAYERS) if (inPath(player.command)) return player.command
  return null
}

function argsFor(command: string, file: string): string[] {
  const known = PLAYERS.find((player) => player.command === command)
  return known ? known.args(file) : [file]
}

export interface Playback {
  player: string
  pid: number | null
}

/** Starts playback, cutting off whatever was still playing. */
export function playOnHost(file: string, configured: string): Promise<Playback> {
  const command = detectPlayer(configured)
  if (!command) {
    return Promise.reject(
      new Error(
        configured
          ? `Player "${configured}" was not found in PATH.`
          : 'No audio player found — install paplay, pw-play, ffplay, mpv or aplay.',
      ),
    )
  }
  stopPlayback()

  return new Promise<Playback>((resolve, reject) => {
    const child = spawn(command, argsFor(command, file), {
      stdio: 'ignore',
      detached: true,
    })
    let settled = false

    child.once('error', (error) => {
      if (settled) return
      settled = true
      if (current === child) current = null
      reject(new Error(`${command} could not start: ${error.message}`))
    })

    child.once('spawn', () => {
      settled = true
      current = child
      currentName = command
      child.unref()
      resolve({ player: command, pid: child.pid ?? null })
    })

    child.once('exit', () => {
      if (current === child) {
        current = null
        currentName = null
      }
    })
  })
}

export function stopPlayback(): boolean {
  if (!current) return false
  try {
    if (current.pid) process.kill(-current.pid, 'SIGTERM')
    else current.kill('SIGTERM')
  } catch {
    try {
      current.kill('SIGTERM')
    } catch {
      /* already gone */
    }
  }
  current = null
  currentName = null
  return true
}

export function playbackState(): { playing: boolean; player: string | null } {
  return { playing: current !== null, player: currentName }
}
