import { model, Schema } from 'mongoose'
import aggregatePaginate from 'mongoose-aggregate-paginate-v2'

import { schemaOptions } from '../shared/schema'
import {
  ExperienceLevel,
  type JobCoreModel,
  JobLocationRequirements,
  type JobModel,
  type JobSchema,
  JobStatus,
  JobType,
} from './job.types'

const jobSchema = new Schema<JobSchema, JobCoreModel>(
  {
    title: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    company: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(JobType),
      required: true,
      trim: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    locationRequirements: {
      type: String,
      enum: Object.values(JobLocationRequirements),
      required: true,
      trim: true,
    },
    minSalary: {
      type: Number,
      required: true,
    },
    maxSalary: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    experience: {
      type: String,
      enum: Object.values(ExperienceLevel),
      required: true,
      trim: true,
    },
    education: {
      type: String,
      trim: true,
    },
    postedDate: {
      type: Date,
      required: true,
    },
    deadline: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(JobStatus),
      required: true,
      lowercase: true,
      trim: true,
    },
    requirements: {
      type: [String],
      required: true,
    },
    responsibilities: {
      type: [String],
      required: true,
    },
    benefits: {
      type: [String],
    },
    skills: {
      type: [String],
      required: true,
    },
    // totalApplications: {
    //   type: Number,
    //   required: true,
    //   default: 0,
    // },
    // shortlisted: {
    //   type: Number,
    //   required: true,
    //   default: 0,
    // },
    // interviewed: {
    //   type: Number,
    //   required: true,
    //   default: 0,
    // },
    // hired: {
    //   type: Number,
    //   required: true,
    //   default: 0,
    // },
    // rejected: {
    //   type: Number,
    //   required: true,
    //   default: 0,
    // },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  schemaOptions
)

// Add the aggregate pagination plugin
jobSchema.plugin(aggregatePaginate)

const Job = model<JobSchema, JobModel>('Job', jobSchema)

export default Job
