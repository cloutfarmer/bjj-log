import { fileURLToPath } from "node:url";

const isDev = process.env.NODE_ENV === "development";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep a running development server from overwriting production build files.
  distDir: isDev ? ".next-dev" : ".next",
  // `page.dev.tsx` files, such as the /dev preview, are routes only in development.
  // Production builds never compile them or the fixtures they import.
  pageExtensions: isDev ? ["dev.tsx", "tsx", "ts", "jsx", "js"] : ["tsx", "ts", "jsx", "js"],
  outputFileTracingRoot: fileURLToPath(new URL(".", import.meta.url)),
};

export default nextConfig;
