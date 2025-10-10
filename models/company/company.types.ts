import type { AggregatePaginateModel, Model } from 'mongoose'

export const CompanySize = {
  SMALL_1_10: '1-10',
  SMALL_10_50: '10-50',
  MEDIUM_50_100: '50-100',
  MEDIUM_100_500: '100-500',
  LARGE_500_1000: '500-1000',
  LARGE_1000_PLUS: '1000+',
} as const

export type CompanySize = (typeof CompanySize)[keyof typeof CompanySize]

export interface CompanySchema {
  name: string
  industry: string
  location: string
  size: CompanySize
  status: 'active' | 'inactive'
  isDeleted?: boolean
}

type CompanyStatics = AggregatePaginateModel<CompanySchema>

export type CompanyCoreModel = Model<CompanySchema>

export type CompanyModel = CompanyCoreModel & CompanyStatics
