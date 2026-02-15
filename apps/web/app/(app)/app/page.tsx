import Link from "next/link";

export default function AppHomePage() {
  return (
    <section>
      <h1>App Home</h1>
      <p>Open a cloud scenario from member area.</p>
      <Link href="/member/cases">Go to Case Manager</Link>
    </section>
  );
}
