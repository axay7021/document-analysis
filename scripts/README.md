# Scripts

This directory contains utility scripts for the Job Insider backend application.

## Available Scripts

### addMockData.ts

This script creates a company and adds all the mock jobs from `jobsData.ts` to the database.

**Features:**

- Creates a company called "TechCorp Solutions"
- Adds 30 jobs covering various roles:
  - Frontend: React, Vue.js, Angular, Frontend Architect, Mobile App Developer
  - Backend: Node.js, Java, C# .NET, Go, Backend Architect
  - DevOps: AWS DevOps, Kubernetes Specialist, SRE, Cloud Infrastructure, DevOps Lead
  - Python: Backend Developer, Django, Data Engineer, FastAPI, Automation Engineer
  - AI: Machine Learning Engineer, Data Scientist, AI Research Engineer, NLP Engineer, Computer Vision Engineer, AI Product Manager
- Prevents duplicate jobs and companies
- Provides detailed logging

**Usage:**

```bash
# Using npm script
npm run add-mock-data

# Using pnpm script
pnpm add-mock-data

# Direct execution
npx tsx scripts/addMockData.ts
```

**Prerequisites:**

- Database connection configured
- Environment variables set up
- MongoDB running

### jobsData.ts

Contains 30 mock job listings with realistic data including:

- Job titles and descriptions
- Salary ranges
- Required skills and experience
- Benefits and responsibilities
- Various locations and work arrangements

## Job Categories

The mock data includes jobs in the following categories:

1. **Frontend Development** (5 jobs)

   - React Developer
   - Vue.js Developer
   - Angular Developer
   - Frontend Architect
   - Mobile App Developer (React Native)

2. **Backend Development** (5 jobs)

   - Node.js Backend Developer
   - Java Backend Engineer
   - C# .NET Developer
   - Go Backend Developer
   - Backend Architect

3. **DevOps** (5 jobs)

   - AWS DevOps Engineer
   - Kubernetes Specialist
   - Site Reliability Engineer
   - Cloud Infrastructure Engineer
   - DevOps Lead

4. **Python Development** (5 jobs)

   - Python Backend Developer
   - Django Developer
   - Python Data Engineer
   - FastAPI Developer
   - Python Automation Engineer

5. **AI/ML** (6 jobs)

   - Machine Learning Engineer
   - Data Scientist
   - AI Research Engineer
   - NLP Engineer
   - Computer Vision Engineer
   - AI Product Manager

6. **Other** (4 jobs)
   - Senior Frontend Developer
   - UX/UI Designer
   - Backend Engineer
   - Product Manager
   - DevOps Engineer

## Data Structure

Each job includes:

- Title and description
- Job type (Full-time, Contract, Part-time, Internship)
- Location and work arrangement (Remote, Hybrid, In-office)
- Salary range (min/max)
- Experience level (Junior, Mid-level, Senior)
- Education requirements
- Posted and deadline dates
- Status (active, inactive, closed)
- Requirements, responsibilities, benefits, and skills arrays
