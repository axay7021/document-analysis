import type { AggregatePaginateModel, Model } from 'mongoose'

import { CompanyModel } from '../company/company.types'

export const JobType = {
  FULL_TIME: 'Full Time',
  PART_TIME: 'Part Time',
  CONTRACT: 'Contract',
  INTERNSHIP: 'Internship',
  FREELANCE: 'Freelance',
  TEMPORARY: 'Temporary',
} as const

export type JobType = (typeof JobType)[keyof typeof JobType]

export const JobLocationRequirements = {
  IN_OFFICE: 'In-Office',
  HYBRID: 'Hybrid',
  REMOTE: 'Remote',
} as const

export type JobLocationRequirements =
  (typeof JobLocationRequirements)[keyof typeof JobLocationRequirements]

export const ExperienceLevel = {
  JUNIOR: 'Junior',
  MID_LEVEL: 'Mid-Level',
  SENIOR: 'Senior',
} as const

export type ExperienceLevel =
  (typeof ExperienceLevel)[keyof typeof ExperienceLevel]

export const JobStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const

export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus]

export interface JobSchema {
  title: string
  company: CompanyModel
  type: JobType
  location: string
  locationRequirements: JobLocationRequirements
  minSalary: number
  maxSalary: number
  description: string
  experience: ExperienceLevel
  education: string
  postedDate: Date
  deadline: Date
  status: JobStatus
  requirements: string[]
  responsibilities: string[]
  benefits: string[]
  skills: string[]

  // Application statistics
  //   totalApplications: number
  //   shortlisted: number
  //   interviewed: number
  //   hired: number
  //   rejected: number

  isDeleted?: boolean
}

type JobStatics = AggregatePaginateModel<JobSchema>

export type JobCoreModel = Model<JobSchema>

export type JobModel = JobCoreModel & JobStatics
