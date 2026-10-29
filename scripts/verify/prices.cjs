/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-require-imports, no-unused-vars */
module.exports = function (context) {
  const { db, clientId, crusherId, materialTypeId, openShiftId, runCase, result, createTrip, createClient, createCrusher, getSuggestedTripPrices, getTripById, hasFieldErrors, hasExactFieldError } = context
  function insertSuggestionTrip(id, clientId, crusherId, tripDate, prices, options = {}) {
    db.prepare("INSERT INTO Trip (id, shift_id, trip_date, crusher_cubic, client_cubic_reported, crusher_id, stone_price, crusher_receipt_status, client_id, transport_price, client_price, recipient_name_status, material_type_id, location) VALUES (?, ?, ?, 1, 1, ?, ?, 'UNKNOWN', ?, ?, ?, 'UNCLEAR', ?, ?)").run(
      id,
      openShiftId,
      tripDate,
      crusherId,
      prices[0],
      clientId,
      prices[1],
      prices[2],
      options.materialTypeId === undefined ? materialTypeId : options.materialTypeId,
      options.location ?? null
    )
  }
  function newSuggestionPair(name, clientInitialPrice, crusherInitialPrice) {
    const clientResult = createClient({ name: name + ' Client', initialPrice: clientInitialPrice })
    const crusherResult = createCrusher({ name: name + ' Crusher', initialPrice: crusherInitialPrice })
    if (!clientResult.ok || !crusherResult.ok) {
      throw new Error('Suggestion fixture setup failed: ' + name)
    }
    return { clientId: clientResult.data.id, crusherId: crusherResult.data.id }
  }
  function newSuggestionMaterial(name) {
    return Number(db.prepare('INSERT INTO MaterialType (name) VALUES (?)').run(name).lastInsertRowid)
  }
  function runSuggestedPriceCases() {
    runCase('P1 stone uses crusher and material history only', 'latest matching material wins across clients; other and NULL materials are ignored', () => {
      const pair = newSuggestionPair('P1', undefined, undefined)
      const otherClient = createClient({ name: 'P1 Other Client' })
      if (!otherClient.ok) throw new Error('P1 client setup failed')
      const requestedMaterial = newSuggestionMaterial('P1 Requested Material')
      const otherMaterial = newSuggestionMaterial('P1 Other Material')
      insertSuggestionTrip('TRP-910001', pair.clientId, pair.crusherId, '2026-10-10', [111, 211, 311], { materialTypeId: requestedMaterial })
      insertSuggestionTrip('TRP-910002', otherClient.data.id, pair.crusherId, '2026-10-14', [525, 625, 725], { materialTypeId: requestedMaterial })
      insertSuggestionTrip('TRP-910003', pair.clientId, pair.crusherId, '2026-10-15', [999, 999, 999], { materialTypeId: otherMaterial })
      insertSuggestionTrip('TRP-910004', pair.clientId, pair.crusherId, '2026-10-16', [888, 888, 888], { materialTypeId: null })
      return getSuggestedTripPrices({ ...pair, materialTypeId: requestedMaterial })
    }, (actual) => {
      const response = result(actual)
      return response?.ok === true &&
        response.data.stonePrice === 5.25 &&
        response.data.sources.stonePrice === 'LAST_TRIP' &&
        response.data.clientPrice === 3.11 &&
        response.data.sources.clientPrice === 'LAST_TRIP' &&
        response.data.transportPrice === 8.88 &&
        response.data.sources.transportPrice === 'LAST_TRIP'
    })
    runCase('P2 client uses client and material history only', 'latest matching material wins; other client and other material are ignored', () => {
      const pair = newSuggestionPair('P2', undefined, undefined)
      const otherClient = createClient({ name: 'P2 Other Client' })
      const otherCrusher = createCrusher({ name: 'P2 Other Crusher' })
      if (!otherClient.ok || !otherCrusher.ok) throw new Error('P2 fixture setup failed')
      const requestedMaterial = newSuggestionMaterial('P2 Requested Material')
      const otherMaterial = newSuggestionMaterial('P2 Other Material')
      insertSuggestionTrip('TRP-920001', pair.clientId, pair.crusherId, '2026-10-10', [111, 211, 311], { materialTypeId: requestedMaterial })
      insertSuggestionTrip('TRP-920002', pair.clientId, otherCrusher.data.id, '2026-10-14', [425, 525, 625], { materialTypeId: requestedMaterial })
      insertSuggestionTrip('TRP-920003', otherClient.data.id, pair.crusherId, '2026-10-15', [999, 999, 999], { materialTypeId: requestedMaterial })
      insertSuggestionTrip('TRP-920004', pair.clientId, pair.crusherId, '2026-10-16', [888, 888, 888], { materialTypeId: otherMaterial })
      return getSuggestedTripPrices({ ...pair, materialTypeId: requestedMaterial })
    }, (actual) => {
      const response = result(actual)
      return response?.ok === true &&
        response.data.clientPrice === 6.25 &&
        response.data.sources.clientPrice === 'LAST_TRIP' &&
        response.data.stonePrice === 9.99 &&
        response.data.sources.stonePrice === 'LAST_TRIP' &&
        response.data.transportPrice === 8.88
    })
    runCase('P3 transport prefers same client and location', 'location match wins; no match falls back to latest client trip', () => {
      const pair = newSuggestionPair('P3', undefined, undefined)
      const otherCrusher = createCrusher({ name: 'P3 Other Crusher' })
      if (!otherCrusher.ok) throw new Error('P3 crusher setup failed')
      const otherMaterial = newSuggestionMaterial('P3 Other Material')
      insertSuggestionTrip('TRP-930001', pair.clientId, pair.crusherId, '2026-10-10', [100, 200, 300], { location: 'Yard A' })
      insertSuggestionTrip('TRP-930002', pair.clientId, otherCrusher.data.id, '2026-10-15', [400, 500, 600], { materialTypeId: otherMaterial, location: 'Yard B' })
      insertSuggestionTrip('TRP-930003', pair.clientId, pair.crusherId, '2026-10-14', [700, 800, 900], { location: 'Yard A' })
      return {
        preferred: getSuggestedTripPrices({ ...pair, materialTypeId, location: '  Yard A  ' }),
        fallback: getSuggestedTripPrices({ ...pair, materialTypeId, location: 'Unknown Yard' }),
        noLocation: getSuggestedTripPrices(pair)
      }
    }, (actual) => {
      const value = result(actual)
      return value?.preferred?.ok === true &&
        value.preferred.data.transportPrice === 8 &&
        value.preferred.data.sources.transportPrice === 'LAST_TRIP' &&
        value?.fallback?.ok === true &&
        value.fallback.data.transportPrice === 5 &&
        value.fallback.data.sources.transportPrice === 'LAST_TRIP' &&
        value?.noLocation?.ok === true &&
        value.noLocation.data.transportPrice === 5
    })
    runCase('P4 omitted material uses only price defaults', 'stone/client history ignored; transport remains client history', () => {
      const pair = newSuggestionPair('P4', 3.25, 5.25)
      insertSuggestionTrip('TRP-940001', pair.clientId, pair.crusherId, '2026-10-14', [900, 1000, 1100], { materialTypeId })
      return getSuggestedTripPrices(pair)
    }, (actual) => {
      const response = result(actual)
      return response?.ok === true &&
        response.data.stonePrice === 5.25 &&
        response.data.sources.stonePrice === 'DEFAULT' &&
        response.data.clientPrice === 3.25 &&
        response.data.sources.clientPrice === 'DEFAULT' &&
        response.data.transportPrice === 10 &&
        response.data.sources.transportPrice === 'LAST_TRIP'
    })
    runCase('P5 no history or defaults returns null prices', 'all prices and sources are null', () => {
      const pair = newSuggestionPair('P5', undefined, undefined)
      return getSuggestedTripPrices({ ...pair, materialTypeId: newSuggestionMaterial('P5 Material') })
    }, (actual) => {
      const response = result(actual)
      return response?.ok === true &&
        JSON.stringify(response.data) === JSON.stringify({
          stonePrice: null,
          clientPrice: null,
          transportPrice: null,
          sources: { stonePrice: null, clientPrice: null, transportPrice: null }
        })
    })
    runCase('P6 invalid inputs return exact field errors without throwing', 'invalid client/crusher/material IDs, bad location, and non-object inputs reject by field', () => {
      const base = { clientId, crusherId }
      const cases = [
        [{ ...base, clientId: 0 }, 'clientId'],
        [{ ...base, clientId: -1 }, 'clientId'],
        [{ ...base, clientId: 1.5 }, 'clientId'],
        [{ ...base, clientId: '1' }, 'clientId'],
        [{ ...base, clientId: Number.NaN }, 'clientId'],
        [{ ...base, crusherId: 0 }, 'crusherId'],
        [{ ...base, crusherId: -1 }, 'crusherId'],
        [{ ...base, crusherId: 1.5 }, 'crusherId'],
        [{ ...base, crusherId: '1' }, 'crusherId'],
        [{ ...base, crusherId: Number.NaN }, 'crusherId'],
        [{ ...base, materialTypeId: 0 }, 'materialTypeId'],
        [{ ...base, materialTypeId: '1' }, 'materialTypeId'],
        [{ ...base, materialTypeId: 1.5 }, 'materialTypeId'],
        [{ ...base, location: 1 }, 'location'],
        [null, 'clientId'],
        [[], 'clientId']
      ]
      return cases.map(([input, expectedField]) => {
        try {
          const response = getSuggestedTripPrices(input)
          return response.ok === false &&
            response.errors.length === 1 &&
            response.errors[0].field === expectedField
        } catch {
          return false
        }
      })
    }, (actual) => result(actual)?.every((valid) => valid === true) === true)
    runCase('P7 nonexistent entities return exact field errors', 'missing client, crusher, and material use their own field', () => {
      const pair = newSuggestionPair('P7', undefined, undefined)
      return {
        client: getSuggestedTripPrices({ ...pair, clientId: 999999999 }),
        crusher: getSuggestedTripPrices({ ...pair, crusherId: 999999999 }),
        material: getSuggestedTripPrices({ ...pair, materialTypeId: 999999999 })
      }
    }, (actual) => {
      const value = result(actual)
      return value?.client?.ok === false && value.client.errors.length === 1 &&
        value.client.errors[0].field === 'clientId' &&
        value?.crusher?.ok === false && value.crusher.errors.length === 1 &&
        value.crusher.errors[0].field === 'crusherId' &&
        value?.material?.ok === false && value.material.errors.length === 1 &&
        value.material.errors[0].field === 'materialTypeId'
    })
    runCase('P8 decimal prices round-trip exactly', '5.25 remains exact for all suggested price fields', () => {
      const pair = newSuggestionPair('P8', undefined, undefined)
      insertSuggestionTrip('TRP-980001', pair.clientId, pair.crusherId, '2026-10-14', [525, 525, 525], { materialTypeId })
      return getSuggestedTripPrices({ ...pair, materialTypeId })
    }, (actual) => {
      const response = result(actual)
      return response?.ok === true &&
        response.data.stonePrice === 5.25 &&
        response.data.clientPrice === 5.25 &&
        response.data.transportPrice === 5.25
    })
    runCase('P9 latest ordering uses date then trip number', 'same-date highest number wins; later date beats greater earlier number', () => {
      const pair = newSuggestionPair('P9', undefined, undefined)
      const sameDateMaterial = newSuggestionMaterial('P9 Same Date Material')
      insertSuggestionTrip('TRP-990001', pair.clientId, pair.crusherId, '2026-10-14', [100, 100, 100], { materialTypeId: sameDateMaterial })
      insertSuggestionTrip('TRP-990002', pair.clientId, pair.crusherId, '2026-10-14', [200, 200, 200], { materialTypeId: sameDateMaterial })
      const laterDateMaterial = newSuggestionMaterial('P9 Later Date Material')
      insertSuggestionTrip('TRP-999999', pair.clientId, pair.crusherId, '2026-10-13', [900, 900, 900], { materialTypeId: laterDateMaterial })
      insertSuggestionTrip('TRP-990003', pair.clientId, pair.crusherId, '2026-10-15', [300, 300, 300], { materialTypeId: laterDateMaterial })
      return {
        sameDate: getSuggestedTripPrices({ ...pair, materialTypeId: sameDateMaterial }),
        laterDate: getSuggestedTripPrices({ ...pair, materialTypeId: laterDateMaterial })
      }
    }, (actual) => {
      const value = result(actual)
      return value?.sameDate?.ok === true &&
        value.sameDate.data.stonePrice === 2 &&
        value?.laterDate?.ok === true &&
        value.laterDate.data.stonePrice === 3
    })
  }
  return runSuggestedPriceCases
}
