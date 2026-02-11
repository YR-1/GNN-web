export default function RootPage() {
  return (
    <div className='min-h-screen bg-gradient-to-br from-blue-600 to-indigo-800 flex items-center justify-center'>
      <div className='text-center text-white'>
        <h1 className='text-5xl font-bold mb-4'>Data Analytics</h1>
        <p className='text-xl mb-8'>Production-ready analytics platform</p>
        <a
          href='/login'
          className='bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition'
        >
          Get Started
        </a>
      </div>
    </div>
  )
}
