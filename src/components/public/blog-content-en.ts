import type { BlogPost } from '@/components/public/blog-content';

export const blogPostsEn: BlogPost[] = [
  {
    slug: 'badminton-court-booking-via-line',
    title: 'Badminton Court Booking via LINE: Let Players Book Courts Themselves',
    description: 'How to set up hourly badminton court booking on LINE OA so players see free courts, book, and pay a deposit without messaging staff.',
    category: 'Sports & Venues',
    publishedAt: '2026-09-15',
    readingMinutes: 6,
    keywords: ['badminton court booking', 'line court booking', 'sports venue booking system'],
    sections: [
      {
        heading: 'Many Courts, Hundreds of Hourly Slots, One Chat Inbox',
        body: [
          'A badminton hall runs 4 to 12 courts from morning to late night, so staff manage hundreds of hourly slots a day.',
          'When bookings still come through LINE chat and a paper book, every "is a court free?" question means opening the schedule again.',
          'Weekday evenings and weekends are peak, which is exactly when replies slow down and double bookings happen.',
        ],
      },
      {
        heading: 'Core Pains: Double-Booked Courts, No-Shows, Slow Replies',
        body: [
          'Double bookings: LINE, phone, and walk-in bookings are written down separately and collide on the same court and hour.',
          'No-shows: verbal bookings without a deposit leave a court empty after other players were turned away.',
          'Slow replies: the front desk sells shuttlecocks, takes payments, and answers chat at the same time.',
          'Regular groups need the same court every week and are easy to lose in a paper schedule.',
        ],
      },
      {
        heading: 'How LINE Court Booking Works',
        body: [
          'Each court becomes a resource with opening hours and hourly or half-hourly slots.',
          'Players open the venue LINE OA, pick a date and hour, and immediately see which courts are free or full.',
          'A PromptPay deposit can be required at booking time; the court is locked once payment succeeds.',
          'Confirmation and reminder messages go out automatically, while staff see the whole day on one dashboard.',
        ],
      },
      {
        heading: 'Recommended Flow',
        body: [
          'Open LINE OA > Book court > choose date and hour > choose court > pay deposit > receive confirmation with court number and time.',
          'Staff create recurring bookings for regular groups from the back office so the court never shows as free to others.',
          'Check-in and completion update the schedule in real time.',
        ],
      },
      {
        heading: 'Results',
        body: [
          'Far fewer availability questions in chat, no more double-booked courts, and lower no-show rates with deposits.',
          'Reports show which courts and hours are busiest, which helps set peak pricing.',
        ],
      },
    ],
  },
  {
    slug: 'tennis-court-booking-via-line',
    title: 'Tennis Court Booking via LINE: Courts, Coaches, and Classes in One System',
    description: 'A practical guide to running tennis court rental, private coaching, and group classes through LINE OA with deposits and automatic reminders.',
    category: 'Sports & Venues',
    publishedAt: '2026-09-15',
    readingMinutes: 6,
    keywords: ['tennis court booking', 'tennis coach booking', 'line booking sports club'],
    sections: [
      {
        heading: 'A Tennis Club Sells Coach Time, Not Just Courts',
        body: [
          'Court rental, group classes, and private coaching all live in one venue but use different resources.',
          'Coach bookings must check both court and coach availability at the same time, which paper schedules cannot do reliably.',
          'Most members play the same slot every week, so one scheduling mistake damages long-term trust.',
        ],
      },
      {
        heading: 'Core Pains: Rain, Coach Conflicts, No-Shows',
        body: [
          'Rain forces bulk reschedules on outdoor courts and notifying everyone one by one is slow.',
          'A coach gets booked on two courts at once, or the court a coach needs is rented to someone else.',
          'Evening court bookings without deposits are abandoned after other members were turned away.',
        ],
      },
      {
        heading: 'How LINE Booking Helps',
        body: [
          'Courts and coaches are separate resources; each coach is linked to the services they teach.',
          'Members choose court rental, coaching, or a class in LINE and only see slots where both court and coach are free.',
          'Group classes have a capacity per session and show as full automatically.',
          'When rain hits, staff move bookings from the back office and every member gets a LINE message with an acknowledge button.',
        ],
      },
      {
        heading: 'Recommended Flow',
        body: [
          'Open LINE OA > choose type (court / coach / class) > pick date and time > pick court or coach > pay deposit > receive confirmation.',
          'Long coaching courses and regular groups are created in bulk from the back office, locking court and coach for the whole course.',
        ],
      },
      {
        heading: 'Results',
        body: [
          'No court or coach conflicts, rain reschedules done in minutes, and reports that show which coaches and courts are under-used.',
        ],
      },
    ],
  },
  {
    slug: 'bb-gun-field-booking-via-line',
    title: 'BB Gun Field Booking via LINE: Book Game Rounds, Teams, and Rental Gear',
    description: 'How BB gun and airsoft fields take round-based team bookings on LINE OA with player counts, rental gear, and deposits to avoid empty rounds.',
    category: 'Sports & Venues',
    publishedAt: '2026-09-15',
    readingMinutes: 5,
    keywords: ['bb gun field booking', 'airsoft field booking', 'line booking game rounds'],
    sections: [
      {
        heading: 'Fields Sell Rounds, Not Hours',
        body: [
          'BB gun and airsoft fields run rounds of 2 to 3 hours with a minimum and maximum player count, mostly on weekends.',
          'Teams of 5 to 20 arrive together and need rental guns, safety gear, and ammo prepared in advance.',
          'Chat-only bookings lose player counts and gear requests, and staff repeat "this round is full" all day.',
        ],
      },
      {
        heading: 'Core Pains: Overbooked Rounds, Unprepared Gear, Missing Teams',
        body: [
          'Two teams book the same round beyond field capacity and have to negotiate on the day.',
          'Staff do not know how many rental sets to prepare, so players wait before entering the field.',
          'Weekend rounds are booked and then abandoned while other teams were turned away.',
        ],
      },
      {
        heading: 'How LINE Round Booking Helps',
        body: [
          'Each round is a capacity-based service; once bookings reach the player limit the round shows as full.',
          'Team leaders book in LINE, enter player count, and add rental gear as extra services that appear on the dashboard.',
          'A PromptPay deposit per team confirms the round and cuts no-shows.',
          'Confirmation messages carry field rules, map, and check-in time, with a reminder before game day.',
        ],
      },
      {
        heading: 'Recommended Flow',
        body: [
          'Open LINE OA > Book a round > pick date and round > enter player count > choose rental gear > pay deposit > receive confirmation.',
          'Staff see per-round totals the night before: teams, players, guns, and safety sets to prepare.',
          'Corporate team-building groups get a private round created from the back office that no other team can book.',
        ],
      },
      {
        heading: 'Results',
        body: [
          'Rounds stay within capacity, gear is ready on time, deposits keep teams committed, and reports show which rounds sell best.',
        ],
      },
    ],
  },
  {
    slug: 'line-table-booking',
    title: 'LINE Table Booking System for Restaurants: Faster Reservations, Fewer Collisions',
    description: 'Build a LINE-based restaurant table booking flow that reduces phone calls, prevents table collisions, and helps teams respond faster.',
    category: 'Queue Operations',
    publishedAt: '2026-05-21',
    readingMinutes: 7,
    keywords: ['book table via line', 'restaurant table booking system', 'line booking restaurant'],
    sections: [
      {
        heading: 'Why manual reservations break during peak hours',
        body: [
          'Many restaurants still rely on phone reservations and manual chat handling.',
          'When demand spikes, teams miss details, respond slowly, and lose customers before arrival.',
          'The more branches, seat zones, and peak windows you have, the higher the risk of booking errors.',
        ],
      },
      {
        heading: 'Common pain points: phone booking, table collisions, slow admin response',
        body: [
          'Phone booking creates fragmented data and repeated confirmation work.',
          'Table collisions happen when reservations are tracked across multiple channels manually.',
          'Admins get overloaded with repetitive availability questions and cannot respond in time.',
        ],
      },
      {
        heading: 'How LINE table booking solves this structurally',
        body: [
          'Customers can check availability and reserve directly in LINE.',
          'The system validates capacity and timeslot conflicts automatically before confirmation.',
          'Each successful booking instantly notifies both customer and staff for smoother operations.',
        ],
      },
      {
        heading: 'Recommended line booking restaurant flow',
        body: [
          'Customer opens LINE OA > taps booking menu > selects branch, party size, date/time > confirms.',
          'System sends an immediate booking confirmation in chat.',
          'Staff sees new reservations in the dashboard in real time with clear statuses.',
        ],
      },
      {
        heading: 'Business outcomes restaurants should track',
        body: [
          'Lower repeated phone traffic during peak periods.',
          'Fewer booking collisions and better table utilization.',
          'Faster response time and stronger customer experience before arrival.',
        ],
      },
    ],
  },
  {
    slug: 'barber-shop-line-queue-booking-customer-and-owner-flow',
    title: 'Barber Shop Queue Booking Flow: Customer Side and Owner Side',
    description: 'A practical barber-shop flow from LIFF booking (service + barber selection) to back-office notifications, calendar, and digital signage.',
    category: 'Use Case',
    publishedAt: '2026-05-16',
    readingMinutes: 8,
    keywords: ['barber shop', 'line liff booking', 'queue notification', 'digital signage', 'calendar queue'],
    sections: [
      {
        heading: 'Overview: One flow for customers and staff',
        body: [
          'A good setup should connect LINE customer booking and staff operations in one system.',
          'Customer flow: choose service > choose barber > choose date/time > confirm.',
          'Owner/staff flow: instant booking notification, calendar visibility, and a live queue display for in-store operations.',
        ],
      },
      {
        heading: 'Customer flow (LINE + LIFF)',
        body: [
          'Customers tap “Book Queue” from rich menu and open LIFF directly inside LINE.',
          'Step 1 allows selecting both service and barber in a single screen.',
          'Label can be business-specific: “Choose Barber” (barber/nail), “Choose Table” (restaurant), “Choose Room” (meeting room).',
          'Step 2 lets customers pick date and available time slots before final confirmation.',
          'After success, a booking confirmation card is sent back into LINE chat with queue number and appointment details.',
        ],
      },
      {
        heading: 'Owner/staff flow (Portal Dashboard)',
        body: [
          'Each new booking creates a back-office notification so staff can react immediately.',
          'Calendar view helps the team see daily/monthly booking distribution and peak windows.',
          'Daily queue list separates statuses clearly (confirmed, completed, cancelled).',
          'Digital signage shows now-calling and next queue to reduce manual queue shouting at the shop.',
        ],
      },
      {
        heading: 'Recommended setup for barber shops',
        body: [
          'Separate services by real operations (e.g., haircut, haircut+wash, coloring) with correct duration.',
          'Create each barber as a resource so customers can choose a specific person and avoid collisions.',
          'Configure working hours and holidays per branch to ensure accurate slot availability.',
          'Keep notification bell and queue signage active during opening hours for faster front-desk operation.',
        ],
      },
      {
        heading: 'Go-live checklist',
        body: [
          'Complete one full booking test from real LINE mobile.',
          'Verify notification appears and booking lands in calendar/booking list.',
          'Verify queue display reflects now-calling and next queue correctly.',
          'Once all checks pass, the shop can go live with the same tested flow.',
        ],
      },
    ],
  },
  {
    slug: 'line-msgapi-liff-login-richmenu-setup-guide',
    title: 'Production Setup Guide: LINE Messaging API + LIFF + LINE Login + Rich Menu',
    description: 'Step-by-step setup for LINE queue booking: webhook, access token, booking/member LIFF apps, LINE Login, and rich menu links.',
    category: 'Setup Guide',
    publishedAt: '2026-05-14',
    readingMinutes: 10,
    keywords: ['line messaging api', 'liff setup', 'line login setup', 'rich menu setup', 'line webhook'],
    assets: {
      pdfUrl: '/docs/line-setup-guide.pdf',
      pdfLabel: 'Download LINE setup guide (PDF)',
      images: [
        {
          src: '/images/blog/line-setup/step-webhook-msgapi.jpg',
          alt: 'LINE Messaging API Webhook settings',
          caption: 'Messaging API and webhook URL setup example',
        },
        {
          src: '/images/blog/line-setup/step-liff-booking.jpg',
          alt: 'LIFF booking app settings',
          caption: 'LIFF app for booking page (/liff/{shopKey})',
        },
        {
          src: '/images/blog/line-setup/step-liff-member.jpg',
          alt: 'LIFF member app settings',
          caption: 'LIFF app for member page (/liff/{shopKey}/member)',
        },
        {
          src: '/images/blog/line-setup/step-richmenu-links.jpg',
          alt: 'Rich menu links for booking and member',
          caption: 'Rich menu with 2 links: Booking and Member',
        },
      ],
    },
    sections: [
      {
        heading: '1) Prepare system values first',
        body: [
          'Prepare your production domain, for example: https://queuebooking.com, and each shop key (e.g., SHOP-TTLS2P).',
          'Confirm required endpoints exist: /api/line/webhook/{shopKey}, /liff/{shopKey}, /liff/{shopKey}/member.',
          'Use 2 LIFF apps: one for booking flow and one for member profile/history flow.',
        ],
      },
      {
        heading: '2) Configure Messaging API and Webhook',
        body: [
          'Open LINE Developers > your OA channel > Messaging API, then copy Channel access token (long-lived) and Channel secret to your system.',
          'Set Webhook URL to https://queuebooking.com/api/line/webhook/{shopKey}.',
          'Enable Use webhook and click Verify.',
          'Disable conflicting OA auto-replies so your system controls responses.',
        ],
      },
      {
        heading: '3) Configure LIFF for Booking',
        body: [
          'Create LIFF app (e.g., queuebooking), Size = Full.',
          'Set Endpoint URL to https://queuebooking.com/liff/{shopKey}.',
          'Recommended scopes: openid, profile, chat_message.write.',
          'Save LIFF ID into your booking LIFF setting / NEXT_PUBLIC_LIFF_BOOKING_ID.',
        ],
      },
      {
        heading: '4) Configure LIFF for Member page',
        body: [
          'Create a second LIFF app (e.g., queuemember), Size = Full.',
          'Set Endpoint URL to https://queuebooking.com/liff/{shopKey}/member.',
          'Use the same scopes if needed (openid, profile, chat_message.write).',
          'Save LIFF ID into member LIFF setting / NEXT_PUBLIC_LIFF_MEMBER_ID.',
        ],
      },
      {
        heading: '5) Configure LINE Login (if using separate channel)',
        body: [
          'If you use a dedicated login channel, configure callback URL on your production domain.',
          'LIFF can be your main login flow; use LINE Login channel only where needed.',
          'Do not mix LIFF IDs across channels without updating endpoint/env values.',
        ],
      },
      {
        heading: '6) Configure Rich Menu links',
        body: [
          'Button 1 (Booking): https://liff.line.me/{LIFF_BOOKING_ID}.',
          'Button 2 (Member): https://liff.line.me/{LIFF_MEMBER_ID}.',
          'Publish and assign the rich menu to your OA.',
          'Test both buttons from LINE mobile app and verify correct destination pages.',
        ],
      },
      {
        heading: '7) Invalid LIFF ID checklist',
        body: [
          'LIFF ID in DB/env must match the exact LIFF app configured in LINE Developers.',
          'Endpoint path must match exactly: booking /liff/{shopKey}, member /liff/{shopKey}/member.',
          'Use HTTPS and production domain consistently.',
          'After env updates on Vercel, redeploy before testing again.',
        ],
      },
      {
        heading: '8) End-to-end verification',
        body: [
          'User taps rich menu > books queue > receives confirmation in LINE.',
          'Booking should appear in portal dashboard immediately.',
          'User taps member menu and can view profile plus booking history.',
        ],
      },
    ],
  },
  {
    slug: 'line-oa-queue-booking-for-business',
    title: 'What Is LINE OA Queue Booking and Which Businesses Benefit Most?',
    description: 'A practical overview of LINE OA queue booking, LIFF flows, and dashboard operations for service businesses.',
    category: 'Queue Booking Basics',
    publishedAt: '2026-05-10',
    readingMinutes: 6,
    keywords: ['line oa queue booking', 'liff booking', 'queue management'],
    sections: [
      {
        heading: 'Why Service Businesses Need Queue Booking',
        body: [
          'Manual queue handling via chat or notebooks causes duplicate bookings, slow responses, and low visibility.',
          'A LINE-integrated queue system lets customers book instantly while staff manages all queues in one dashboard.',
        ],
      },
      {
        heading: 'Core Components',
        body: [
          'Customer side: ask available slots on LINE and book via LIFF.',
          'Business side: manage branches, services, working hours, and queue statuses.',
        ],
      },
      {
        heading: 'Best-fit Industries',
        body: [
          'Barbers, clinics, restaurants, service centers, and appointment-heavy teams.',
          'Supports both fixed slot and flexible duration queue models.',
        ],
      },
    ],
  },
  {
    slug: 'reduce-no-show-with-line-reminder',
    title: 'How to Reduce No-show with LINE Confirmations and Reminders',
    description: 'Design a queue confirmation and reminder flow in LINE to reduce no-show and improve slot utilization.',
    category: 'Queue Operations',
    publishedAt: '2026-05-10',
    readingMinutes: 5,
    keywords: ['reduce no-show', 'line reminder', 'appointment confirmation'],
    sections: [
      {
        heading: 'Common No-show Causes',
        body: [
          'Customers forget, plans change, or they miss confirmation messages.',
          'Without reminders, valuable service slots are lost.',
        ],
      },
      {
        heading: 'Recommended Flow',
        body: [
          'Send instant booking confirmation with queue number and appointment details.',
          'Send follow-up reminders (e.g., 1 day and 1 hour before service).',
        ],
      },
      {
        heading: 'KPIs to Track',
        body: [
          'No-show rate, cancellation rate, and confirmation response rate.',
          'Use these metrics to optimize peak slots and staffing plans.',
        ],
      },
    ],
  },
  {
    slug: 'how-to-setup-liff-booking-correctly',
    title: 'How to Set Up LIFF Correctly for Booking Pages',
    description: 'Checklist for LIFF setup: IDs, endpoint URLs, and separate LIFF apps for booking/member flows.',
    category: 'Setup Guide',
    publishedAt: '2026-05-10',
    readingMinutes: 7,
    keywords: ['liff setup', 'invalid liff id', 'line liff booking'],
    sections: [
      {
        heading: 'Basic LIFF Setup',
        body: [
          'Ensure endpoint URLs match your production domain exactly.',
          'Validate whether the flow is opened from LINE app or browser as designed.',
        ],
      },
      {
        heading: 'Separate LIFF Apps by Use Case',
        body: [
          'Booking and member pages can use different LIFF IDs.',
          'Use separate env vars such as NEXT_PUBLIC_LIFF_BOOKING_ID and NEXT_PUBLIC_LIFF_MEMBER_ID.',
        ],
      },
      {
        heading: 'Debugging Invalid LIFF ID',
        body: [
          'Verify LIFF ID in DB/ENV against the actual deployed LIFF app.',
          'Verify rich menu URL format: https://liff.line.me/{LIFF_ID}?shop_key=...',
        ],
      },
    ],
  },
  {
    slug: 'rich-menu-builder-by-business-type',
    title: 'New: Build a Rich Menu That Fits Your Business in 5 Minutes, No Image Editor Needed',
    description: 'Pick your business type and the system lays out buttons, icons, Thai labels and colors, then publishes straight to your LINE OA. Example: a fitness studio with a 2-cell menu.',
    category: 'Setup Guide',
    publishedAt: '2026-09-15',
    readingMinutes: 6,
    keywords: ['line oa rich menu', 'rich menu builder', 'fitness rich menu', 'line booking menu'],
    sections: [
      {
        heading: 'Why this tool exists',
        body: [
          'The Rich Menu is the button panel under a LINE OA chat and the main way customers tap “Book”. Building one by hand means designing a 2500×1686 or 2500×843 image, aligning tappable areas to it, and wiring each link in LINE OA Manager.',
          'Most shops stall right there: they have a LINE OA and a booking system, but customers still type “how do I book?”.',
          'The new Rich Menu page in the Portal does it in one screen: choose a business type, get buttons, icons, labels and colors from a master template, tweak anything, and publish to LINE without uploading an image yourself.',
        ],
      },
      {
        heading: 'What the system does for you',
        body: [
          '12 business templates: salon, nail, clinic, restaurant, buffet, fitness, meeting room, auto repair, mobile repair, field service, government office, and consulting. Each ships with the buttons that business actually uses.',
          '5 layouts: hero + 3, 6 cells, 4 cells, 3 cells (half height) and 2 cells (half height). Switching layouts refits your existing buttons automatically.',
          'Each cell can open the booking LIFF, open the member/queue page, open an external link (e.g. Google Maps), or send a chat message (e.g. “Contact us”).',
          'The image is rendered at the exact size LINE requires, converted to JPEG if it exceeds 1 MB, and the tappable areas are derived from the same cell data as the picture, so taps never land on the wrong button.',
          'Preview on a simulated phone before publishing, or download the PNG if you prefer to upload it through LINE OA Manager yourself.',
        ],
      },
      {
        heading: 'Example: a fitness studio that wants just 2 buttons',
        body: [
          'Say “Strong Fit Studio” runs yoga and weight-training classes. They want customers to book a class in one tap plus a contact button, and nothing else.',
          'Step 1 Your business: the system pre-selects “Fitness / classes” from the registration data. The fitness template arrives as 6 cells (Book class, Member, Schedule, Promotions, Map, Contact).',
          'Step 2 Layout: pick “2 cells (half height)”, 2500×843. The first two buttons, “Book class” and “Member”, are kept. A half-height menu leaves more room for chat, good for studios whose customers message often.',
          'Step 3 Style and color: choose Bold and enter the brand color, e.g. #202939 (deep navy), or pick from the suggested swatches.',
          'Step 4 Buttons and links: keep cell 1 as “Book class” with the dumbbell icon and action “Open booking LIFF”. Change cell 2 to “Contact trainer”, chat icon, action “Send message to shop” with the text “Contact trainer”. When a customer taps it, the message lands in your Chat Inbox immediately.',
          'Step 5 Save and publish: press “Save settings”, then “Save image”, then “Publish to LINE”. The system asks once for confirmation, and within seconds every follower sees the new menu.',
        ],
      },
      {
        heading: 'What you need before publishing',
        body: [
          'A Channel Access Token for the LINE OA saved under LINE Settings. Without it the publish button explains what is missing, but you can still download the image.',
          'The booking LIFF ID saved under LINE Settings. Both the bare ID and a full https://liff.line.me/... link pasted from the LINE console are accepted.',
          'No separate member LIFF yet? The “Member” button opens the booking LIFF on its “My queue” tab automatically.',
          'The order is Save settings → Save image → Publish. With unsaved edits the publish button stays disabled and tells you why.',
        ],
      },
      {
        heading: 'Good to know',
        body: [
          'Menus published through the system do not appear in LINE OA Manager’s Rich Menu page because they are created via the API. The Portal shows the menu id, publish date, and an “Unpublish” button instead.',
          'Republish as often as you like. The previous menu created by the system is replaced automatically; customers do nothing.',
          'If you set a Rich Menu in LINE OA Manager earlier, the system menu becomes the default instead. Disable the old one there to avoid confusion.',
          'Shops that published before 15 September 2026 should republish once to receive the new booking-button link format that identifies the shop explicitly.',
        ],
      },
      {
        heading: 'Summary',
        body: [
          'The Rich Menu is the front door of your LINE OA. When customers see “Book” the moment they open the chat, repetitive questions drop immediately.',
          'Open Rich Menu in the Portal, pick your business type and cell count, and publish. It takes under 5 minutes; message the team on LINE if anything gets stuck.',
        ],
      },
    ],
    assets: {
      images: [
        {
          src: '/images/blog/rich-menu-builder/overview-builder-page.png',
          alt: 'Rich Menu page in the Portal: steps 1-5 on the left, phone preview on the right, Fitness pre-selected',
          caption: 'The Rich Menu page on first open. Steps 1-5 run down the left; the phone preview on the right redraws on every change. “Fitness / classes” is pre-selected from registration data, so the 6-cell template loads first.',
        },
        {
          src: '/images/blog/rich-menu-builder/step-1-business-type.png',
          alt: 'Step 1 Your business: 12 business type cards with Fitness selected',
          caption: 'Step 1 Your business: 12 templates. Each card shows its default layout and style under the name. Switch any time; with unsaved edits the system asks before replacing them.',
        },
        {
          src: '/images/blog/rich-menu-builder/step-2-layout.png',
          alt: 'Step 2 Layout: 5 options with “2 cells (half height)” 2500×843 selected',
          caption: 'Step 2 Layout: pick “2 cells (half height)”. The first two template buttons (Book class, Member) are kept and the image size switches to 2500 × 843 automatically.',
        },
        {
          src: '/images/blog/rich-menu-builder/step-3-style-color.png',
          alt: 'Step 3 Style and color: Bold selected, color #202939, chat bar text',
          caption: 'Step 3 Style and color: Bold fills the whole menu with the brand color. Pick a suggested swatch or enter your own; this example uses #202939. The chat bar text is the label customers see on the menu toggle in chat.',
        },
        {
          src: '/images/blog/rich-menu-builder/step-4-buttons.png',
          alt: 'Step 4 Buttons and links: cell 1 Book class opens booking LIFF, cell 2 Contact trainer sends a message',
          caption: 'Step 4 Buttons and links: cell 1 stays “Book class” opening the booking LIFF. Cell 2 becomes “Contact trainer” with the chat icon and “Send message to shop”, so the tap lands in your Chat Inbox immediately.',
        },
        {
          src: '/images/blog/rich-menu-builder/step-5-save-publish.png',
          alt: 'Step 5 Save and publish: Save settings, Download PNG, Save image, Publish to LINE, plus published status box',
          caption: 'Step 5 Save and publish: the order is Save settings → Save image → Publish to LINE. After publishing, the status box shows the menu id, the publish time, and an Unpublish button.',
        },
        {
          src: '/images/blog/rich-menu-builder/confirm-publish-dialog.png',
          alt: 'Confirmation dialog before publishing the Rich Menu to LINE OA with an acknowledgement checkbox',
          caption: 'The confirmation before publishing: asked once, with a checkbox acknowledging that the previous system menu is replaced and that this menu will not appear in LINE OA Manager.',
        },
        {
          src: '/images/blog/rich-menu-builder/phone-preview-fitness.png',
          alt: 'Phone preview for Strong Fit Studio: 2-cell menu with Book class and Contact trainer',
          caption: 'Phone preview for Strong Fit Studio, drawn by the same renderer that produces the file sent to LINE. The chips show the image size, approximate PNG size, and cell count; anything over 1 MB is saved as JPEG.',
        },
        {
          src: '/images/blog/rich-menu-builder/rich-menu-image-export.png',
          alt: 'The generated 2500×843 Rich Menu image: Book class and Contact trainer on a navy background',
          caption: 'The menu image the system generates and sends to LINE (2500 × 843). Button positions in the picture and the tappable areas sent to LINE come from the same cell data. You can also download this file and upload it in LINE OA Manager yourself.',
        },
      ],
    },
  },
];

export function getBlogBySlugEn(slug: string) {
  return blogPostsEn.find((p) => p.slug === slug) ?? null;
}
