import { z } from 'astro/zod';
import rawProfile from '../data/profile.json';
import rawResume from '../data/resume.json';
const https = z.url().refine((v) => {
  const u = new URL(v);
  return u.protocol === 'https:' && !u.username && !u.password;
}, '只允许 HTTPS 外链');
const logical = z.string().regex(/^\/[a-zA-Z0-9/_\-.]+$/);
export const profile = z
  .object({
    displayName: z.string().min(1),
    intro: z.string(),
    about: z.string(),
    directions: z.array(z.string()),
    contactEmail: z.email().nullable(),
    phone: z.string().nullable(),
    location: z.string().nullable(),
    githubUrl: https.nullable(),
    wechatId: z.string().min(1).nullable(),
    hobbies: z.array(z.string().min(1)),
    socialLinks: z.array(z.object({ label: z.string(), url: https })),
    resumePdfPath: logical.nullable(),
    publicProfileApproved: z.boolean(),
  })
  .strict()
  .parse(rawProfile);
const entry = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  period: z.string().optional(),
  description: z.string(),
});
export const resume = z
  .object({
    summary: z.string(),
    education: z.array(entry),
    experience: z.array(entry),
    projects: z.array(z.object({ title: z.string(), description: z.string(), path: logical })),
    publications: z.array(z.object({ title: z.string(), url: https.optional() })),
    patents: z.array(entry),
    awards: z.array(entry),
  })
  .strict()
  .parse(rawResume);
