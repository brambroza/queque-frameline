'use client';

import { useRef } from 'react';
import type { SignageTemplateProps } from '../template-props';
import { AnnouncementTicker, BoardHeader, QrPanel, useFitChildren } from '../parts';
import styles from '../signage-board.module.css';

/**
 * Board: departure-board table. Queues being called are pinned to the top with the
 * accent colour, then upcoming queues in order. Best for high-volume shops.
 */
export function BoardTemplate({ data, config, mode, labels, clock, dateLabel }: SignageTemplateProps) {
  const isPortrait = config.layout === 'portrait';
  const maxRows = mode === 'thumbnail' ? 5 : isPortrait ? 18 : 10;
  const rows = [
    ...data.now_calling.map((p) => ({ p, active: true })),
    ...data.next_queue.map((p) => ({ p, active: false })),
    ...data.waiting_queue.map((p) => ({ p, active: false })),
  ].slice(0, maxRows);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const fit = useFitChildren(bodyRef, rows.length);
  const shownRows = Math.min(fit, rows.length);
  const moreWaiting = Math.max(0, data.totals.waiting + data.now_calling.length - shownRows);

  return (
    <>
      <BoardHeader data={data} config={config} clock={clock} dateLabel={dateLabel} />
      <div className={styles.body}>
        <div className={styles.table}>
          <div className={styles.tableHead}>
            <span>{labels.queue}</span>
            {!isPortrait ? <span>{labels.service}</span> : null}
            <span>{labels.resource}</span>
            <span>{labels.time}</span>
            <span style={{ textAlign: 'right' }}>{labels.status}</span>
          </div>
          <div className={styles.tableBody} ref={bodyRef}>
            {rows.length === 0 ? (
              <div className={styles.empty}>{labels.empty_calling}</div>
            ) : (
              rows.map(({ p, active }, i) => (
                <div key={p.id} className={`${styles.tableRow} ${active ? styles.tableRowActive : ''} ${i >= fit ? styles.hiddenRow : ''}`}>
                  <span className={styles.tableNo}>{p.queue_number}</span>
                  {!isPortrait ? (
                    <span className={styles.tableCell}>
                      {p.service_name ?? ''}
                      {p.customer_name ? <span className={styles.tableCellMuted}>{p.service_name ? ' • ' : ''}{p.customer_name}</span> : null}
                    </span>
                  ) : null}
                  <span className={`${styles.tableCell} ${active ? '' : styles.tableCellMuted}`}>{p.resource_name ?? (isPortrait && p.customer_name ? p.customer_name : '—')}</span>
                  <span className={`${styles.tableCell} ${styles.tableCellMuted}`}>{p.start_time ?? ''}</span>
                  <span style={{ textAlign: 'right' }}>
                    <span className={`${styles.tableStatus} ${active ? styles.tableStatusActive : ''}`}>{active ? labels.status_called : labels.status_waiting}</span>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
        {data.qr_url || moreWaiting > 0 ? (
          <div className={styles.footerRow}>
            <span className={styles.label}>{moreWaiting > 0 ? `${labels.waiting_count} ${moreWaiting}` : ''}</span>
            {data.qr_url ? <QrPanel url={data.qr_url} mode={mode} labels={labels} /> : null}
          </div>
        ) : null}
      </div>
      <AnnouncementTicker text={config.announcement_text} />
    </>
  );
}
