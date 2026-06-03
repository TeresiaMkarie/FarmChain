import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 py-20 text-center">
        <h1 className="text-5xl font-extrabold text-green-800 mb-6 leading-tight">
          No Middlemen.<br />Just Fair Trade.
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10">
          FarmChain connects farmers directly to buyers on the Stellar blockchain.
          Every payment is secured in a smart contract escrow — released only when
          you confirm delivery.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link
            to="/auth"
            className="bg-green-700 hover:bg-green-600 text-white px-8 py-3 rounded-xl font-semibold text-lg shadow"
          >
            Get Started
          </Link>
          <Link
            to="/marketplace"
            className="border border-green-700 text-green-700 hover:bg-green-50 px-8 py-3 rounded-xl font-semibold text-lg"
          >
            Browse Marketplace
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-20 grid grid-cols-1 sm:grid-cols-3 gap-8">
        {[
          { icon: '🌾', title: 'Farmers', desc: 'List your produce, set your price, get paid directly.' },
          { icon: '🔒', title: 'Escrow Protection', desc: 'Funds locked on Stellar until delivery is confirmed.' },
          { icon: '🛒', title: 'Buyers', desc: 'Access fresh produce directly from the farm.' },
        ].map(({ icon, title, desc }) => (
          <div key={title} className="bg-white rounded-2xl shadow p-6 text-center">
            <div className="text-4xl mb-3">{icon}</div>
            <h3 className="font-bold text-gray-800 text-lg mb-2">{title}</h3>
            <p className="text-gray-500 text-sm">{desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
