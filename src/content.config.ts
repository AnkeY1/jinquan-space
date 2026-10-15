import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + 'T00:00:00Z');
    return Number.isFinite(d.valueOf()) && d.toISOString().slice(0, 10) === v;
  }, '日期必须是真实 YYYY-MM-DD');
const common = {
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1),
  summary: z.string().min(1),
  tags: z.array(z.string()),
  visibility: z.enum(['draft', 'preview', 'public']),
  kind: z.enum(['demo', 'personal']),
};
const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z
    .object({
      ...common,
      category: z.enum(['data-tools', 'interactive-lab', 'embedded', 'research', 'other']),
      featured: z.boolean().default(false),
      featuredOrder: z.number().optional(),
      createdAt: date,
      updatedAt: date.optional(),
      cover: z.string().optional(),
      coverAlt: z.string().optional(),
      demoPath: z.string().startsWith('/'),
      relatedArticleSlugs: z.array(z.string()),
      repositoryUrl: z
        .url()
        .refine((v) => v.startsWith('https://'))
        .optional(),
    })
    .refine((v) => !v.cover || !!v.coverAlt, '封面必须有 alt'),
});
const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    ...common,
    publishedAt: date,
    updatedAt: date.optional(),
    relatedProjectSlugs: z.array(z.string()),
    references: z.array(
      z.object({ title: z.string(), url: z.url().refine((v) => v.startsWith('https://')) }),
    ),
  }),
});
export const collections = { projects, articles };
