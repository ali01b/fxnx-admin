import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title?: string
  left?: React.ReactNode
  children?: React.ReactNode
  className?: string
}

export function PageHeader({ title, left, children, className }: PageHeaderProps) {
  return (
    <div className={cn('bg-card border border-border px-3 py-1.5 flex items-center justify-between gap-3', className)}>
      {left ?? (
        <span className="text-[13px] font-bold tracking-wide text-foreground">
          {title}
        </span>
      )}
      {children && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {children}
        </div>
      )}
    </div>
  )
}
