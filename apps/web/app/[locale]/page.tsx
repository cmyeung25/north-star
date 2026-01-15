import { redirect } from "next/navigation";

type HomePageProps = {
  params: { locale: string };
};

export default function HomePage({ params }: HomePageProps) {
  redirect(`/${params.locale}/scenarios`);
}
