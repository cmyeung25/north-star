import Link from "next/link";

export default function MarketingLandingPage() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "3rem 1.25rem" }}>
      <h1>North Star</h1>
      <p>Plan your financial future with scenario-based simulations.</p>
      <ul>
        <li>
          <Link href="/web">Go to marketing overview</Link>
        </li>
        <li>
          <Link href="/auth/login">Sign in</Link>
        </li>
        <li>
          <Link href="/app">Open app</Link>
        </li>
      </ul>
    </main>
  );
}
