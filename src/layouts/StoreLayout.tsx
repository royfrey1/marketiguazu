import { Outlet } from 'react-router-dom'
import TopBar from '../components/layout/TopBar'
import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'
import StorefrontFloatingActions from '../components/layout/StorefrontFloatingActions'

export default function StoreLayout() {
  return (
    <>
      <TopBar />
      <Navbar />
      <main className="min-h-screen">
        <Outlet />
      </main>
      <Footer />
      <StorefrontFloatingActions />
    </>
  )
}
