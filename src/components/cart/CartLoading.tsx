import Skeleton from '../ui/Skeleton'

export default function CartLoading() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((n) => (
        <div key={n} className="flex gap-4 p-4 bg-white rounded-xl border border-gray-100">
          <Skeleton width="6rem" height="5rem" rounded="lg" className="shrink-0" />
          <div className="flex-1 space-y-3">
            <Skeleton height="1rem" width="60%" rounded="lg" />
            <Skeleton height="0.75rem" width="30%" rounded="lg" />
            <div className="flex justify-between items-center pt-2">
              <Skeleton height="2rem" width="6rem" rounded="lg" />
              <Skeleton height="0.75rem" width="4rem" rounded="lg" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
