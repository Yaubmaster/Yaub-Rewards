// Skeleton de carga (feedback inmediato al navegar entre tabs)
export default function Loading() {
  return (
    <div className="flex flex-col gap-4 pt-2">
      <div className="shimmer h-7 w-[55%] rounded-[9px]" />
      <div className="shimmer h-[150px] rounded-[20px]" />
      <div className="flex gap-3.5">
        <div className="shimmer h-24 flex-1 rounded-2xl" />
        <div className="shimmer h-24 flex-1 rounded-2xl" />
      </div>
      <div className="shimmer h-[220px] rounded-[20px]" />
    </div>
  );
}
