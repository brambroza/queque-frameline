'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import TvRoundedIcon from '@mui/icons-material/TvRounded';
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded';
import HandymanRoundedIcon from '@mui/icons-material/HandymanRounded';
import SupportAgentRoundedIcon from '@mui/icons-material/SupportAgentRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import PowerRoundedIcon from '@mui/icons-material/PowerRounded';
import { SignageBoard } from '@/components/signage/signage-board';
import {
  MOCK_SIGNAGE_CLINIC,
  MOCK_SIGNAGE_NAIL,
  MOCK_SIGNAGE_RESTAURANT,
  presetConfig,
  SIGNAGE_SHOWCASE_PRESETS,
} from '@/components/signage/mock-data';
import styles from './landing-page.module.css';

const ROTATE_MS = 5000;
const lineFriendUrl = 'https://lin.ee/oViqAoh';

const signageChips = [
  { number: '01', label: '5 เทมเพลต รองรับแนวตั้งและแนวนอน' },
  { number: '02', label: 'ซ่อนหรือปิดบังชื่อลูกค้าได้ (PDPA)' },
  { number: '03', label: 'QR จองคิวผ่าน LINE บนจอ' },
];

/**
 * Hardware form factors shown in the "what does it look like" gallery.
 * `tags` float over the scene, `seenAt` / `setup` answer "where have I seen
 * this" and "how does it get on the screen" for readers new to signage.
 */
const devices = [
  {
    id: 'tv',
    kind: 'Smart TV แขวนผนัง',
    size: '43" – 65"',
    desc: 'ทีวีธรรมดาแขวนผนังในระดับสายตา เลขคิวที่กำลังเรียกขึ้นตัวใหญ่ ลูกค้านั่งรอก็อ่านได้จากอีกฝั่งห้อง',
    seenAt: 'ร้านอาหาร คลินิก ศูนย์บริการรถ',
    setup: 'ใช้ทีวีที่ร้านมี หรือให้เราจัดชุดพร้อมกล่อง Android และขาแขวน',
    tags: ['แขวนผนังระดับสายตา', 'อ่านชัดจาก 8–10 ม.'],
  },
  {
    id: 'kiosk',
    kind: 'ป้าย Digital Signage ตั้งพื้น',
    size: '43" – 55" แนวตั้ง',
    desc: 'จอแนวตั้งในตัวเครื่องสูงเท่าคน ตั้งตรงไหนก็ได้ไม่ต้องเจาะผนัง แบบเดียวกับที่เห็นหน้าเคาน์เตอร์ธนาคารและในห้าง',
    seenAt: 'ห้าง ธนาคาร โรงพยาบาล',
    setup: 'เสียบปลั๊กเดียว เครื่องเปิดหน้าจอคิวเองอัตโนมัติ',
    tags: ['สูง ~1.8 ม.', 'มีล้อ เลื่อนย้ายได้'],
  },
  {
    id: 'tablet',
    kind: 'แท็บเล็ต / จอเคาน์เตอร์',
    size: '10" – 15"',
    desc: 'จอเล็กวางบนเคาน์เตอร์หรือหน้าห้องตรวจ ลูกค้าที่ยืนรอใกล้ ๆ เห็นคิวของตัวเองทันที',
    seenAt: 'ร้านทำเล็บ ร้านตัดผม คลินิกเล็ก',
    setup: 'เปิดลิงก์บนแท็บเล็ตที่มีอยู่ ไม่ต้องซื้ออะไรเพิ่ม',
    tags: ['วางบนเคาน์เตอร์', 'เริ่มได้วันนี้'],
  },
];

const packages = [
  {
    id: 'software',
    tag: 'เริ่มได้เลย',
    title: 'ใช้กับจอที่มีอยู่แล้ว',
    desc: 'เปิดลิงก์บน Smart TV, Chromecast หรือแท็บเล็ตของร้าน ไม่ต้องซื้อจอใหม่',
    bullets: ['ระบบจองคิว + จอแสดงคิว', 'ตั้งค่าเทมเพลตและสีเอง', 'อัปเดตคิวแบบเรียลไทม์'],
    cta: { label: 'เริ่มใช้ฟรี', href: '/register', external: false },
    featured: false,
  },
  {
    id: 'tv-bundle',
    tag: 'ยอดนิยม',
    title: 'ระบบ + จอ Smart TV พร้อมติดตั้ง',
    desc: 'เราจัดจอ TV กล่องเล่นสัญญาณ และขาแขวนให้ครบชุด ติดตั้งและตั้งค่าถึงหน้าร้าน',
    bullets: ['จอ 43" – 65" เลือกขนาดได้', 'กล่อง Android ตั้งค่าเปิดจอคิวอัตโนมัติ', 'ติดตั้ง + อบรมทีมงานถึงที่'],
    cta: { label: 'ขอใบเสนอราคา', href: lineFriendUrl, external: true },
    featured: true,
  },
  {
    id: 'kiosk-bundle',
    tag: 'หน้าร้านพรีเมียม',
    title: 'ระบบ + ป้าย Digital Signage ตั้งพื้น',
    desc: 'ป้ายแนวตั้งตั้งพื้นแบบเดียวกับห้างและคลินิก โชว์คิวพร้อมสื่อโฆษณาของร้าน',
    bullets: ['จอแนวตั้ง 43" – 55" ตัวเครื่องพร้อมล้อ', 'เทมเพลตแนวตั้งโดยเฉพาะ', 'ดูแลหลังการขาย + Warranty'],
    cta: { label: 'ขอใบเสนอราคา', href: lineFriendUrl, external: true },
    featured: false,
  },
];

const services = [
  { icon: LocalShippingRoundedIcon, label: 'จัดส่งทั่วประเทศ' },
  { icon: HandymanRoundedIcon, label: 'ติดตั้งถึงหน้าร้าน (กทม. และปริมณฑล)' },
  { icon: SupportAgentRoundedIcon, label: 'ทีมไทยดูแลหลังการขาย' },
];

/**
 * Landing section that sells the queue display as a package: the software
 * running on a mock TV, the hardware form factors it fits, and bundle options.
 * Uses only static mock data, no network.
 */
export function DigitalSignageShowcase() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);
  const preset = SIGNAGE_SHOWCASE_PRESETS[index] ?? SIGNAGE_SHOWCASE_PRESETS[0];
  const config = useMemo(() => presetConfig(preset), [preset]);

  const tvConfig = useMemo(() => presetConfig({ template: 'spotlight', theme: 'restaurant' }), []);
  const kioskConfig = useMemo(() => presetConfig({ template: 'counter', theme: 'clinic' }, { layout: 'portrait' }), []);
  const tabletConfig = useMemo(() => presetConfig({ template: 'minimal', theme: 'light' }, { announcement_text: null }), []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduceMotion(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => setVisible(entries[0]?.isIntersecting ?? false), { threshold: 0.15 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (paused || !visible || reduceMotion) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % SIGNAGE_SHOWCASE_PRESETS.length), ROTATE_MS);
    return () => clearInterval(timer);
  }, [paused, visible, reduceMotion, index]);

  return (
    <section className={styles.signageSection} id="signage" data-signage-section ref={sectionRef}>
      <div className={styles.container}>
        <div className={styles.signageGrid}>
          <div className={styles.signageCopy}>
            <p className={styles.sectionNumber} data-signage-copy>04 / จอเรียกคิว และ Digital Signage</p>
            <h2 data-signage-copy>
              <span>ระบบคิว + จอหน้าร้าน</span>
              <span>จบในชุดเดียว</span>
            </h2>
            <p data-signage-copy>
              ไม่ใช่แค่ซอฟต์แวร์ เราจัดให้ครบทั้งจอ Smart TV ป้าย Digital Signage ตั้งพื้น หรือใช้กับจอที่ร้านมีอยู่แล้วก็ได้
              ลูกค้าเห็นคิวที่กำลังเรียกชัดเจน ร้านดูเป็นมืออาชีพตั้งแต่วันแรก
            </p>
            <div className={styles.signageActions} data-signage-copy>
              <Link href="/register" className={styles.primaryButton}>เริ่มใช้ฟรี <ArrowOutwardRoundedIcon /></Link>
              <a href={lineFriendUrl} className={styles.signageSecondary} target="_blank" rel="noopener noreferrer">
                <ChatBubbleOutlineRoundedIcon /> ขอใบเสนอราคาจอ + ระบบ
              </a>
            </div>
            <span className={styles.signageSettings} data-signage-copy>
              <SettingsRoundedIcon /> ตั้งค่าเทมเพลตได้เองในเมนู จอแสดงคิว ไม่ต้องติดตั้งแอปเพิ่ม
            </span>
            <div className={styles.signageChips}>
              {signageChips.map((chip) => (
                <span key={chip.number} data-signage-chip><i>{chip.number}</i>{chip.label}</span>
              ))}
            </div>
          </div>

          <div
            className={styles.signageVisual}
            data-signage-tv
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
          >
            <div className={styles.signageTvFrame} aria-label={`ตัวอย่างจอเรียกคิวสำหรับ${preset.label_th}`}>
              <div className={styles.signageTvScreen}>
                <div key={preset.id} className={styles.signageTvFade}>
                  <SignageBoard data={preset.data} config={config} mode="thumbnail" clockOverride="10:42:08" />
                </div>
              </div>
              <span className={styles.signageLive}><i /> LIVE</span>
            </div>
            <div className={styles.signageTvStand} aria-hidden="true" />
            <div className={styles.signageTabs} role="tablist" aria-label="เลือกประเภทธุรกิจ">
              {SIGNAGE_SHOWCASE_PRESETS.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  className={i === index ? styles.signageTabActive : ''}
                  onClick={() => setIndex(i)}
                >
                  <TvRoundedIcon /> {p.label_th}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.signageDevicesIntro} data-signage-devices-intro>
          <p className={styles.sectionNumber}>จอเรียกคิว คืออะไร</p>
          <h3>จอหน้าร้านที่โชว์เลขคิว ลูกค้านั่งรอแล้วเห็นเอง</h3>
          <p className={styles.signageDevicesLead}>
            แบบเดียวกับจอในธนาคาร โรงพยาบาล หรือร้านชานม เลขคิวที่กำลังเรียกขึ้นตัวใหญ่บนจอ
            ลูกค้าไม่ต้องเดินมาถาม พนักงานไม่ต้องตะโกน เลือกจอได้ 3 แบบตามพื้นที่หน้าร้านของคุณ
          </p>
        </div>

        <div className={styles.signageDevices}>
          {/* Scene 1: TV mounted on a wall */}
          <article className={styles.signageDevice} data-signage-device>
            <div className={styles.deviceScene} aria-label="ภาพจำลอง Smart TV แขวนผนัง">
              <SceneTags tags={devices[0].tags} />
              <div className={styles.sceneFloor} aria-hidden="true" />
              <div className={styles.sceneSkirting} aria-hidden="true" />
              <div className={styles.sceneTvWrap}>
                <div className={styles.sceneTvGlow} aria-hidden="true" />
                <div className={styles.sceneTvBracket} aria-hidden="true" />
                <div className={styles.sceneTv}>
                  <div className={styles.deviceScreenLandscape}>
                    <SignageBoard data={MOCK_SIGNAGE_RESTAURANT} config={tvConfig} mode="thumbnail" clockOverride="12:08:41" />
                  </div>
                  <i className={styles.sceneTvLed} aria-hidden="true" />
                </div>
              </div>
            </div>
            <DeviceCaption {...devices[0]} />
          </article>

          {/* Scene 2: floor-standing kiosk with a height marker */}
          <article className={styles.signageDevice} data-signage-device>
            <div className={styles.deviceScene} aria-label="ภาพจำลองป้าย Digital Signage ตั้งพื้น สูงประมาณ 1.8 เมตร">
              <SceneTags tags={devices[1].tags} />
              <div className={styles.sceneFloor} aria-hidden="true" />
              <div className={styles.sceneSkirting} aria-hidden="true" />
              <div className={styles.sceneKioskShadow} aria-hidden="true" />
              <div className={styles.sceneKiosk}>
                <div className={styles.deviceScreenPortrait}>
                  <SignageBoard data={MOCK_SIGNAGE_CLINIC} config={kioskConfig} mode="thumbnail" clockOverride="09:15:22" />
                </div>
                <div className={styles.sceneKioskChin} aria-hidden="true"><span>Q</span></div>
                <div className={styles.sceneKioskBase} aria-hidden="true"><i /><i /></div>
              </div>
              <div className={styles.sceneRuler} aria-hidden="true"><span>1.8 ม.</span></div>
            </div>
            <DeviceCaption {...devices[1]} />
          </article>

          {/* Scene 3: tablet on a reception counter */}
          <article className={styles.signageDevice} data-signage-device>
            <div className={styles.deviceScene} aria-label="ภาพจำลองแท็บเล็ตวางบนเคาน์เตอร์">
              <SceneTags tags={devices[2].tags} />
              <div className={styles.sceneFloor} aria-hidden="true" />
              <div className={styles.sceneCounter} aria-hidden="true"><i /></div>
              <div className={styles.sceneTablet}>
                <div className={styles.deviceScreenLandscape}>
                  <SignageBoard data={MOCK_SIGNAGE_NAIL} config={tabletConfig} mode="thumbnail" clockOverride="14:30:05" />
                </div>
              </div>
              <div className={styles.sceneTabletStand} aria-hidden="true" />
              <div className={styles.scenePlant} aria-hidden="true"><i /><i /><i /><b /></div>
            </div>
            <DeviceCaption {...devices[2]} />
          </article>
        </div>

        
      </div>
    </section>
  );
}

/** Floating callout pills over a device scene (e.g. "แขวนผนังระดับสายตา"). */
function SceneTags({ tags }: { tags: string[] }) {
  return (
    <div className={styles.sceneTags}>
      {tags.map((tag) => (
        <span key={tag}><i /> {tag}</span>
      ))}
    </div>
  );
}

/** Name, size chip, plain-language description and the two "where / how" rows under a scene. */
function DeviceCaption({ kind, size, desc, seenAt, setup }: { kind: string; size: string; desc: string; seenAt: string; setup: string }) {
  return (
    <div className={styles.deviceCaption}>
      <div>
        <strong>{kind}</strong>
        <span>{size}</span>
      </div>
      <p>{desc}</p>
      <dl className={styles.deviceFacts}>
        <div>
          <dt><StorefrontRoundedIcon /> เห็นได้ที่</dt>
          <dd>{seenAt}</dd>
        </div>
        <div>
          <dt><PowerRoundedIcon /> ติดตั้ง</dt>
          <dd>{setup}</dd>
        </div>
      </dl>
    </div>
  );
}
