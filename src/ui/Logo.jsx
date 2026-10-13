// Logo Alipto : un A (la progression, le sommet) avec une goutte d'huile en son cœur.
// Aleiptès, en grec, c'est celui qui préparait les athlètes : il les massait à l'huile et dosait leur entraînement.
export const DROP = 'M0 -46 C 14 -26 30 -6 30 14 A 30 30 0 1 1 -30 14 C -30 -6 -14 -26 0 -46 Z';

export function Mark({ size = 40, flat, title, cls }) {
  return (
    <svg class={'mark' + (cls ? ' ' + cls : '')} viewBox="0 0 512 512" width={size} height={size} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : 'true'}>
      {!flat && <rect width="512" height="512" rx="112" fill="#15191e" />}
      <path d="M126 410 L256 118 L386 410" fill="none" stroke={flat ? 'currentColor' : '#6f8cf0'} stroke-width="62" stroke-linecap="round" stroke-linejoin="round" />
      <path transform="translate(256 316) scale(1.22)" d={DROP} fill="var(--oil)" />
    </svg>
  );
}

// « Alipto » avec la goutte à la place du point du i
export function Wordmark({ size = 40 }) {
  return (
    <span class="wm" style={'font-size:' + size + 'px'} aria-label="Alipto" role="img">
      <span aria-hidden="true">Al<span class="wm-i">ı<svg viewBox="-32 -48 64 96"><path d={DROP} /></svg></span>pto</span>
    </span>
  );
}

export function Brand({ size = 40, tagline }) {
  return (
    <div class="brand">
      <Mark size={Math.round(size * 1.15)} />
      <div class="brand-t"><Wordmark size={size} />{tagline && <small>{tagline}</small>}</div>
    </div>
  );
}
