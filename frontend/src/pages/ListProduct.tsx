import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { createProduct, activateProduct } from '../lib/api';
import { listProduct } from '../lib/soroban';
import { useWalletStore } from '../store/walletStore';
import { xlmToStroops } from '../lib/stellar';
import TxStatusToast from '../components/shared/TxStatusToast';

const schema = z.object({
  name: z.string().min(2),
  category: z.enum(['grain', 'vegetable', 'fruit', 'dairy', 'livestock']),
  quantity: z.coerce.number().positive(),
  unit: z.enum(['kg', 'ton', 'piece', 'liter']),
  priceXlm: z.coerce.number().positive(),
  description: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function ListProduct() {
  const { publicKey } = useWalletStore();
  const navigate = useNavigate();
  const [images, setImages] = useState<FileList | null>(null);
  const [toast, setToast] = useState<{ status: 'pending' | 'success' | 'error'; message?: string } | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    if (!publicKey) return;
    setToast({ status: 'pending', message: 'Uploading product…' });

    try {
      const form = new FormData();
      Object.entries(data).forEach(([k, v]) => form.append(k, String(v)));
      if (images) Array.from(images).forEach((f) => form.append('images', f));

      const res = await createProduct(form);
      const { productId, metadataHash } = res.data;

      setToast({ status: 'pending', message: 'Signing transaction…' });
      await listProduct(publicKey, BigInt(xlmToStroops(data.priceXlm)), BigInt(data.quantity), metadataHash);

      setToast({ status: 'success', message: 'Product listed successfully!' });
      setTimeout(() => navigate('/farmer/dashboard'), 1500);
    } catch (err: any) {
      setToast({ status: 'error', message: err.message });
    }
  };

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-green-800 mb-8">List a Product</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-2xl shadow p-6 space-y-5">
        <div>
          <label className={labelCls}>Product Name</label>
          <input {...register('name')} className={inputCls} placeholder="e.g. Organic Maize" />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Category</label>
            <select {...register('category')} className={inputCls}>
              {['grain', 'vegetable', 'fruit', 'dairy', 'livestock'].map((c) => (
                <option key={c} value={c} className="capitalize">{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Unit</label>
            <select {...register('unit')} className={inputCls}>
              {['kg', 'ton', 'piece', 'liter'].map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Quantity</label>
            <input {...register('quantity')} type="number" className={inputCls} placeholder="100" />
            {errors.quantity && <p className="text-red-500 text-xs mt-1">{errors.quantity.message}</p>}
          </div>
          <div>
            <label className={labelCls}>Price (XLM)</label>
            <input {...register('priceXlm')} type="number" step="0.01" className={inputCls} placeholder="10.00" />
            {errors.priceXlm && <p className="text-red-500 text-xs mt-1">{errors.priceXlm.message}</p>}
          </div>
        </div>

        <div>
          <label className={labelCls}>Description (optional)</label>
          <textarea {...register('description')} rows={3} className={inputCls} placeholder="Tell buyers about your produce…" />
        </div>

        <div>
          <label className={labelCls}>Product Images</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setImages(e.target.files)}
            className="text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-green-100 file:text-green-700 file:font-medium"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white py-3 rounded-xl font-semibold transition"
        >
          {isSubmitting ? 'Listing…' : 'List Product'}
        </button>
      </form>

      {toast && <TxStatusToast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}
