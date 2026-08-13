export default function NewTransactionLoading() {
  return (
    <div className="min-h-screen bg-[#f5eee6] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-6xl animate-pulse">
        <div className="h-10 w-40 rounded-full bg-white/80" />
        <div className="mt-6 h-8 w-56 rounded-full bg-white/80" />
        <div className="mt-10 space-y-6">
          <div className="h-24 rounded-[1rem] bg-white/80" />
          <div className="h-20 rounded-[1rem] bg-white/80" />
          <div className="h-36 rounded-[1rem] bg-white/80" />
          <div className="h-20 rounded-[1rem] bg-white/80" />
        </div>
      </div>
    </div>
  );
}
