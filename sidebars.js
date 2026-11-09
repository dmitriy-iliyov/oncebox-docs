// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docs: [
    'intro',
    'quickstart',
    {
      type: 'category',
      label: 'Reference',
      collapsed: false,
      link: {type: 'doc', id: 'reference/index'},
      items: [
        'reference/core',
        'reference/guarantees',
        'reference/publishing',
        'reference/processing',
        'reference/dlq',
        'reference/inbox',
        'reference/messaging',
        'reference/persistence',
        'reference/polling',
        'reference/observability',
        'reference/configuration',
      ],
    },
    'examples',
    'agent-skill',
    'contributing',
    'support-policy',
  ],
};

export default sidebars;
