import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"
import withBundleAnalyzer from "@next/bundle-analyzer"

const withNextIntl = createNextIntlPlugin("./i18n/request.ts")

const withAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
})

const nextConfig: NextConfig = {}

export default withNextIntl(withAnalyzer(nextConfig))
