import { deletePhotoForTrip, readPhotoAsDataUri, savePhotoForTrip } from '../photoStorage'
import { getTripById, updateTripPhotoPath } from '../repository/tripRepository'

type UseCaseResult<T> =
  { ok: true; data: T } | { ok: false; errors: { field: string; message: string }[] }

export function saveTripPhoto(input: {
  tripId: string
  imageBase64: string
}): UseCaseResult<{ path: string }> {
  if (!input.tripId?.trim()) {
    return { ok: false, errors: [{ field: 'tripId', message: 'النقلة مطلوبة' }] }
  }
  if (!input.imageBase64?.trim()) {
    return { ok: false, errors: [{ field: 'imageBase64', message: 'الصورة مطلوبة' }] }
  }
  const trip = getTripById(input.tripId)
  if (!trip) {
    return { ok: false, errors: [{ field: 'tripId', message: 'النقلة دي مش موجودة' }] }
  }
  const path = savePhotoForTrip(input.tripId, input.imageBase64)
  updateTripPhotoPath(input.tripId, path)
  return { ok: true, data: { path } }
}

export function deleteTripPhoto(input: { tripId: string }): UseCaseResult<{ tripId: string }> {
  if (!input.tripId?.trim()) {
    return { ok: false, errors: [{ field: 'tripId', message: 'النقلة مطلوبة' }] }
  }
  deletePhotoForTrip(input.tripId)
  updateTripPhotoPath(input.tripId, null)
  return { ok: true, data: { tripId: input.tripId } }
}

export function getTripPhoto(input: {
  photoPath: string
}): UseCaseResult<{ dataUri: string | null }> {
  if (!input.photoPath?.trim()) {
    return { ok: true, data: { dataUri: null } }
  }
  return { ok: true, data: { dataUri: readPhotoAsDataUri(input.photoPath) } }
}
