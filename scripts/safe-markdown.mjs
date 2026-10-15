/** Author-owned Markdown only. Raw HTML is discarded; link protocols and heading levels are checked. */
export default function safeMarkdown({ base = '/' } = {}) {
  return (tree) => {
    let previousHeading = 1;
    const walk = (node) => {
      if (node.type === 'heading') {
        if (node.depth === 1 || node.depth > previousHeading + 1)
          throw new Error('Markdown 正文标题必须从 H2 开始且不跳级');
        previousHeading = node.depth;
      }
      if (node.type === 'link' || node.type === 'image' || node.type === 'definition') {
        if (node.url.startsWith('/') && !node.url.startsWith('//'))
          node.url = base + node.url.slice(1);
        else if (!node.url.startsWith('#') && !/^https:\/\//i.test(node.url))
          throw new Error('Markdown 链接只支持 HTTPS、站内绝对路径或锚点');
      }
      if (node.children) {
        node.children = node.children.filter((child) => child.type !== 'html');
        node.children.forEach(walk);
      }
    };
    walk(tree);
  };
}
