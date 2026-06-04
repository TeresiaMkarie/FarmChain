import { useState } from 'react';
import { useProducts } from '../hooks/useProducts';
import ProductCard from '../components/marketplace/ProductCard';

const CATEGORIES = ['all', 'grain', 'vegetable', 'fruit', 'dairy', 'livestock'];

export default function Marketplace() {
  const { products, loading, error } = useProducts();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  const filtered = products.filter((p) => {
    const matchCat = category === 'all' || p.category === category;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch && p.status === 'active';
  });

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold text-green-800 mb-6">Marketplace</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-8">
        <input
          type="text"
          placeholder="Search produce…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize border transition ${category === c ? 'bg-green-700 text-white border-green-700' : 'border-gray-300 text-gray-600 hover:border-green-500'}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-gray-500">Loading products…</p>}
      {error && <p className="text-red-500">{error}</p>}

      {!loading && filtered.length === 0 && (
        <p className="text-gray-400 text-center py-16">No products found.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </div>
  );
}
