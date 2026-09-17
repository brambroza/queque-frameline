import Link from 'next/link';
import { Brand, lineFriendUrl } from './landing-navbar';
import styles from './landing-page.module.css';

/**
 * Shared footer for every public page (/, /pricing, /blog, ...).
 * Wrapped in `navScope` so the landing design tokens (`--landing-*`) resolve
 * even on pages that are not inside the `.page` landing wrapper.
 */
export function LandingFooter() {
  return (
    <footer className={`${styles.navScope} ${styles.footer}`}>
      <div className={styles.container}>
        <div className={styles.footerTop}>
          <div><Brand /><p>ระบบจองคิวออนไลน์ผ่าน LINE<br />สำหรับธุรกิจบริการยุคใหม่</p></div>
          <div className={styles.footerLinks}>
            <div><strong>ผลิตภัณฑ์</strong><Link href="/use-cases">ตัวอย่างการใช้งาน</Link><Link href="/pricing">ราคา</Link><Link href="/sandbox-demo">ระบบตัวอย่าง</Link><Link href="/features/promptpay-payment">รับมัดจำ PromptPay</Link></div>
            <div><strong>โซลูชัน</strong><Link href="/solutions/restaurant-booking-system">ระบบจองร้านอาหาร</Link><Link href="/solutions/barbershop-booking-system">ระบบจองร้านตัดผม</Link><Link href="/solutions/clinic-booking-system">ระบบจองคลินิก</Link><Link href="/solutions/badminton-court-booking-system">ระบบจองสนามแบด</Link><Link href="/solutions/tennis-court-booking-system">ระบบจองสนามเทนนิส</Link><Link href="/solutions/bb-gun-field-booking-system">ระบบจองสนาม BB Gun</Link></div>
            <div><strong>เรียนรู้</strong><Link href="/blog">บทความ</Link><Link href="/contact">ติดต่อเรา</Link><Link href="/privacy">นโยบายความเป็นส่วนตัว</Link><Link href="/terms">ข้อกำหนดการใช้บริการ</Link></div>
            <div><strong>ติดต่อ</strong><a href="mailto:amnart.gl@gmail.com">amnart.gl@gmail.com</a><a href="tel:+66856083298">085-608-3298</a><a href={lineFriendUrl} target="_blank" rel="noopener noreferrer">LINE OA: @queuebooking</a></div>
          </div>
        </div>
        <div className={styles.footerBottom}><span>© {new Date().getFullYear()} QueueBooking by GO Along Co., Ltd.</span><span>Made for better service experiences.</span></div>
      </div>
    </footer>
  );
}
