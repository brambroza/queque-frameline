'use client';

import type { SignageTemplateProps } from '../template-props';
import { AnnouncementTicker, BoardHeader, HeroNumber, QrPanel } from '../parts';
import styles from '../signage-board.module.css';

/**
 * Spotlight: one giant centred number with a glow, next queues as a rail along
 * the bottom. Built for restaurants where the number must be readable across the room.
 */
export function SpotlightTemplate({ data, config, mode, labels, clock, dateLabel }: SignageTemplateProps) {
  const hero = data.now_calling[0] ?? null;
  const alsoCalling = data.now_calling.slice(1, 4);
  const rail = data.next_queue.slice(0, mode === 'thumbnail' ? 4 : config.layout === 'portrait' ? 6 : 5);

  return (
    <>
      <BoardHeader data={data} config={config} clock={clock} dateLabel={dateLabel} />
      <div className={styles.body}>
        <div className={styles.spotlightBody}>
          <section className={styles.spotlightCenter}>
            <div className={styles.spotlightGlow} aria-hidden="true" />
            <span className={`${styles.label} ${styles.labelAccent}`}>{labels.now_calling}</span>
            {hero ? (
              <>
                <HeroNumber value={hero.queue_number} xl pulse={mode === 'live'} />
                <div className={styles.chips} style={{ justifyContent: 'center', alignItems: 'center', marginTop: 'calc(var(--sg-unit) * 0.8)' }}>
                  {hero.resource_name ? (
                    <span className={styles.proceed} style={{ marginTop: 0 }}>
                      {labels.please_proceed} {hero.resource_name}
                    </span>
                  ) : null}
                  {alsoCalling.map((p) => (
                    <span key={p.id} className={`${styles.chip} ${styles.chipAccent}`}>
                      {p.queue_number}
                      {p.resource_name ? <span className={styles.chipMuted}>{p.resource_name}</span> : null}
                    </span>
                  ))}
                </div>
                {hero.customer_name || hero.service_name ? (
                  <div className={styles.heroMeta}>{[hero.customer_name, hero.service_name].filter(Boolean).join(' • ')}</div>
                ) : null}
              </>
            ) : (
              <div className={styles.empty}>{labels.empty_calling}</div>
            )}
          </section>

          <section className={styles.spotlightFooter}>
            <div>
              <div className={styles.labelRow}>
                <span className={styles.label}>{labels.next_queue}</span>
                <span className={styles.label}>
                  {labels.waiting_count} {Math.max(0, data.totals.waiting - rail.length)}
                </span>
              </div>
              {rail.length === 0 ? (
                <div className={styles.empty}>{labels.empty_next}</div>
              ) : (
                <div className={styles.spotlightRail}>
                  {rail.map((p) => (
                    <div key={p.id} className={styles.railItem}>
                      <div className={styles.railNo}>{p.queue_number}</div>
                      <div className={styles.railMeta}>{[p.start_time, p.service_name].filter(Boolean).join(' • ') || ' '}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {data.qr_url ? <QrPanel url={data.qr_url} mode={mode} labels={labels} /> : null}
          </section>
        </div>
      </div>
      <AnnouncementTicker text={config.announcement_text} />
    </>
  );
}
