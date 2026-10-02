/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Disabled: Strict Mode double-invokes effects in dev,
                           // doubling all API fetches and causing Supabase realtime
                           // lock conflicts. Has no effect in production builds.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      // Supabase Storage — covers plantation-proofs and plantation-imagery buckets
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/**' },
      // Leaflet default marker icons (loaded from unpkg in PlantationMap)
      { protocol: 'https', hostname: 'unpkg.com' },
    ],
  },
  webpack: (config) => {
    // Silence "Critical dependency: the request of a dependency is an expression"
    // warnings from Leaflet's optional canvas/jsdom fallback in SSR bundles.
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };
    return config;
  },
};

export default nextConfig;

