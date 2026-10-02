/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Disabled: Strict Mode double-invokes effects in dev,
                           // doubling all API fetches and causing Supabase realtime
                           // lock conflicts. Has no effect in production builds.
  images: {
    domains: ['lh3.googleusercontent.com'],
  },
};

export default nextConfig;
