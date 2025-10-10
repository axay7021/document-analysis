import { model, Schema } from 'mongoose'
import aggregatePaginate from 'mongoose-aggregate-paginate-v2'

import { schemaOptions } from '../shared/schema'
import {
  type CompanyCoreModel,
  type CompanyModel,
  type CompanySchema,
  CompanySize,
} from './company.types'

const companySchema = new Schema<CompanySchema, CompanyCoreModel>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    industry: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    size: {
      type: String,
      enum: Object.values(CompanySize),
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      trim: true,
      lowercase: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      trim: true,
    },
  },
  schemaOptions
)

// Add the aggregate pagination plugin
companySchema.plugin(aggregatePaginate)

const Company = model<CompanySchema, CompanyModel>('Company', companySchema)

export default Company
