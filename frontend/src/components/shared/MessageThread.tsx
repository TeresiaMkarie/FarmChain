import { useState, useEffect, useRef } from 'react';
import api from '../../lib/api';

interface Message {
  id: string;
  sender_pk: string;
  sender_name: string;
  body: string;
  created_at: string;
}

interface Props {
  orderId: string;
  myPublicKey: string;
}

export default function MessageThread({ orderId, myPublicKey }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/messages', { params: { orderId } })
      .then((r) => setMessages(r.data.messages))
      .catch(() => {});
  }, [orderId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      const res = await api.post('/messages', { orderId, body: draft.trim() });
      setMessages((prev) => [...prev, res.data.message]);
      setDraft('');
    } catch {
      // silently fail — message stays in draft
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow mt-4">
      <div className="px-5 py-3 border-b border-gray-100">
        <p className="font-semibold text-gray-700 text-sm">Messages</p>
      </div>

      <div className="px-5 py-3 max-h-64 overflow-y-auto space-y-3">
        {messages.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-4">No messages yet. Start the conversation.</p>
        )}
        {messages.map((m) => {
          const isMe = m.sender_pk === myPublicKey;
          return (
            <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-xs rounded-2xl px-4 py-2 text-sm ${isMe ? 'bg-green-700 text-white rounded-br-none' : 'bg-gray-100 text-gray-800 rounded-bl-none'}`}>
                {m.body}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {isMe ? 'You' : m.sender_name} · {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="px-5 pb-4 pt-2 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
          placeholder="Type a message…"
          maxLength={2000}
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
        />
        <button
          onClick={send}
          disabled={!draft.trim() || sending}
          className="bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-medium"
        >
          Send
        </button>
      </div>
    </div>
  );
}
