'use client';

import { useRef } from 'react';
import type { SignageTemplateProps } from '../template-props';
import { AnnouncementTicker, BoardHeader, HeroNumber, QrPanel, useFitChildren } from '../parts';
import styles from '../signage-board.module.css';

/**
 * Minimal: lots of whitespace, no card chrome. Number on the left, a thin list of
 * upcoming numbers on the right. Pairs well with the light palette.
 */
export function MinimalTemplate({ data, config, mode, labels, clock, dateLabel }: SignageTemplateProps) {
  const hero = data.now_calling[0] ?? null;
  const upcoming = [...data.now_calling.slice(1), ...data.next_queue].slice(0, mode === 'thumbnail' ? 4 : config.layout === 'portrait' ? 8 : 6);
  const listRef = useRef<HTMLDivElement | null>(null);
  const fit = useFitChildren(listRef, upcoming.length);

  return (
    <>
      <BoardHeader data={data} config={config} clock={clock} dateLabel={dateLabel} />
      <div className={styles.minimalBody}>
        <section className={styles.minimalHero}>
          <span className={`${styles.label} ${styles.labelAccent}`}>{labels.now_calling}</span>
          {hero ? (
            <>
              <HeroNumber value={hero.queue_number} xl pulse={mode === 'live'} />
              {hero.customer_name ? <div className={styles.heroName}>{hero.customer_name}</div> : null}
              <div className={styles.heroMeta}>
                {[hero.service_name, hero.resource_name ? `${labels.please_proceed} ${hero.resource_name}` : null].filter(Boolean).join(' • ') || ' '}
              </div>
            </>
          ) : (
            <div className={styles.empty} style={{ justifyContent: 'flex-start' }}>{labels.empty_calling}</div>
          )}
          {data.qr_url ? (
            <div style={{ marginTop: 'calc(var(--sg-unit) * 2.4)' }}>
              <QrPanel url={data.qr_url} mode={mode} labels={labels} />
            </div>
          ) : null}
        </section>

        <section className={styles.minimalList}>
          <span className={styles.label}>{labels.next_queue}</span>
          {upcoming.length === 0 ? (
            <div className={styles.empty} style={{ justifyContent: 'flex-start' }}>{labels.empty_next}</div>
          ) : (
            <div className={styles.minimalItems} ref={listRef}>
              {upcoming.map((p, i) => (
                <div key={p.id} className={`${styles.minimalItem} ${i >= fit ? styles.hiddenRow : ''}`}>
                  <span className={styles.minimalNo}>{p.queue_number}</span>
                  <span className={styles.minimalMeta}>{[p.customer_name, p.service_name, p.start_time].filter(Boolean).join(' • ')}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      <AnnouncementTicker text={config.announcement_text} />
    </>
  );
}
