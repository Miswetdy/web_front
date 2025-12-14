import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ServicesFilterState {
  query: string;
}

const loadStateFromLocalStorage = (): ServicesFilterState => {
  try {
    const serializedState = localStorage.getItem('servicesFilter');
    if (serializedState === null) {
      return { query: '' };
    }
    return JSON.parse(serializedState);
  } catch (err) {
    return { query: '' };
  }
};

const initialState: ServicesFilterState = loadStateFromLocalStorage();

const servicesFilterSlice = createSlice({
  name: 'servicesFilter',
  initialState,
  reducers: {
    setQuery: (state, action: PayloadAction<string>) => {
      state.query = action.payload;
      try {
        localStorage.setItem('servicesFilter', JSON.stringify(state));
      } catch (err) {
        console.error('Failed to save filter to localStorage:', err);
      }
    },
    clearQuery: (state) => {
      state.query = '';
      try {
        localStorage.removeItem('servicesFilter');
      } catch (err) {
        console.error('Failed to clear filter from localStorage:', err);
      }
    },
  },
});

export const { setQuery, clearQuery } = servicesFilterSlice.actions;
export default servicesFilterSlice.reducer;

