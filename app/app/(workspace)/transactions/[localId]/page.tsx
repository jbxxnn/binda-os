import { AppTransactionDetail } from "@/components/app/app-transaction-detail";

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ localId: string }>;
}) {
  const { localId } = await params;

  return <AppTransactionDetail localId={localId} />;
}
