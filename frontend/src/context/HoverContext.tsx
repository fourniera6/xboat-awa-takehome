import React, { createContext, useContext, useState } from 'react';

const Ctx = createContext<{idx: number|null, setIdx: (i:number|null)=>void}>({idx:null, setIdx:()=>{}});
export const HoverProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [idx, setIdx] = useState<number|null>(null);
  return <Ctx.Provider value={{idx, setIdx}}>{children}</Ctx.Provider>
}
export const useHover = () => useContext(Ctx);
