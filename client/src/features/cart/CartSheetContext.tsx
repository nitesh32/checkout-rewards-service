import { createContext, use, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';

interface CartSheetState {
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
}

const CartSheetContext = createContext<CartSheetState | null>(null);

export function CartSheetProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const value = useMemo(
    () => ({
      isOpen,
      setOpen: (nextIsOpen: boolean) => {
        // Toasts would otherwise sit on top of the sheet's checkout button.
        if (nextIsOpen) toast.dismiss();
        setIsOpen(nextIsOpen);
      },
    }),
    [isOpen],
  );
  return <CartSheetContext value={value}>{children}</CartSheetContext>;
}

export function useCartSheet(): CartSheetState {
  const state = use(CartSheetContext);
  if (!state) throw new Error('useCartSheet must be used inside CartSheetProvider');
  return state;
}
