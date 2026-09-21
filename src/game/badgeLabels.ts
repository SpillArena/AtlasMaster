import type { AccountBadgeLabels, AuthAction, AuthErrorCode } from '../account'

/**
 * Oversetter merket i hjørnet.
 *
 * `src/account/` er kopiert ordrett inn i alle fem spillene og kan derfor ikke
 * importere i18n-oppsettet til noe av dem — hvert repo har sitt eget. Merket
 * tar strenger som props i stedet, og denne filen er AtlasMaster sin side av
 * den avtalen.
 *
 * FEILKODENE ER STABILE STRENGER, ikke setninger. Det er med vilje: en setning
 * fra en Worker kan bare vises slik den er, på det språket den tilfeldigvis ble
 * skrevet på. Koden oversettes her, der språket bor.
 */

type T = (key: string, options?: Record<string, unknown>) => string

const ERRORS: Record<string, string> = {
    bad_credentials: 'account.errBadCredentials',
    name_taken: 'account.errNameTaken',
    username_empty: 'account.errUsernameEmpty',
    username_too_long: 'account.errUsernameTooLong',
    username_chars: 'account.errUsernameChars',
    bad_username: 'account.errUsernameChars',
    name_reserved: 'account.errNameReserved',
    name_not_allowed: 'account.errNameNotAllowed',
    bad_pin: 'account.errBadPin',
    locked: 'account.errLocked',
    not_configured: 'account.errNotConfigured',
    unreachable: 'account.errUnreachable',
    unauthorized: 'account.errUnauthorized',
}

/** Sekunder som noe et menneske ville sagt. */
function wait(t: T, seconds: number): string {
    if (seconds < 60) return t('account.waitSeconds', { count: seconds })
    const minutes = Math.ceil(seconds / 60)
    return minutes === 1 ? t('account.waitMinute') : t('account.waitMinutes', { count: minutes })
}

export function badgeLabels(t: T): Partial<AccountBadgeLabels> {
    return {
        signedOut: t('account.signedOut'),
        signedInAs: (name: string) => t('account.signedInAs', { name }),
        signIn: t('account.signIn'),
        register: t('account.register'),
        username: t('account.usernameLabel'),
        pin: t('account.pinLabel'),
        confirmPin: t('account.repeatPinLabel'),
        pinMismatch: t('account.errPinMismatch'),
        submitSignIn: t('account.submitSignIn'),
        submitRegister: t('account.submitRegister'),
        working: t('account.working'),
        signOut: t('account.signOut'),
        profile: t('account.profile'),
        guestHint: t('account.badgeGuestHint'),
        error: (code: AuthErrorCode, action: AuthAction, retryAfter?: number) => {
            // utestenging med et tall er noe spilleren kan handle på; uten
            // tallet er det bare et nei
            if (code === 'locked' && retryAfter && retryAfter > 0) {
                return t('account.errLockedWait', { wait: wait(t, retryAfter) })
            }
            const key = ERRORS[code]
            if (key) return t(key)
            // ukjent kode: si i det minste hva som ikke gikk
            return t(action === 'register' ? 'account.errCreateFailed' : 'account.errSignInFailed')
        },
    }
}
