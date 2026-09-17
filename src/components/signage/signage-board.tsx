'use client';

import { useEffect, useRef, useState } from 'react';
import type { SignageConfig, SignageData } from '@/lib/signage/types';
import { formatThaiDateLabel } from '@/lib/utils/date-format';
import { getSignageLabels } from './labels';
import type { SignageMode } from './parts';
import { getPalette, paletteToStyle } from './themes';
import { SIGNAGE_TEMPLATE_REGISTRY } from './templates';
import { useClock } from './use-clock';
import { useSignageScale } from './use-signage-scale';
import styles from './signage-board.module.css';

export type SignageBoardProps = {
  data: SignageData;
  config: SignageConfig;
  /**
   * `live` = real TV (clock, QR, animations). `preview` = portal preview (same, no
   * wake lock). `thumbnail` = static picker/landing card: no clock tick, no QR
   * generation, no animation, shorter lists.
   */
  mode: SignageMode;
  status?: { offline: boolean };
  lang?: 'th' | 'en';
  /** Fixed clock text for thumbnails so mocks look alive without ticking. */
  clockOverride?: string;
  className?: string;
};

/**
 * The one signage renderer. Fills its container; the container decides the size
 * (full viewport on the TV, an aspect-ratio box in the portal and landing).
 */
export function SignageBoard({ data, config, mode, status, lang = 'th', clockOverride, className }: SignageBoardProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  useSignageScale(rootRef, config.layout);

  const tickingClock = useClock(mode !== 'thumbnail' && config.show_clock, lang);
  const clock = mode === 'thumbnail' ? clockOverride ?? '10:42:08' : tickingClock;

  const [dateLabel, setDateLabel] = useState('');
  useEffect(() => {
    setDateLabel(formatThaiDateLabel(data.date));
  }, [data.date]);

  const labels = getSignageLabels(lang);
  const palette = getPalette(config.theme);
  const Template = SIGNAGE_TEMPLATE_REGISTRY[config.template]?.component ?? SIGNAGE_TEMPLATE_REGISTRY.classic.component;

  const classes = [
    styles.root,
    config.layout === 'portrait' ? styles.portrait : '',
    mode === 'thumbnail' ? styles.thumb : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={rootRef}
      className={classes}
      style={paletteToStyle(palette)}
      data-template={config.template}
      data-theme={config.theme}
      data-layout={config.layout}
      aria-hidden={mode === 'thumbnail' ? true : undefined}
    >
      {data.shop.demo_mode_enabled || status?.offline ? (
        <div className={styles.badges}>
          {data.shop.demo_mode_enabled ? <span className={`${styles.badge} ${styles.badgeDemo}`}>{labels.demo_mode}</span> : null}
          {status?.offline ? <span className={`${styles.badge} ${styles.badgeOffline}`}>{labels.offline}</span> : null}
        </div>
      ) : null}
      <Template data={data} config={config} mode={mode} labels={labels} clock={clock} dateLabel={dateLabel} />
    </div>
  );
}

/** Full-board message shown when the shop has turned its signage off. */
export function SignageDisabled({ shopName, lang = 'th' }: { shopName: string; lang?: 'th' | 'en' }) {
  const labels = getSignageLabels(lang);
  return (
    <div className={styles.root} style={paletteToStyle(getPalette('emerald'))}>
      <div className={styles.disabled}>
        <div className={styles.shopName}>{shopName}</div>
        <div className={styles.disabledTitle}>{labels.disabled_title}</div>
        <div className={styles.disabledBody}>{labels.disabled_body}</div>
      </div>
    </div>
  );
}
