/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-require-imports, no-unused-vars */
module.exports = {
  runSettingsValidationCases(context) {
    const {
      db,
      runCase,
      result,
      clientId,
      contractorId,
      driverId,
      createClient,
      updateClient,
      createContractor,
      updateContractor,
      createDriver,
      updateDriver,
      nextFixtureSequence
    } = context

    function hasFieldError(value, field) {
      return value?.ok === false && value.errors.some((error) => error.field === field)
    }

    runCase(
      'SET-UC-1 client opening-balance create requires balance and date together',
      'missing date and missing balance return their field errors',
      () => {
        const suffix = nextFixtureSequence()
        return {
          balanceWithoutDate: createClient({
            name: `Verify client balance without date ${suffix}`,
            openingBalance: 25
          }),
          dateWithoutBalance: createClient({
            name: `Verify client date without balance ${suffix}`,
            openingBalanceDate: '2026-03-01'
          })
        }
      },
      (actual) => {
        const value = result(actual)
        return (
          hasFieldError(value?.balanceWithoutDate, 'openingBalanceDate') &&
          hasFieldError(value?.dateWithoutBalance, 'openingBalance')
        )
      }
    )

    runCase(
      'SET-UC-2 contractor opening-balance create requires balance and date together',
      'missing date and missing balance return their field errors',
      () => {
        const suffix = nextFixtureSequence()
        return {
          balanceWithoutDate: createContractor({
            name: `Verify contractor balance without date ${suffix}`,
            openingBalance: 25
          }),
          dateWithoutBalance: createContractor({
            name: `Verify contractor date without balance ${suffix}`,
            openingBalanceDate: '2026-03-01'
          })
        }
      },
      (actual) => {
        const value = result(actual)
        return (
          hasFieldError(value?.balanceWithoutDate, 'openingBalanceDate') &&
          hasFieldError(value?.dateWithoutBalance, 'openingBalance')
        )
      }
    )

    runCase(
      'SET-UC-3 client opening-balance update requires balance and date together',
      'partial pairs are rejected and zero with a date is accepted',
      () => {
        const suffix = nextFixtureSequence()
        const created = createClient({ name: `Verify client update pair ${suffix}` })
        if (!created.ok) throw new Error('Client setup failed: ' + JSON.stringify(created))
        return {
          balanceWithoutDate: updateClient({
            id: created.data.id,
            name: created.data.name,
            openingBalance: 25
          }),
          dateWithoutBalance: updateClient({
            id: created.data.id,
            name: created.data.name,
            openingBalanceDate: '2026-03-01'
          }),
          zeroWithDate: updateClient({
            id: created.data.id,
            name: created.data.name,
            openingBalance: 0,
            openingBalanceDate: '2026-03-01'
          })
        }
      },
      (actual) => {
        const value = result(actual)
        return (
          hasFieldError(value?.balanceWithoutDate, 'openingBalanceDate') &&
          hasFieldError(value?.dateWithoutBalance, 'openingBalance') &&
          value?.zeroWithDate?.ok === true
        )
      }
    )

    runCase(
      'SET-UC-4 contractor opening-balance update requires balance and date together',
      'partial pairs are rejected and zero with a date is accepted',
      () => {
        const suffix = nextFixtureSequence()
        const created = createContractor({ name: `Verify contractor update pair ${suffix}` })
        if (!created.ok) throw new Error('Contractor setup failed: ' + JSON.stringify(created))
        return {
          balanceWithoutDate: updateContractor({
            id: created.data.id,
            name: created.data.name,
            openingBalance: 25
          }),
          dateWithoutBalance: updateContractor({
            id: created.data.id,
            name: created.data.name,
            openingBalanceDate: '2026-03-01'
          }),
          zeroWithDate: updateContractor({
            id: created.data.id,
            name: created.data.name,
            openingBalance: 0,
            openingBalanceDate: '2026-03-01'
          })
        }
      },
      (actual) => {
        const value = result(actual)
        return (
          hasFieldError(value?.balanceWithoutDate, 'openingBalanceDate') &&
          hasFieldError(value?.dateWithoutBalance, 'openingBalance') &&
          value?.zeroWithDate?.ok === true
        )
      }
    )

    runCase(
      'SET-UC-5 client allows no opening balance or a zero balance with a date',
      'empty pair and zero with date are accepted',
      () => {
        const suffix = nextFixtureSequence()
        return {
          emptyPair: createClient({ name: `Verify client empty pair ${suffix}` }),
          zeroWithDate: createClient({
            name: `Verify client zero pair ${suffix}`,
            openingBalance: 0,
            openingBalanceDate: '2026-03-01'
          })
        }
      },
      (actual) => {
        const value = result(actual)
        return value?.emptyPair?.ok === true && value?.zeroWithDate?.ok === true
      }
    )

    runCase(
      'SET-UC-6 contractor allows no opening balance or a zero balance with a date',
      'empty pair and zero with date are accepted',
      () => {
        const suffix = nextFixtureSequence()
        return {
          emptyPair: createContractor({ name: `Verify contractor empty pair ${suffix}` }),
          zeroWithDate: createContractor({
            name: `Verify contractor zero pair ${suffix}`,
            openingBalance: 0,
            openingBalanceDate: '2026-03-01'
          })
        }
      },
      (actual) => {
        const value = result(actual)
        return value?.emptyPair?.ok === true && value?.zeroWithDate?.ok === true
      }
    )

    runCase(
      'SET-UC-7 driver phone accepts formatted numbers and rejects other characters',
      'create and update reject invalid fields; valid phone formats persist',
      () => {
        const suffix = nextFixtureSequence()
        const invalidCreate = createDriver({
          name: `Verify invalid phone ${suffix}`,
          phone1: '555 ABC'
        })
        const validCreate = createDriver({
          name: `Verify formatted phone ${suffix}`,
          phone1: '+1 (555) 010-1234',
          phone2: '555-0101'
        })
        const invalidUpdate = updateDriver({
          id: driverId,
          name: 'Verify Driver',
          phone1: '555 0101',
          phone2: 'extension x'
        })
        const afterInvalidUpdate = db
          .prepare('SELECT phone1, phone2 FROM Driver WHERE id = ?')
          .get(driverId)
        const validUpdate = updateDriver({
          id: driverId,
          name: 'Verify Driver',
          phone1: '+1 (555) 010-1234',
          phone2: '555-0101'
        })
        const afterValidUpdate = db
          .prepare('SELECT phone1, phone2 FROM Driver WHERE id = ?')
          .get(driverId)
        return {
          invalidCreate,
          validCreate,
          invalidUpdate,
          afterInvalidUpdate,
          validUpdate,
          afterValidUpdate
        }
      },
      (actual) => {
        const value = result(actual)
        return (
          hasFieldError(value?.invalidCreate, 'phone1') &&
          value?.validCreate?.ok === true &&
          hasFieldError(value?.invalidUpdate, 'phone2') &&
          value?.afterInvalidUpdate?.phone1 === null &&
          value?.afterInvalidUpdate?.phone2 === null &&
          value?.validUpdate?.ok === true &&
          value?.afterValidUpdate?.phone1 === '+1 (555) 010-1234' &&
          value?.afterValidUpdate?.phone2 === '555-0101'
        )
      }
    )
  }
}
