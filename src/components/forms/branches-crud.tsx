'use client';

import { useState } from 'react';
import { SimpleCrud, type SimpleCrudFormApi } from '@/components/forms/simple-crud';
import { parseLatLng } from '@/lib/booking/geofence';

/**
 * Helper under the branch form: fill latitude / longitude from a Google Maps
 * copy ("13.7563, 100.5018") or from the device's current position.
 */
function CoordinateHelper({ api }: { api: SimpleCrudFormApi }) {
  const [text, setText] = useState('');
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [locating, setLocating] = useState(false);

  function fill(lat: number, lng: number, source: string) {
    api.setField('latitude', lat.toFixed(6));
    api.setField('longitude', lng.toFixed(6));
    setMessage({ tone: 'ok', text: `ใส่พิกัดจาก${source}แล้ว — กดบันทึกเพื่อยืนยัน` });
  }

  function applyText(value: string) {
    const point = parseLatLng(value);
    if (!point) { setMessage({ tone: 'error', text: 'รูปแบบไม่ถูกต้อง — ตัวอย่าง 13.756331, 100.501762' }); return; }
    fill(point.lat, point.lng, 'ข้อความที่วาง');
    setText('');
  }

  function fillFromDevice() {
    if (!('geolocation' in navigator)) { setMessage({ tone: 'error', text: 'อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง' }); return; }
    setLocating(true);
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocating(false); fill(pos.coords.latitude, pos.coords.longitude, `ตำแหน่งปัจจุบัน (แม่นยำ ±${Math.round(pos.coords.accuracy)} ม.)`); },
      () => { setLocating(false); setMessage({ tone: 'error', text: 'อ่านตำแหน่งไม่ได้ — อนุญาตการเข้าถึงตำแหน่งในเบราว์เซอร์แล้วลองใหม่' }); },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
      <p className="font-medium text-slate-800">พิกัดคลังสำหรับให้คนขับเช็คอินเอง</p>
      <p className="mt-1 text-xs text-slate-600">
        คนขับกด “ฉันมาถึงแล้ว” ได้เมื่ออยู่ในรัศมีที่กำหนดจากพิกัดนี้ · เว้นว่างทั้งสองช่อง = ไม่ตรวจตำแหน่ง ·
        หาพิกัด: เปิด Google Maps คลิกขวาที่ประตูคลัง แล้วคลิกตัวเลขพิกัดเพื่อคัดลอก
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          className="input min-w-0 flex-1"
          placeholder="วางพิกัดจาก Google Maps เช่น 13.756331, 100.501762"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => { const v = e.clipboardData.getData('text'); if (parseLatLng(v)) { e.preventDefault(); applyText(v); } }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyText(text); } }}
          aria-label="วางพิกัดจาก Google Maps"
        />
        <button type="button" className="btn-outline" onClick={() => applyText(text)} disabled={!text.trim()}>ใช้พิกัดนี้</button>
        <button type="button" className="btn-outline" onClick={fillFromDevice} disabled={locating}>{locating ? 'กำลังหาตำแหน่ง…' : 'ใช้ตำแหน่งปัจจุบัน'}</button>
      </div>
      {message ? <p className={`mt-2 text-xs ${message.tone === 'ok' ? 'text-emerald-700' : 'text-rose-700'}`} role="status">{message.text}</p> : null}
    </div>
  );
}

/** Branch / warehouse CRUD with the check-in geofence fields. */
export function BranchesCrud() {
  return (
    <SimpleCrud
      endpoint="/api/branches"
      title="สาขา"
      defaults={{ max_parallel_queues: 1, active: true, open_time: '09:00', close_time: '18:00', checkin_radius_m: 300 }}
      columns={[
        { key: 'code', label: 'รหัสสาขา', optional: true },
        { key: 'branch_name', label: 'ชื่อสาขา' },
        { key: 'address', label: 'ที่อยู่', optional: true },
        { key: 'phone', label: 'เบอร์โทร', optional: true },
        { key: 'open_time', label: 'เวลาเปิด', type: 'time' },
        { key: 'close_time', label: 'เวลาปิด', type: 'time' },
        { key: 'max_parallel_queues', label: 'จำนวนคิวพร้อมกัน (ไม่ใช้กับท่า)', type: 'number', hideInTable: true },
        { key: 'latitude', label: 'ละติจูด', type: 'number', step: 'any', optional: true, hideInTable: true },
        { key: 'longitude', label: 'ลองจิจูด', type: 'number', step: 'any', optional: true, hideInTable: true },
        { key: 'checkin_radius_m', label: 'รัศมีเช็คอิน (เมตร)', type: 'number', hint: '50–5000 ม. · ค่าเริ่มต้น 300 ม.' },
        { key: 'active', label: 'เปิดใช้งาน', type: 'checkbox' },
      ]}
      formExtra={(api) => <CoordinateHelper api={api} />}
    />
  );
}
