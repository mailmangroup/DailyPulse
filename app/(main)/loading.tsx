import { Skeleton } from '@/components/ui/skeleton'

const statusCells = Array.from({ length: 4 }, (_, index) => index)
const peopleRows = Array.from({ length: 12 }, (_, index) => index)
const teamCards = Array.from({ length: 8 }, (_, index) => index)

function TaskCardSkeleton({ emphasize = false }: { emphasize?: boolean }) {
  return (
    <div
      className={
        emphasize
          ? 'grid h-full min-h-[210px] grid-rows-[3.7rem_minmax(0,1fr)] overflow-hidden rounded-xl border border-border bg-card shadow-md ring-2 ring-primary/20'
          : 'grid h-[210px] grid-rows-[3.7rem_minmax(0,1fr)] overflow-hidden rounded-xl border border-border bg-card/85 shadow-sm'
      }
    >
      <div className="flex items-center gap-3 border-b border-border/40 px-3">
        <Skeleton className="h-8.5 w-8.5 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3.5 w-28 max-w-full rounded-full" />
          <Skeleton className="h-3 w-16 rounded-full" />
        </div>
        <Skeleton className="h-5.5 w-16 rounded-full" />
      </div>
      <div className="space-y-2.5 px-3 py-3">
        <Skeleton className="h-3.5 w-full rounded-full" />
        <Skeleton className="h-3.5 w-5/6 rounded-full" />
        <Skeleton className="h-3.5 w-2/3 rounded-full" />
        <Skeleton className="h-3.5 w-1/2 rounded-full" />
      </div>
    </div>
  )
}

export default function Loading() {
  return (
    <>
      <div className="sticky top-0 z-30 border-b border-border/10 bg-background/95 p-3 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-56 rounded-full" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-36 rounded-full" />
            <Skeleton className="h-9 w-20 rounded-full" />
            <Skeleton className="h-9 w-20 rounded-full" />
            <Skeleton className="h-9 w-9 rounded-full" />
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1800px] p-3 pr-12 md:p-4 md:pr-14">
        <div className="flex flex-col gap-6 md:gap-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-0">
            <section className="flex w-full shrink-0 flex-col gap-2.5 lg:w-[340px] lg:pr-5">
              <Skeleton className="h-3 w-20 rounded-full" />
              <div className="flex min-h-0 flex-1 flex-col">
                <TaskCardSkeleton emphasize />
              </div>
            </section>

            <section className="flex min-w-0 flex-1 flex-col gap-2.5 lg:border-l lg:border-border/40 lg:pl-5">
              <Skeleton className="h-3 w-24 rounded-full" />
              <div className="flex min-h-[210px] flex-1 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
                <div className="grid shrink-0 grid-cols-2 gap-px border-b border-border/50 bg-border/40 sm:grid-cols-4">
                  {statusCells.map((cell) => (
                    <div key={cell} className="flex flex-col items-start gap-1.5 bg-card px-3 py-2.5">
                      <Skeleton className="h-2.5 w-14 rounded-full" />
                      <div className="flex items-center gap-1.5">
                        <Skeleton className="h-1.5 w-1.5 rounded-full" />
                        <Skeleton className="h-5 w-6 rounded-full" />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-3 sm:p-3.5">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-1.5 w-1.5 rounded-full" />
                    <Skeleton className="h-3 w-16 rounded-full" />
                    <div className="h-px flex-1 bg-border/50" />
                    <Skeleton className="h-3 w-8 rounded-full" />
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-1.5">
                    {peopleRows.map((row) => (
                      <div
                        key={row}
                        className="flex min-w-0 items-center gap-2 rounded-lg bg-muted/30 px-1.5 py-1.5"
                      >
                        <Skeleton className="h-6 w-6 rounded-full" />
                        <Skeleton className="h-3 w-16 max-w-full rounded-full" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <section className="flex flex-col gap-2.5 border-t border-border/30 pt-5">
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-3 w-12 rounded-full" />
              <Skeleton className="h-6 w-28 rounded-full" />
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
              {teamCards.map((card) => (
                <TaskCardSkeleton key={card} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
