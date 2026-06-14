import * as v from 'valibot'

const Category = v.picklist([
  'plumbing',
  'electrical',
  'cleaning',
  'repair',
  'beauty',
  'teaching',
  'photography',
  'translation',
  'events',
  'other',
])
export type Category = v.InferOutput<typeof Category>
export const CategorySchema = Category

const NonEmpty = (max: number, label: string) =>
  v.pipe(v.string(), v.trim(), v.minLength(1, `${label} is required`), v.maxLength(max))

export const SpecialistCreateSchema = v.object({
  displayName: NonEmpty(80, 'displayName'),
  headline: NonEmpty(120, 'headline'),
  bio: v.optional(v.pipe(v.string(), v.maxLength(2000)), ''),
  phone: v.pipe(v.string(), v.regex(/^[+0-9 ()-]{6,20}$/, 'phone format')),
  whatsapp: v.optional(v.nullable(v.pipe(v.string(), v.regex(/^[+0-9 ()-]{6,20}$/)))),
  barrio: NonEmpty(60, 'barrio'),
  lat: v.optional(v.nullable(v.number())),
  lng: v.optional(v.nullable(v.number())),
  photo: v.optional(v.nullable(v.string())),
})
export type SpecialistCreate = v.InferOutput<typeof SpecialistCreateSchema>

export const SpecialistUpdateSchema = v.partial(SpecialistCreateSchema)
export type SpecialistUpdate = v.InferOutput<typeof SpecialistUpdateSchema>

export const ListingCreateSchema = v.object({
  category: Category,
  title: NonEmpty(120, 'title'),
  description: v.optional(v.pipe(v.string(), v.maxLength(2000)), ''),
  priceFromGs: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0)))),
  priceUnit: v.optional(v.nullable(v.picklist(['hour', 'job']))),
  photo: v.optional(v.nullable(v.string())),
})
export type ListingCreate = v.InferOutput<typeof ListingCreateSchema>

export const ListingUpdateSchema = v.partial(ListingCreateSchema)
export type ListingUpdate = v.InferOutput<typeof ListingUpdateSchema>

export const RequestCreateSchema = v.object({
  category: Category,
  title: NonEmpty(120, 'title'),
  description: v.optional(v.pipe(v.string(), v.maxLength(2000)), ''),
  budgetGs: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0)))),
  barrio: NonEmpty(60, 'barrio'),
})
export type RequestCreate = v.InferOutput<typeof RequestCreateSchema>

export const RequestUpdateSchema = v.partial(
  v.object({ ...RequestCreateSchema.entries, status: v.picklist(['open', 'closed']) }),
)
export type RequestUpdate = v.InferOutput<typeof RequestUpdateSchema>

export const InquiryCreateSchema = v.object({
  subjectType: v.picklist(['listing', 'request']),
  subjectId: v.pipe(v.string(), v.minLength(1)),
  body: v.pipe(v.string(), v.trim(), v.minLength(1, 'message required'), v.maxLength(2000)),
})
export type InquiryCreate = v.InferOutput<typeof InquiryCreateSchema>

export const MessageCreateSchema = v.object({
  body: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(2000)),
})
export type MessageCreate = v.InferOutput<typeof MessageCreateSchema>
