import { Outlet } from 'react-router-dom'

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-[#1b382f] flex items-center justify-center px-4 relative overflow-hidden">
      <Outlet />
    </div>
  )
}
