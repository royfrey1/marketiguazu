interface InventoryStockBadgeProps {
  quantity: number
  reserved: number
  threshold: number
}

export default function InventoryStockBadge({ quantity, reserved, threshold }: InventoryStockBadgeProps) {
  const available = quantity - reserved

  if (available <= 0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/30">
        Sin stock
      </span>
    )
  }

  if (available <= threshold) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/30">
        Stock bajo
      </span>
    )
  }

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#389C52]/10 text-[#389C52] border border-[#389C52]/20">
      En stock
    </span>
  )
}
