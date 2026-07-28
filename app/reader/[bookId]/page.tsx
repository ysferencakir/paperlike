import { ReaderView } from "@/components/reader/ReaderView";

export default async function ReaderPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  return <ReaderView bookId={bookId} />;
}
