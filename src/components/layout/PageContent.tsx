import { cn } from '@/lib/utils'

interface PageContentProps {
  children: React.ReactNode
  className?: string
}

export function PageContent({ children, className }: PageContentProps) {
  return (
    <div className={cn('p-2 flex flex-col gap-2', className)}>
      {children}
    </div>
  )
}
