import { useEffect, useState, type ReactNode } from 'react'
import { getSession, onSessionChange } from './session'

// The player's SpillArena profile picture, for every game.
//
// The picture is chosen on the front page and drawn by /api/avatar, so a game
// needs no DiceBear of its own: it asks which picture the account has, then
// points an <img> at the renderer. Guests, a failed lookup and an account that
// never picked one all render `fallback` — the game's own placeholder — so the
// picture is an upgrade, never a requirement.

const API_BASE = (import.meta.env.VITE_ACCOUNT_API as string | undefined) ?? '/api'

interface Choice {
    style: string
    seed: string
    options?: Record<string, string>
}

/** One lookup per token per page load; a new token (sign-in) asks again. */
const lookups = new Map<string, Promise<Choice | null>>()

function lookup(token: string): Promise<Choice | null> {
    let pending = lookups.get(token)
    if (!pending) {
        pending = fetch(`${API_BASE}/account/avatar`, { headers: { Authorization: `Bearer ${token}` } })
            .then((response) => (response.ok ? response.json() : null))
            .then((body: { avatar?: Choice | null } | null) => body?.avatar ?? null)
            .catch(() => null)
        lookups.set(token, pending)
    }
    return pending
}

function imageUrl(choice: Choice): string {
    const params = new URLSearchParams({ style: choice.style, seed: choice.seed })
    if (choice.options) params.set('o', JSON.stringify(choice.options))
    return `${API_BASE}/avatar?${params}`
}

/** The picture URL of the signed-in player, or null until known / when none. */
function useAvatarUrl(): string | null {
    const [token, setToken] = useState<string | null>(() => getSession()?.token ?? null)
    const [found, setFound] = useState<{ token: string; url: string | null } | null>(null)

    useEffect(() => onSessionChange((session) => setToken(session?.token ?? null)), [])

    useEffect(() => {
        if (!token) return
        let cancelled = false
        void lookup(token).then((choice) => {
            if (!cancelled) setFound({ token, url: choice ? imageUrl(choice) : null })
        })
        return () => {
            cancelled = true
        }
    }, [token])

    return token && found?.token === token ? found.url : null
}

/**
 * The picture, or `fallback` when there is none.
 *
 * Without `size` the picture fills whatever box the caller gives it. With
 * `size` (px) it brings its own small rounded frame and renders nothing at all
 * when there is no picture — for "Posting as <name>" lines, where an empty
 * square would be worse than no picture.
 */
export function PlayerAvatar({ fallback = null, className, size }: { fallback?: ReactNode; className?: string; size?: number }) {
    const url = useAvatarUrl()
    if (!url) return <>{fallback}</>
    const image = (
        <img
            src={url}
            alt=""
            aria-hidden="true"
            draggable={false}
            className={className}
            style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
        />
    )
    if (!size) return image
    return (
        <span
            aria-hidden="true"
            style={{
                display: 'inline-block',
                width: size,
                height: size,
                flexShrink: 0,
                overflow: 'hidden',
                borderRadius: Math.round(size * 0.26),
                verticalAlign: 'middle',
                marginRight: Math.round(size * 0.3),
            }}
        >
            {image}
        </span>
    )
}

/**
 * Another player's picture, looked up by name — for rooms, lineups and podiums.
 * A player without one (404) or a failed load shows `fallback`, usually their
 * initial, so a room never has a hole where a picture should be. The picture
 * fills the box the caller gives it.
 */
export function UserAvatar({ name, fallback = null, className }: { name: string; fallback?: ReactNode; className?: string }) {
    const [failed, setFailed] = useState<string | null>(null)
    if (!name || failed === name) return <>{fallback}</>
    return (
        <img
            src={`${API_BASE}/avatar?u=${encodeURIComponent(name)}`}
            alt=""
            aria-hidden="true"
            draggable={false}
            loading="lazy"
            className={className}
            onError={() => setFailed(name)}
            style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
        />
    )
}
