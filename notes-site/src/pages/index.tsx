import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import clsx from "clsx";
import styles from "./index.module.css";

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx("hero", styles.heroBanner)}>
      <div className="container">
        <h1 className={styles.heroTitle}>Getting Started</h1>
        <p className={styles.heroSubtitle}>
          Welcome to the hub of{" "}
          <span className={styles.highlight}>Sayan's resources</span>.
        </p>
        <p className={styles.heroDescription}>
          I generally like to document a lot of different questions that I find
          in the journey of learning to code. This is a collection of most of
          those questions and answers (along with some other resources). I hope
          you find it useful.
        </p>
      </div>
    </header>
  );
}

function TopicCard({ title, description, link }) {
  return (
    <div className={styles.topicCard}>
      <Link to={link} className={styles.topicLink}>
        <h3 className={styles.topicTitle}>{title}</h3>
        <p className={styles.topicDescription}>{description}</p>
      </Link>
    </div>
  );
}

function HomepageTopics() {
  const topics = [
    {
      title: "JavaScript",
      description: "JavaScript fundamentals, machine coding, etc.",
      link: "/docs/javascript/js",
    },
    {
      title: "TypeScript",
      description: "TypeScript patterns, system design decisions & more",
      link: "/docs/typescript/ts",
    },
    {
      title: "React",
      description: "React in-depth resources, concepts & more",
      link: "/docs/react/",
    },
    {
      title: "Redux",
      description: "Redux Toolkit & RTK Query",
      link: "/docs/redux/",
    },
  ];

  return (
    <section className={styles.topics}>
      <div className="container">
        <div className={styles.topicGrid}>
          {topics.map((topic, idx) => (
            <TopicCard key={idx} {...topic} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={`Home`}
      description="Quick interview prep notes for JavaScript, TypeScript, React, and Redux"
    >
      <HomepageHeader />
      <main>
        <HomepageTopics />
      </main>
    </Layout>
  );
}
