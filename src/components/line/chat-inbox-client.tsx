'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { useToast } from '@/components/ui/toast';
import { formatDateTimeDMY } from '@/lib/utils/date-format';

type LineUser = { id: string; line_user_id: string; display_name: string | null; picture_url?: string | null };
type ChatMsg = {
  id: string;
  direction: string;
  message_type: string;
  message_text: string | null;
  payload?: {
    sticker_package_id?: string;
    sticker_id?: string;
    media_url?: string;
    media_name?: string;
    media_type?: string;
  } | null;
  created_at: string;
};

type StickerPreset = {
  emoji: string;
  label: string;
  packageId: string;
  stickerId: string;
};

const STICKER_PRESETS: StickerPreset[] = [
  { emoji: '😀', label: 'Happy', packageId: '11537', stickerId: '52002734' },
  { emoji: '😍', label: 'Love', packageId: '11537', stickerId: '52002735' },
  { emoji: '🙏', label: 'Thanks', packageId: '11537', stickerId: '52002736' },
  { emoji: '👍', label: 'OK', packageId: '11537', stickerId: '52002737' },
  { emoji: '🎉', label: 'Congrats', packageId: '11537', stickerId: '52002739' },
  { emoji: '😅', label: 'Sorry', packageId: '11537', stickerId: '52002740' },
];

export function ChatInboxClient() {
  const { push } = useToast();
  const [users, setUsers] = useState<LineUser[]>([]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [selected, setSelected] = useState<LineUser | null>(null);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [showStickerPanel, setShowStickerPanel] = useState(false);
  const [stickerPackageId, setStickerPackageId] = useState('');
  const [stickerId, setStickerId] = useState('');

  const loadUsers = useCallback(async () => {
    const res = await fetch('/api/chat-inbox', { cache: 'no-store' });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? 'โหลด inbox ไม่สำเร็จ', 'error');
    setUsers(json.data.users ?? []);
  }, [push]);

  async function loadMessages(lineUserPk: string) {
    const res = await fetch(`/api/chat-inbox?line_user_id=${lineUserPk}`, { cache: 'no-store' });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? 'โหลดข้อความไม่สำเร็จ', 'error');
    setMessages(json.data.messages ?? []);
  }

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  function pickSticker(preset: StickerPreset) {
    setStickerPackageId(preset.packageId);
    setStickerId(preset.stickerId);
    setShowStickerPanel(false);
  }

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const hasText = text.trim().length > 0;
    const hasSticker = Boolean(stickerPackageId && stickerId);
    const hasFile = Boolean(file);
    if (!hasText && !hasSticker && !hasFile) return;

    const form = new FormData();
    form.set('line_user_id', selected.line_user_id);
    if (hasText) {
      form.set('message_type', 'text');
      form.set('message', text.trim());
    }
    if (hasSticker) {
      form.set('message_type', 'sticker');
      form.set('sticker_package_id', stickerPackageId);
      form.set('sticker_id', stickerId);
    }
    if (hasFile && file) form.set('file', file);

    const res = await fetch('/api/chat-inbox', { method: 'POST', body: form });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? 'ส่งข้อความไม่สำเร็จ', 'error');

    setText('');
    setFile(null);
    setStickerPackageId('');
    setStickerId('');
    push('ส่งข้อความแล้ว');
    await loadMessages(selected.id);
  }

  return (
    // Below md: master/detail — roster until a conversation is picked, then the thread with a back button.
    <div className="grid gap-4 md:grid-cols-[320px_1fr]">
      <aside className={`card p-3 ${selected ? 'hidden md:block' : ''}`}>
        <p className="px-2 py-1 text-xs font-semibold tracking-wide text-slate-400">CONVERSATIONS</p>
        <div className="space-y-1">
          {users.map((u) => (
            <button
              key={u.id}
              className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${selected?.id === u.id ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}
              onClick={() => { setSelected(u); void loadMessages(u.id); }}
            >
              <div className="flex items-center gap-3">
                {u.picture_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.picture_url} alt={u.display_name ?? 'LINE User'} className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                    {(u.display_name || 'U').slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-800">{u.display_name || 'LINE User'}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      <section className={`card p-4 ${selected ? '' : 'hidden md:block'}`}>
        {!selected ? <p className="text-sm text-slate-500">เลือกบทสนทนาเพื่อดูข้อความ</p> : (
          <>
            <div className="mb-3 flex items-center gap-3 border-b border-slate-200 pb-3">
              <button
                type="button"
                className="btn-outline shrink-0 !px-2 md:hidden"
                aria-label="กลับไปรายการสนทนา"
                onClick={() => setSelected(null)}
              >
                <ArrowBackRoundedIcon fontSize="small" />
              </button>
              {selected.picture_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selected.picture_url} alt={selected.display_name ?? 'LINE User'} className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600">
                  {(selected.display_name || 'U').slice(0, 1).toUpperCase()}
                </div>
              )}
              <div>
                <div className="text-sm font-semibold text-slate-800">{selected.display_name || selected.line_user_id}</div>
                <div className="text-xs text-slate-500">{selected.line_user_id}</div>
              </div>
            </div>

            <div className="h-[50dvh] space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 md:h-[460px]">
              {messages.length === 0 ? <p className="text-sm text-slate-500">ยังไม่มีข้อความ</p> : messages.map((m) => (
                <div key={m.id} className={`max-w-[82%] rounded-xl px-3 py-2 text-sm shadow-sm ${m.direction === 'outbound' ? 'ml-auto bg-[#12a862] text-white' : 'bg-white text-slate-800'}`}>
                  {m.message_type === 'image' && m.payload?.media_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.payload.media_url} alt={m.payload.media_name || 'chat image'} className="max-h-64 w-auto rounded-lg object-contain" />
                  ) : null}
                  {m.message_type === 'video' && m.payload?.media_url ? (
                    <a className={`underline ${m.direction === 'outbound' ? 'text-white' : 'text-slate-700'}`} href={m.payload.media_url} target="_blank" rel="noreferrer">
                      🎬 {m.payload.media_name || 'Video'}
                    </a>
                  ) : null}
                  {m.message_type === 'file' && m.payload?.media_url ? (
                    <a className={`underline ${m.direction === 'outbound' ? 'text-white' : 'text-slate-700'}`} href={m.payload.media_url} target="_blank" rel="noreferrer">
                      📎 {m.payload.media_name || 'File'}
                    </a>
                  ) : null}
                  {m.message_type === 'sticker' ? (
                    <p>Sticker ({m.payload?.sticker_package_id ?? '-'}:{m.payload?.sticker_id ?? '-'})</p>
                  ) : null}
                  {m.message_type === 'text' ? <p>{m.message_text || '-'}</p> : null}
                  {!['text', 'sticker', 'image', 'video', 'file'].includes(m.message_type) ? <p>{m.message_text || m.message_type}</p> : null}
                  <p className={`mt-1 text-[10px] ${m.direction === 'outbound' ? 'text-blue-100' : 'text-slate-500'}`}>{formatDateTimeDMY(m.created_at)}</p>
                </div>
              ))}
            </div>

            <form onSubmit={sendMessage} className="mt-3 space-y-2">
              {showStickerPanel ? (
                <div className="rounded-xl border border-slate-200 bg-white p-2">
                  <div className="grid grid-cols-6 gap-2">
                    {STICKER_PRESETS.map((s) => (
                      <button
                        key={`${s.packageId}-${s.stickerId}`}
                        type="button"
                        title={s.label}
                        className="rounded-lg border border-slate-200 p-2 text-xl hover:bg-slate-50"
                        onClick={() => pickSticker(s)}
                      >
                        {s.emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {file ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  แนบไฟล์: {file.name}
                  <button type="button" className="ml-2 text-rose-600 underline" onClick={() => setFile(null)}>ลบ</button>
                </div>
              ) : null}

              {stickerPackageId && stickerId ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  เลือกสติกเกอร์แล้ว ({stickerPackageId}:{stickerId})
                  <button
                    type="button"
                    className="ml-2 underline"
                    onClick={() => {
                      setStickerPackageId('');
                      setStickerId('');
                    }}
                  >
                    ล้าง
                  </button>
                </div>
              ) : null}

              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2 py-2">
                <label className="cursor-pointer rounded-lg px-2 py-1 text-lg hover:bg-slate-100" title="แนบไฟล์">
                  📎
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                <button
                  type="button"
                  className={`rounded-lg px-2 py-1 text-lg hover:bg-slate-100 ${showStickerPanel ? 'bg-slate-100' : ''}`}
                  title="สติกเกอร์"
                  onClick={() => setShowStickerPanel((v) => !v)}
                >
                  😊
                </button>
                <input
                  className="input !h-10 min-w-0 !border-0 !bg-transparent focus:!ring-0"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="พิมพ์ข้อความ..."
                />
                <button className="btn-primary shrink-0" type="submit">ส่ง</button>
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

