import { Link } from 'react-router-dom';
import { useWalletStore } from '../store/walletStore';
import HeroIllustration from '../components/shared/HeroIllustration';

const steps = [
  {
    step: '01',
    title: 'Connect Your Wallet',
    desc: 'Sign in with Freighter — a free Stellar wallet. No email, no password, just your keys.',
  },
  {
    step: '02',
    title: 'List or Browse Produce',
    desc: 'Farmers list fresh produce with photos and pricing. Buyers browse and place orders instantly.',
  },
  {
    step: '03',
    title: 'Funds Held in Escrow',
    desc: 'Payment is locked in a Stellar smart contract the moment an order is placed.',
  },
  {
    step: '04',
    title: 'Confirm & Release',
    desc: 'Buyer confirms delivery and funds are released directly to the farmer — zero fees, zero middlemen.',
  },
];

const features = [
  {
    icon: '🔒',
    title: 'Smart Contract Escrow',
    desc: 'Every payment is secured on the Stellar blockchain. Funds only move when both parties agree.',
  },
  {
    icon: '⚡',
    title: 'Near-Instant Settlement',
    desc: 'Stellar settles transactions in 3–5 seconds. Farmers get paid fast, not in 30-day cycles.',
  },
  {
    icon: '📦',
    title: 'Shipping Proof on Chain',
    desc: 'Farmers submit a delivery hash when shipping. Creates an immutable record of every dispatch.',
  },
  {
    icon: '⚖️',
    title: 'Dispute Resolution',
    desc: 'Raise a dispute and a platform admin mediates. Funds split fairly using on-chain basis points.',
  },
  {
    icon: '🌍',
    title: 'Open to All',
    desc: 'Any farmer with a smartphone can participate. No bank account required — just XLM.',
  },
  {
    icon: '🔍',
    title: 'Full Transparency',
    desc: 'Every order, payment, and status change is recorded on-chain and publicly verifiable.',
  },
];

const stats = [
  { value: '< 5s', label: 'Settlement time' },
  { value: '0%', label: 'Middleman cut' },
  { value: '100%', label: 'On-chain escrow' },
  { value: 'XLM', label: 'Stellar native payments' },
];

export default function Home() {
  const { connected, role } = useWalletStore();

  const dashboardLink =
    connected && role === 'Farmer'
      ? '/farmer/dashboard'
      : connected && role === 'Buyer'
      ? '/buyer/dashboard'
      : '/auth';

  return (
    <div className="bg-white text-gray-800">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative bg-gradient-to-br from-green-950 via-green-900 to-green-800 text-white overflow-hidden -mt-14 pt-14">
        {/* dot grid */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '36px 36px' }}
        />
        <div className="relative max-w-6xl mx-auto px-6 py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

          {/* Left — text */}
          <div className="flex flex-col gap-7">
            <span className="self-start bg-green-600/50 border border-green-400/40 text-green-100 text-sm font-medium px-4 py-1.5 rounded-full">
              Built on Stellar · Powered by Soroban
            </span>

            <h1 className="text-5xl sm:text-6xl font-extrabold leading-tight">
              Farm to Buyer,<br />
              <span className="text-green-300">No Middlemen.</span>
            </h1>

            <p className="text-lg text-green-100 leading-relaxed max-w-lg">
              FarmChain is a decentralised marketplace where farmers sell directly to buyers.
              Every payment is locked in a Stellar smart contract escrow — released only when
              delivery is confirmed.
            </p>

            <div className="flex gap-4 flex-wrap">
              <Link
                to={dashboardLink}
                className="bg-white text-green-800 hover:bg-green-50 px-8 py-3.5 rounded-xl font-bold text-lg shadow-lg transition"
              >
                {connected ? 'Go to Dashboard' : 'Get Started Free'}
              </Link>
              <Link
                to="/marketplace"
                className="border border-white/40 hover:bg-white/10 text-white px-8 py-3.5 rounded-xl font-semibold text-lg transition"
              >
                Browse Marketplace
              </Link>
            </div>

            <p className="text-green-300 text-sm">
              Free to join · No bank account needed · Instant XLM settlement
            </p>
          </div>

          {/* Right — illustration */}
          <div className="hidden lg:flex items-center justify-center">
            <HeroIllustration />
          </div>

        </div>
      </section>

      {/* ── Stats bar ────────────────────────────────────────── */}
      <section className="bg-green-800 text-white">
        <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {stats.map(({ value, label }) => (
            <div key={label}>
              <p className="text-3xl font-extrabold text-green-300">{value}</p>
              <p className="text-sm text-green-100 mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-4xl font-bold text-gray-900">How It Works</h2>
          <p className="text-gray-500 mt-3 max-w-xl mx-auto">
            Four simple steps from farm to payment — all secured on-chain.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map(({ step, title, desc }) => (
            <div key={step} className="relative flex flex-col gap-4">
              <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center">
                <span className="text-green-700 font-extrabold text-xl">{step}</span>
              </div>
              <h3 className="font-bold text-lg text-gray-900">{title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── For Farmers / For Buyers ─────────────────────────── */}
      <section className="bg-gray-50 py-24">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* Farmers */}
          <div className="bg-green-800 text-white rounded-3xl p-10 flex flex-col gap-6">
            <span className="text-5xl">🌾</span>
            <h3 className="text-3xl font-bold">For Farmers</h3>
            <ul className="space-y-3 text-green-100 text-sm">
              {[
                'List produce with photos, price, and quantity',
                'Receive payment locked in escrow the moment a buyer orders',
                'Submit a shipping hash as proof of dispatch',
                'Get paid instantly on delivery confirmation',
                'Raise disputes if a buyer doesn\'t respond',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="text-green-400 mt-0.5">✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <Link
              to="/auth"
              className="mt-auto self-start bg-white text-green-800 hover:bg-green-50 px-6 py-3 rounded-xl font-bold transition"
            >
              Start Selling
            </Link>
          </div>

          {/* Buyers */}
          <div className="bg-white border border-gray-200 rounded-3xl p-10 flex flex-col gap-6 shadow-sm">
            <span className="text-5xl">🛒</span>
            <h3 className="text-3xl font-bold text-gray-900">For Buyers</h3>
            <ul className="space-y-3 text-gray-600 text-sm">
              {[
                'Browse fresh produce directly from verified farmers',
                'Pay with XLM — no bank account needed',
                'Your funds are protected in escrow until delivery',
                'Confirm delivery to release payment to the farmer',
                'Open a dispute if produce doesn\'t arrive as described',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="text-green-600 mt-0.5">✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <Link
              to="/marketplace"
              className="mt-auto self-start bg-green-700 hover:bg-green-600 text-white px-6 py-3 rounded-xl font-bold transition"
            >
              Browse Produce
            </Link>
          </div>
        </div>
      </section>

      {/* ── Features grid ────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-4xl font-bold text-gray-900">Built for Trust</h2>
          <p className="text-gray-500 mt-3 max-w-xl mx-auto">
            Every feature is designed to protect both farmers and buyers.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map(({ icon, title, desc }) => (
            <div
              key={title}
              className="bg-white border border-gray-100 rounded-2xl p-7 shadow-sm hover:shadow-md transition flex flex-col gap-3"
            >
              <span className="text-3xl">{icon}</span>
              <h4 className="font-bold text-gray-900 text-lg">{title}</h4>
              <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────── */}
      <section className="bg-green-800 text-white">
        <div className="max-w-3xl mx-auto px-6 py-24 text-center flex flex-col items-center gap-6">
          <h2 className="text-4xl font-extrabold leading-tight">
            Ready to trade without<br />the middleman?
          </h2>
          <p className="text-green-200 text-lg max-w-xl">
            Join FarmChain today. Connect your Freighter wallet and start buying
            or selling in under two minutes.
          </p>
          <Link
            to="/auth"
            className="bg-white text-green-800 hover:bg-green-50 px-10 py-4 rounded-xl font-bold text-lg shadow-lg transition"
          >
            Connect Wallet
          </Link>
          <p className="text-green-400 text-sm">
            Free to use · No sign-up · Powered by Stellar
          </p>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <span className="font-semibold text-gray-700">🌾 FarmChain</span>
          <span>Built on Stellar · Soroban smart contracts</span>
          <div className="flex gap-6">
            <Link to="/marketplace" className="hover:text-green-700">Marketplace</Link>
            <Link to="/auth" className="hover:text-green-700">Connect</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
