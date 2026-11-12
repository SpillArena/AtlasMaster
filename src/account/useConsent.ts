import { useEffect, useState } from 'react'
import { getConsent, getConsentParts, onConsentChange, type ConsentPart, type ConsentStatus } from './consent'

/** The current consent answer as React state, following changes in this tab and others. */
export function useConsent(): ConsentStatus {
    const [status, setStatus] = useState<ConsentStatus>(getConsent)
    useEffect(() => onConsentChange(setStatus), [])
    return status
}

/** The parts the player has said yes to, as React state. */
export function useConsentParts(): ConsentPart[] {
    const [parts, setParts] = useState<ConsentPart[]>(getConsentParts)
    useEffect(() => onConsentChange(() => setParts(getConsentParts())), [])
    return parts
}
