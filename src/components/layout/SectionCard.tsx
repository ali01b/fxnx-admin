import { cn } from '@/lib/utils'

interface SectionCardProps {
  title?: string
  children: React.ReactNode
  className?: string
  headerRight?: React.ReactNode
}

export function SectionCard({ title, children, className, headerRight }: SectionCardProps) {
  return (
    <div className={cn('bg-card border border-border', className)}>
      {title && (
        <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {title}
          </span>
          {headerRight}
        </div>
      )}
      {children}
    </div>
  )
}
