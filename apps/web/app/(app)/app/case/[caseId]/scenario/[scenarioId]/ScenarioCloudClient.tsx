"use client";

type Props = {
  title: string;
};

export default function ScenarioCloudClient(props: Props) {
  return (
    <section>
      <h1>{props.title}</h1>
      <p>Scenario workspace is ready.</p>
    </section>
  );
}
