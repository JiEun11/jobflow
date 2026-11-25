import { z } from 'zod'

const short = z.string().trim().max(200)
const required = short.min(1)
const long = z.string().trim().max(2000)
const id = z.uuid()
const ids = z.array(id).max(80)
const evidence = z.object({ outcome: required, source: long })
const careerEntry = {
  id,
  skillIds: ids,
  evidence: z.array(evidence).max(12),
}

export const preferencesDefaults = {
  country: 'Canada',
  priorityLocation: 'Vancouver, British Columbia',
  roles: ['Full Stack Developer', 'Frontend / React Developer'],
  collectionTime: '09:00',
  timezone: 'Asia/Seoul',
}

export const profileSchema = z.object({
  personal: z.object({
    name: required,
    email: z.union([z.email().max(254), z.literal('')]),
    phone: short,
    location: short,
    summary: long,
  }),
  experiences: z.array(z.object({
    ...careerEntry, company: required, title: required, period: short, description: long,
  })).max(40),
  skills: z.array(z.object({ id, name: required, category: short })).max(80),
  projects: z.array(z.object({ ...careerEntry, name: required, description: long })).max(40),
  education: z.array(z.object({ id, institution: required, qualification: required, period: short })).max(25),
  preferences: z.object({
    country: required,
    priorityLocation: short,
    roles: z.array(required).min(1).max(12),
    collectionTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    timezone: required.refine((value) => {
      try { new Intl.DateTimeFormat('en', { timeZone: value }); return true }
      catch { return false }
    }),
  }),
}).superRefine((profile, context) => {
  const skills = new Set(profile.skills.map((skill) => skill.id))
  for (const section of ['skills', 'experiences', 'projects', 'education'] as const) {
    const rows = profile[section]
    if (new Set(rows.map((row) => row.id)).size !== rows.length) {
      context.addIssue({ code: 'custom', path: [section], message: 'Duplicate row identifier.' })
    }
  }
  for (const section of ['experiences', 'projects'] as const) {
    profile[section].forEach((entry, index) => {
      if (entry.skillIds.some((skillId) => !skills.has(skillId)) ||
        new Set(entry.skillIds).size !== entry.skillIds.length) {
        context.addIssue({ code: 'custom', path: [section, index, 'skillIds'], message: 'Choose distinct skills from this profile.' })
      }
    })
  }
})

export type Profile = z.infer<typeof profileSchema>

export const blankProfile: Profile = {
  personal: { name: '', email: '', phone: '', location: '', summary: '' },
  experiences: [],
  skills: [],
  projects: [],
  education: [],
  preferences: preferencesDefaults,
}
