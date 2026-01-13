"use client";

import { useMediaQuery } from "@mantine/hooks";
import TimelineDesktop from "../../components/timeline/TimelineDesktop";
import TimelineMobile from "../../components/timeline/TimelineMobile";

export default function TimelinePage() {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return <TimelineDesktop />;
  }

  return <TimelineMobile />;
}
