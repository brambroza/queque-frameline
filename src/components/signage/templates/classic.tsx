'use client';

import type { SignageTemplateProps } from '../template-props';
import { AnnouncementTicker, BoardHeader, HeroNumber, QrPanel, QueueList, StatTiles, WaitingChips } from '../parts';
import styles from '../signage-board.module.css';

/**
 * Classic: hero "now calling" card on the left, next-queue list on the right.
 * Portrait stacks the two. Safe default for any business.
 */
export function ClassicTemplate({ data, config, mode, labels, clock, dateLabel }: SignageTemplateProps) {
  const hero = data.now_calling[0] ?? null;
  const alsoCalling = data.now_calling.slice(1, 4);
  const listMax = mode === 'thumbnail' ? 3 : undefined;
  const heroMeta = hero ? [hero.service_name, hero.resource_name].filter(Boolean).join(' • ') : '';
  const showWaiting = config.waiting_queue_limit > 0 && (data.waiting_queue.length > 0 || data.totals.waiting > data.next_queue.length);

  return (
    <>
      <BoardHeader data={data} config={config} clock={clock} dateLabel={dateLabel} />
      <div className={styles.body}>
        <div className={styles.classicGrid}>
          <section className={`${styles.card} ${hero ? styles.cardAccent : ''}`}>
            <div className={styles.labelRow}>
              <span className={`${styles.label} ${styles.labelAccent}`}>{labels.now_calling}</span>
              {hero?.start_time ? <span className={styles.label}>{hero.start_time}</span> : null}
            </div>
            {hero ? (
              <div style={{ minHeight: 0 }}>
                <HeroNumber value={hero.queue_number} pulse={mode === 'live'} />
                {hero.customer_name ? <div className={styles.heroName}>{hero.customer_name}</div> : null}
                {heroMeta ? <div className={styles.heroMeta}>{heroMeta}</div> : null}
                <div className={styles.chips} style={{ alignItems: 'center', marginTop: 'calc(var(--sg-unit) * 1)' }}>
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
              </div>
            ) : (
              <div className={styles.empty}>{labels.empty_calling}</div>
            )}
            <div style={{ marginTop: 'auto', paddingTop: 'calc(var(--sg-unit) * 1.2)' }}>
              <StatTiles data={data} labels={labels} />
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.labelRow}>
              <span className={styles.label}>{labels.next_queue}</span>
              <span className={styles.label}>{data.next_queue.length}</span>
            </div>
            <QueueList items={data.next_queue} emptyText={labels.empty_next} max={listMax} />
            {showWaiting ? (
              <div className={styles.listFixed} style={{ paddingTop: 'calc(var(--sg-unit) * 1.2)' }}>
                <div className={styles.label} style={{ marginBottom: 'calc(var(--sg-unit) * 0.6)' }}>{labels.waiting}</div>
                <WaitingChips
                  items={mode === 'thumbnail' ? data.waiting_queue.slice(0, 4) : data.waiting_queue.slice(0, 8)}
                  labels={labels}
                  moreCount={Math.max(0, data.totals.waiting - data.next_queue.length - Math.min(data.waiting_queue.length, 8))}
                />
              </div>
            ) : null}
            {data.qr_url ? (
              <div className={styles.listFixed} style={{ paddingTop: 'calc(var(--sg-unit) * 1.2)' }}>
                <QrPanel url={data.qr_url} mode={mode} labels={labels} />
              </div>
            ) : null}
          </section>
        </div>
      </div>
      <AnnouncementTicker text={config.announcement_text} />
    </>
  );
}
