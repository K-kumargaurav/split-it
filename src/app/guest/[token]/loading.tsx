export default function GuestLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <div className="space-y-4 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-accent" />
        <p className="text-sm text-text-secondary">Loading your balance...</p>
      </div>
    </div>
  );
}
