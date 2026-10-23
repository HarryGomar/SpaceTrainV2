import {useSyncExternalStore} from 'react';

const subscribe = callback => {
    window.addEventListener('resize',callback);
    return () => window.removeEventListener('resize',callback);
};
const getSnapshot = () => window.innerWidth <= 760 || window.innerWidth <= 1024 && window.innerHeight <= 600;

export default function useCompactViewport() {
    return useSyncExternalStore(subscribe,getSnapshot,()=>false);
}
