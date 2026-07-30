"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ReaderView } from "@/components/reader/ReaderView";

function ReaderPageContent() {
  const searchParams = useSearchParams();
  const bookId = searchParams.get("bookId") ?? "";
  return <ReaderView key={bookId} bookId={bookId} />;
}

export default function ReaderPage() {
  return (
    <Suspense fallback={null}>
      <ReaderPageContent />
    </Suspense>
  );
}
