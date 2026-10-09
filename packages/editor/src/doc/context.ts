import { createContext, useContext } from 'react';
import type { DocServices } from './services.ts';

/** The host's services, for node views and the read-only view alike. */
export const DocServicesContext = createContext<DocServices>({});

export const useDocServices = () => useContext(DocServicesContext);
