import { Outlet } from 'react-router-dom'
import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'

export default function StoreLayout() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-20">
        <Outlet />
      </main>
      <Footer />
    </>
  )
}
