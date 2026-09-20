import { useOutletContext } from 'react-router-dom';
import type { LoadedInstance } from './model';

export function useLoadedInstance(): LoadedInstance {
  return useOutletContext<LoadedInstance>();
}
