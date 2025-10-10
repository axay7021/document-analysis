export const schemaOptions = {
  id: false,
  timestamps: true,
  versionKey: false,
  toJSON: { getters: true, virtuals: true },
  toObject: { getters: true, virtuals: true },
  collation: { locale: 'en' },
}
