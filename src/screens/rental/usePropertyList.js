// ============================================================
//  usePropertyList.js
//  Fixes a real, long-standing bug: 5 screens (RentalProperties,
//  RentalAgreement, PropertyDetails, ClaimsLedger, ClaimsReport) read
//  the property list from CONFIG.rentalProperties, a hardcoded array
//  in config.js. Every "Add Property" flow did
//  CONFIG.rentalProperties.push(...), which only mutates the
//  in-memory object for that page load -- never persisted, so a
//  newly added property (the reported case: a US property) vanished
//  from every screen the moment the page reloaded, even though it
//  WAS correctly saved to rental_props.
//
//  This hook gives every screen ONE live, database-backed source of
//  truth via the getAllProperties action (rental_props JOIN
//  property_details), with the same field shape CONFIG.rentalProperties
//  used to provide (id, name, location, unitNo, floor, building,
//  hasParking, electricityConsumerNo, furnishing, country, plus the
//  new fullAddress convenience field) so existing screens need minimal
//  changes beyond swapping their data source.
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import { api } from '../../api'

export function usePropertyList() {
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getAllProperties()
      setProperties(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('usePropertyList: getAllProperties failed:', e)
      setError(e?.message || 'Failed to load properties')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { reload() }, [reload])

  return { properties, loading, error, reload }
}
