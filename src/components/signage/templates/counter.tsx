'use client';

import type { CSSProperties } from 'react';
import type { SignageTemplateProps } from '../template-props';
import { AnnouncementTicker, BoardHeader, QrPanel, QueueList, heroSize } from '../parts';
import styles from '../signage-board.module.css';

/**
 * Counter: one card per queue being called, titled by its resource (room, chair,
 * counter). Rooms with nothing assigned show "free". Waiting list on the side.
 */
export function CounterTemplate({ data, config, mode, labels, clock, dateLabel }: SignageTemplateProps) {
  const maxCards = mode === 'thumbnail' ? 3 : config.layout === 'portrait' ? 4 : 6;
  const cards = data.now_calling.slice(0, maxCards);
  const slots = Math.max(cards.length, mode === 'thumbnail' ? 3 : Math.min(maxCards, Math.max(2, cards.length)));
  const placeholders = Math.max(0, slots - cards.length);
  const cols = config.layout === 'portrait' ? 1 : slots <= 1 ? 1 : slots <= 4 ? 2 : 3;
  const gridStyle = { '--sg-cols': cols } as CSSProperties;

  return (
    <>
      <BoardHeader data={data} config={config} clock={clock} dateLabel={dateLabel} />
      <div className={styles.body}>
        <div className={styles.counterBody}>
          <section style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className={styles.labelRow}>
              <span className={`${styles.label} ${styles.labelAccent}`}>{labels.now_calling}</span>
              <span className={styles.label}>{data.totals.calling}</span>
            </div>
            {cards.length === 0 && placeholders === 0 ? (
              <div className={styles.empty}>{labels.empty_calling}</div>
            ) : (
              <div className={styles.counterGrid} style={gridStyle}>
                {cards.map((p, idx) => (
                  <article key={p.id} className={`${styles.counterCard} ${styles.counterCardActive}`}>
                    <div className={styles.labelRow}>
                      <span className={styles.counterTitle}>{p.resource_name ?? `${labels.queue} ${idx + 1}`}</span>
                      {p.start_time ? <span className={styles.label}>{p.start_time}</span> : null}
                    </div>
                    <div className={styles.counterNo} data-size={heroSize(p.queue_number)}>{p.queue_number}</div>
                    <div className={styles.rowMeta}>{[p.customer_name, p.service_name].filter(Boolean).join(' • ') || labels.status_called}</div>
                  </article>
                ))}
                {Array.from({ length: placeholders }).map((_, i) => (
                  <article key={`free-${i}`} className={styles.counterCard}>
                    <div className={styles.labelRow}>
                      <span className={styles.counterTitle} style={{ color: 'var(--sg-muted)' }}>{labels.resource}</span>
                    </div>
                    <div className={styles.counterFree}>{labels.free}</div>
                    <div className={styles.rowMeta}>&nbsp;</div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className={styles.card}>
            <div className={styles.labelRow}>
              <span className={styles.label}>{labels.next_queue}</span>
              <span className={styles.label}>{data.totals.waiting}</span>
            </div>
            <QueueList items={data.next_queue} emptyText={labels.empty_next} max={mode === 'thumbnail' ? 3 : undefined} />
            {data.qr_url ? (
              <div style={{ marginTop: 'auto', paddingTop: 'calc(var(--sg-unit) * 1.2)' }}>
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
