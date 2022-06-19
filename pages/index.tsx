import Head from "next/head";
import { InferGetStaticPropsType } from "next";

import { readFile, readdir } from "fs/promises";
import path from "path";

import App from "../components/App";

/* Main app */
export default function HomePage({
  stationsPayload,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  return (
    <>
      <Head>
        <title>Hareonna</title>
        <meta name="viewport" content="initial-scale=1.0, width=device-width" />
        <meta
          property="og:title"
          content="Hareonna—look at the percentiles of thousands of weather stations’ lows and highs"
          key="title"
        />
      </Head>
      <App stationsPayload={stationsPayload} />
    </>
  );
}

/* Next.js infra: load raw data at compile-time and bundle it */
export const getStaticProps = async () => {
  {
    // might only print if you restart next dev server
    const postsDirectory = path.join(process.cwd());
    const filenames = await readdir(postsDirectory);
    console.log("ls", filenames);
  }
  const stationsPayload = JSON.parse(
    await readFile(
      path.join(process.cwd(), "good-stations-summary.json"),
      "utf8"
    )
  );
  return { props: { stationsPayload } };
};
