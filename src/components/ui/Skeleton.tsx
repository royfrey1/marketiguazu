interface SkeletonProps {
  width?: string
  height?: string
  className?: string
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
}

const roundedStyles: Record<string, string> = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  full: 'rounded-full',
}

export default function Skeleton({
  width,
  height,
  className = '',
  rounded = 'lg',
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse bg-gray-200 ${roundedStyles[rounded]} ${className}`.trim()}
      style={{
        width: width || '100%',
        height: height || '1rem',
      }}
    />
  )
}
