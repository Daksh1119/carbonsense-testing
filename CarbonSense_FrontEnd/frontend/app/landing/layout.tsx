import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CarbonSense - Carbon Intelligence Platform',
  description:
    'Carbon footprint monitoring and intelligent decision support for emission reduction. Real-time insights, science-backed reporting, zero greenwashing.',
  keywords: [
    'carbon footprint',
    'emissions monitoring',
    'climate action',
    'carbon intelligence',
    'sustainability',
    'emission reduction',
  ],
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
