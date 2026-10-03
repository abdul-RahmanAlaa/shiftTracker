import {
insertMaterialType,
listMaterialTypes as listMaterialTypesInDb,
updateMaterialType as updateMaterialTypeInDb,
deleteMaterialType as deleteMaterialTypeInDb,
MaterialTypeRow
} from '../repository/materialTypeRepository'

type UseCaseResult<T> =
{ ok: true; data: T } | { ok: false; errors: { field: string; message: string }[] }

interface SqliteError extends Error {
code: string
}

function isSqliteError(err: unknown): err is SqliteError {
return (
err instanceof Error && 'code' in err && typeof (err as { code: unknown }).code === 'string'
)
}

export function createMaterialType(input: { name: string }): UseCaseResult<MaterialTypeRow> {
const name = input.name?.trim()
if (!name) {
return { ok: false, errors: [{ field: 'name', message: 'اسم نوع الصنف مطلوب' }] }
}
try {
const id = insertMaterialType(name)
return { ok: true, data: { id, name } }
} catch (err: unknown) {
if (isSqliteError(err) && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
return { ok: false, errors: [{ field: 'name', message: 'نوع الصنف ده موجود بالفعل' }] }
}
throw err
}
}

export function listMaterialTypes(): UseCaseResult<MaterialTypeRow[]> {
return { ok: true, data: listMaterialTypesInDb() }
}

export function updateMaterialType(
input: { id: number; name: string }
): UseCaseResult<MaterialTypeRow> {
const name = input.name?.trim()
if (!name) {
return { ok: false, errors: [{ field: 'name', message: 'اسم نوع الصنف مطلوب' }] }
}
try {
updateMaterialTypeInDb(input.id, name)
return { ok: true, data: { id: input.id, name } }
} catch (err: unknown) {
if (isSqliteError(err) && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
return { ok: false, errors: [{ field: 'name', message: 'نوع الصنف ده موجود بالفعل' }] }
}
throw err
}
}

export function deleteMaterialType(input: { id: number }): UseCaseResult<{ id: number }> {
try {
deleteMaterialTypeInDb(input.id)
return { ok: true, data: { id: input.id } }
} catch (err: unknown) {
if (isSqliteError(err) && err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
return {
ok: false,
errors: [{ field: 'id', message: 'نوع الصنف ده مستخدم في بيانات تانية، مينفعش يتمسح' }]
}
}
throw err
}
}
