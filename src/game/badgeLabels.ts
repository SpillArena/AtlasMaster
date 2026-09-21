import type { AccountBadgeLabels, AuthErrorCode } from '../account'

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
export function badgeLabels(
    t: (key: string, options?: Record<string, unknown>) => string,
): Partial<AccountBadgeLabels> {
    const errors: Record<string, string> = {
        bad_credentials: 'account.errBadCredentials',
        bad_username: 'account.errBadUsername',
        bad_pin: 'account.errBadPin',
        name_taken: 'account.errNameTaken',
        locked: 'account.errLocked',
        not_configured: 'account.errNotConfigured',
        unreachable: 'account.errUnreachable',
    }

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
        error: (code: AuthErrorCode) => t(errors[code] ?? 'account.errGeneric'),
    }
}
