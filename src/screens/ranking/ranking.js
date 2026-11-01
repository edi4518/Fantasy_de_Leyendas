/**
 * @file ranking.js
 * @description Controlador de la pantalla de Ranking Global.
 * Asegura la integridad del DOM del podio Top 3, el listado clasificado y la tarjeta de mánager.
 */

// 1. Datos simulados (Mock Data) exactos de la maqueta
const MOCK_RANKING = [
  { rank: 1, name: 'David Villa', points: 1520, trend: 'equal' },
  { rank: 2, name: 'Alex Mercer', points: 1480, trend: 'equal' },
  { rank: 3, name: 'Carlos Sainz', points: 1395, trend: 'equal' },
  { rank: 4, name: 'Lucas Moreno', points: 1250, trend: 'up' },
  { rank: 5, name: 'Martín Silva', points: 1180, trend: 'down' },
  { rank: 6, name: 'Alonso Ramos', points: 1105, trend: 'neutral' },
  { rank: 7, name: 'Daniel Craig', points: 1040, trend: 'up' },
];

const CURRENT_USER_MOCK = {
  rank: 450,
  teamName: 'Leyendas FC',
  points: 840,
  trend: 'up'
};

/**
 * Función principal inicializadora de la pantalla
 */
export function initRanking() {
  ensurePodiumIntegrity();
  ensureListAndManagerIntegrity();
}

/**
 * Asegura que las 3 tarjetas del podio estén completas en el DOM (en especial Carlos Sainz)
 */
function ensurePodiumIntegrity() {
  const thirdStep = document.querySelector('.podium-step--third');
  if (thirdStep) {
    const thirdCard = thirdStep.querySelector('.podium-card');
    if (thirdCard && (!thirdCard.querySelector('.podium-name') || !thirdCard.querySelector('.podium-badge'))) {
      thirdCard.innerHTML = `
        <div class="podium-avatar-wrapper">
          <div class="podium-avatar podium-avatar--third">
            <svg class="avatar-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" stroke-linecap="round"
                stroke-linejoin="round" stroke-width="2"></path>
            </svg>
          </div>
          <span class="podium-badge podium-badge--third">3</span>
        </div>
        <span class="podium-name">Carlos Sainz</span>
        <span class="podium-points podium-points--third">1.395 pts</span>
      `;
    }
  }
}

/**
 * Asegura y renderiza los puestos del 4 al 7 y la tarjeta del mánager conectado
 */
function ensureListAndManagerIntegrity() {
  const container = document.querySelector('.ranking-screen');
  if (!container) return;

  // 1. Verificar o crear la lista #ranking-list
  let listEl = document.getElementById('ranking-list');
  if (!listEl) {
    listEl = document.createElement('ul');
    listEl.className = 'ranking-list';
    listEl.id = 'ranking-list';
    const podiumEl = container.querySelector('.podium-container');
    if (podiumEl && podiumEl.nextSibling) {
      container.insertBefore(listEl, podiumEl.nextSibling);
    } else {
      container.appendChild(listEl);
    }
  }

  // Renderizar puestos 4 a 7
  const items = MOCK_RANKING.slice(3, 7);
  listEl.innerHTML = items.map(item => {
    let trendSymbol = '-';
    let trendClass = 'trend-neutral';

    if (item.trend === 'up') {
      trendSymbol = '↑';
      trendClass = 'trend-up';
    } else if (item.trend === 'down') {
      trendSymbol = '↓';
      trendClass = 'trend-down';
    }

    return `
      <li class="ranking-item">
        <span class="item-rank">${item.rank}</span>
        <div class="item-avatar">
          <svg class="avatar-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" stroke-linecap="round"
              stroke-linejoin="round" stroke-width="2"></path>
          </svg>
        </div>
        <span class="item-name">${item.name}</span>
        <div class="item-stats">
          <span class="item-points">${item.points.toLocaleString('es-AR')} pts</span>
          <span class="item-trend ${trendClass}">${trendSymbol}</span>
        </div>
      </li>
    `;
  }).join('');

  // 2. Verificar o crear la tarjeta del mánager
  let userCard = container.querySelector('.ranking-current-user');
  if (!userCard) {
    userCard = document.createElement('div');
    userCard.className = 'ranking-current-user';
    container.appendChild(userCard);
  }

  const savedUser = JSON.parse(localStorage.getItem('user') || '{}');
  const teamName = savedUser.team_name || CURRENT_USER_MOCK.teamName;

  userCard.innerHTML = `
    <div class="user-position-box">
      <span class="user-position-label">POSICIÓN</span>
      <span class="user-rank" id="user-rank-val">#${CURRENT_USER_MOCK.rank}</span>
    </div>
    <div class="user-avatar-badge">
      <svg class="avatar-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" stroke-linecap="round"
          stroke-linejoin="round" stroke-width="2"></path>
      </svg>
    </div>
    <div class="user-team-info">
      <span class="user-team-title">Mi Equipo</span>
      <span class="user-team" id="user-team-name">${teamName}</span>
    </div>
    <div class="user-points-badge">
      <span class="user-points" id="user-points-val">${CURRENT_USER_MOCK.points.toLocaleString('es-AR')} pts</span>
      <span class="user-points-trend">↑</span>
    </div>
  `;
}
