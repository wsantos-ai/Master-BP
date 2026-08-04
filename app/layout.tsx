import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Master BP — Assistentes especializados',
  description:
    'Assistentes especializados que orientam o Business Partner de RH na execução das suas atividades.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
