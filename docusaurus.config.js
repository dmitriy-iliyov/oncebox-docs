// @ts-check
import {themes as prismThemes} from 'prism-react-renderer';

const repoUrl = 'https://github.com/dmitriy-iliyov/oncebox';
const docsRepoUrl = 'https://github.com/dmitriy-iliyov/oncebox-docs';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'oncebox',
  tagline: 'Transactional Outbox and Inbox for Spring Boot',
  favicon: 'img/favicon.svg',

  url: 'https://dmitriy-iliyov.github.io',
  baseUrl: '/oncebox-docs/',
  organizationName: 'dmitriy-iliyov',
  projectName: 'oncebox-docs',
  trailingSlash: true,

  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',
  onBrokenMarkdownLinks: 'throw',

  // Fredoka is the typeface of the oncebox wordmark and headings, Inter of the text
  stylesheets: [
    {href: 'https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&display=swap', type: 'text/css'},
  ],

  markdown: {
    format: 'detect',
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          editUrl: `${docsRepoUrl}/edit/main/`,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: 'img/social-card.png',
      colorMode: {
        respectPrefersColorScheme: true,
      },
      navbar: {
        title: 'oncebox',
        logo: {alt: 'oncebox', src: 'img/logo.svg', srcDark: 'img/logo-dark.svg'},
        items: [
          {type: 'doc', docId: 'intro', position: 'left', label: 'Docs'},
          {type: 'doc', docId: 'quickstart', position: 'left', label: 'Quickstart'},
          {type: 'doc', docId: 'reference/index', position: 'left', label: 'Reference'},
          {
            // the latest release on Maven Central, read by shields.io when the page loads, so it never goes stale
            type: 'html',
            position: 'right',
            className: 'ob-version-item',
            value: `<a class="ob-version" href="${repoUrl}/releases" aria-label="Latest release on Maven Central">`
              + '<img alt="latest version" height="20" '
              + 'src="https://img.shields.io/maven-central/v/io.github.dmitriy-iliyov/oncebox-starter?label=release&color=4f8f2c&style=flat-square" />'
              + '</a>',
          },
          {
            href: 'https://javadoc.io/doc/io.github.dmitriy-iliyov/oncebox-core',
            label: 'Javadoc',
            position: 'right',
          },
          {href: repoUrl, label: 'GitHub', position: 'right'},
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              {label: 'Quickstart', to: '/docs/quickstart/'},
              {label: 'Delivery Guarantees', to: '/docs/reference/guarantees/'},
              {label: 'Configuration', to: '/docs/reference/configuration/'},
            ],
          },
          {
            title: 'Project',
            items: [
              {label: 'Contributing', to: '/docs/contributing/'},
              {label: 'Support Policy', to: '/docs/support-policy/'},
              {label: 'Releases', href: `${repoUrl}/releases`},
              {label: 'CI', href: `${repoUrl}/actions/workflows/ci.yml`},
              {label: 'Coverage', href: 'https://codecov.io/github/dmitriy-iliyov/oncebox'},
            ],
          },
          {
            title: 'Community',
            items: [
              {label: 'Issues', href: `${repoUrl}/issues`},
              {label: 'Security', href: `${repoUrl}/security`},
              {
                label: 'Maven Central',
                href: 'https://central.sonatype.com/artifact/io.github.dmitriy-iliyov/oncebox-starter',
              },
            ],
          },
        ],
        copyright: `oncebox is licensed under the Apache License, Version 2.0.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
        additionalLanguages: ['java', 'yaml', 'sql', 'properties', 'bash'],
      },
      tableOfContents: {
        minHeadingLevel: 2,
        maxHeadingLevel: 4,
      },
    }),
};

export default config;
