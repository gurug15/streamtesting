"use client";

import { useMolstar } from "@/hooks/useMolstar";
import dynamic from "next/dynamic";

const MolstarViewer = dynamic(() => import("@/components/molstarViewer"), {
  ssr: false,
});

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <MolstarViewer />
    </div>
  );
}
