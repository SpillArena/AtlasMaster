import { useEffect, useState } from 'react'
import { getConsent, onConsentChange, type ConsentStatus } from './consent'

/** The current consent answer as React state, following changes in this tab and others. */
export function useConsent(): ConsentStatus {
    const [status, setStatus] = useState<ConsentStatus>(getConsent)
    useEffect(() => onConsentChange(setStatus), [])
    return status
}
