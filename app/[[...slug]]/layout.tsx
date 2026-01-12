import StockTerminal from '@/components/dashboard/StockTerminal';

export default function Layout({ children }: { children: React.ReactNode }) {
  // We ignore children because StockTerminal handles the entire view.
  // The page component (children) is effectively a dummy for the route.
  return <StockTerminal />;
}
