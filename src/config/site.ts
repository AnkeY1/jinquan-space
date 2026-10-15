import profile from '../data/profile.json';
export const siteConfig = {
  title: `${profile.displayName}的个人空间`,
  displayName: profile.displayName,
  description: profile.intro,
  tagline: '把想法做成可以运行的作品。',
  language: 'zh-CN',
  defaultTheme: 'system',
  publicProfileApproved: profile.publicProfileApproved,
  resumeIndexable: false,
  footerSourceUrl: null as string | null,
};
export const navigation = [
  ['首页', '/'],
  ['项目', '/projects/'],
  ['文章', '/articles/'],
  ['工具箱', '/tools/'],
  ['实验室', '/lab/'],
  ['关于我', '/about/'],
] as const;
