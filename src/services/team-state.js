const STORAGE_KEY = 'fantasy_team_state';

export const teamState = {
  getState() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      const initialState = { budget: 100.0, roster: [] };
      this.saveState(initialState);
      return initialState;
    }
    return JSON.parse(data);
  },

  saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  },

  resetState() {
    const initialState = { budget: 100.0, roster: [] };
    this.saveState(initialState);
    return initialState;
  },

  addPlayers(playersToAdd) {
    const state = this.getState();
    const totalCost = playersToAdd.reduce((sum, p) => sum + (p.precio || 0), 0);

    if (state.roster.length + playersToAdd.length > 9) {
      alert(`La plantilla excede el límite de 9 jugadores.`);
      return false;
    }

    if (state.budget < totalCost) {
      alert(`Presupuesto insuficiente. Necesitas ${totalCost}M € pero tienes ${state.budget.toFixed(1)}M €.`);
      return false;
    }

    state.budget -= totalCost;
    state.roster.push(...playersToAdd);
    this.saveState(state);
    return true;
  },

  removePlayer(playerId) {
    const state = this.getState();
    const index = state.roster.findIndex(p => p.id === playerId);
    if (index === -1) return false;

    const player = state.roster[index];
    state.budget += (player.precio || 0);
    state.roster.splice(index, 1);
    this.saveState(state);
    return true;
  }
};