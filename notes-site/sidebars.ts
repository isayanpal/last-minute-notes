import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */
const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    {
      type: "category",
      label: "JavaScript",
      items: ["javascript/js", "javascript/adv-js"],
    },
    {
      type: "category",
      label: "TypeScript",
      items: [
        "typescript/ts",
        "typescript/adv-ts-patterns",
        "typescript/system-design-decisions",
      ],
    },
    {
      type: "category",
      label: "React",
      items: ["react/react", "react/react-core-concepts"],
    },
    {
      type: "category",
      label: "Redux",
      items: ["redux/redux", "redux/rtk-rq"],
    },
  ],

  // But you can create a sidebar manually
  /*
  tutorialSidebar: [
    'intro',
    'hello',
    {
      type: 'category',
      label: 'Tutorial',
      items: ['tutorial-basics/create-a-document'],
    },
  ],
   */
};

export default sidebars;
