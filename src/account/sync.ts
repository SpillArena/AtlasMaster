import { fetchProfile, pushProfile } from './api'
import { isSignedIn, onSessionChange } from './session'
import type { GameId } from './types'

/**
 * Ties a game's local profile to the account, in both directions.
 *
 * The game keeps working exactly as before when nobody is signed in — the
 * local copy is still the source the game reads from, and this only mirrors
 * it. That ordering is deliberate: a network that is down, or an account
 * nobody made, must never cost a player the round they just finished.
 *
 * The merge belongs to the game. Only the game knows whether a field should
 * take the larger value, the union, or the newer one. What this file
 * guarantees is WHEN it happens, not what it decides.
 */
export interface ProfileSyncOptions<T> {
    game: GameId
    /** The profile as it stands on this device, right now. */
    read: () => T
    /**
     * Combines what the account had with what the device has.
     *
     * Must be safe to run repeatedly: `pull` can be called on every start and
     * on every sign-in. A merge that only ever grows each field is the easy way
     * to get that — then running it twice changes nothing.
     */
    merge: (local: T, remote: T | null) => T
    /** Stores the merged profile locally. */
    write: (merged: T) => void
}

export interface ProfileSync {
    /** Pull the account's copy, merge it in, write the result back up. */
    pull: () => Promise<void>
    /** Push the local copy — call after a finished round. Never blocks. */
    push: () => void
    /** Pull on sign-in, in this tab or another. Returns an unsubscribe. */
    watch: () => () => void
}

export function createProfileSync<T>(options: ProfileSyncOptions<T>): ProfileSync {
    const { game, read, merge, write } = options

    const pull = async (): Promise<void> => {
        if (!isSignedIn()) return
        const result = await fetchProfile<T>(game)
        if (!result.ok) return

        const merged = merge(read(), result.data.progress)
        write(merged)
        /*
         * Written straight back up, whether or not the account had anything.
         * That covers both 'the account had not heard about this device yet'
         * and 'the account was already current' — the second is a harmless
         * rewrite of the same row, and telling them apart costs more than it
         * saves.
         */
        void pushProfile(game, merged)
    }

    const push = (): void => {
        if (!isSignedIn()) return
        void pushProfile(game, read())
    }

    const watch = (): (() => void) =>
        onSessionChange((session) => {
            if (session) void pull()
        })

    return { pull, push, watch }
}
