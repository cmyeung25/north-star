import Link from "next/link";

export default function MarketingWebPage() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "3rem 1.25rem" }}>
      <h1>North Star Web</h1>
      <p>This section hosts marketing content under /web/*.</p>
      <p>
        <Link href="/web/features">Read feature highlights</Link>
      </p>
    </main>
  );
}
