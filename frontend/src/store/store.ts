import { configureStore } from '@reduxjs/toolkit';
import servicesFilterReducer from './servicesFilterSlice';

export const store = configureStore({
  reducer: {
    servicesFilter: servicesFilterReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

