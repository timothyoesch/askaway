import tailwindcss from "@tailwindcss/vite";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: '2024-11-01',
    devtools: { enabled: true },
    vite: {
        plugins: [
            tailwindcss(),
        ],
    },
    css: [
        '@/assets/css/main.css',
    ],
    runtimeConfig: {
        public: {
            pb_base: process.env.PB_BASE || 'https://api.example.com',
        },
    },
    app: {
        head: {
            htmlAttrs: {
                lang: "de"
            },
            link: [
                { rel: "icon", type: "image/png", href: "/favicon/favicon-96x96.png", sizes: "96x96" },
                { rel: "icon", type: "image/svg+xml", href: "/favicon/favicon.svg" },
                { rel: "shortcut icon", href: "/favicon/favicon.ico" },
                { rel: "apple-touch-icon", sizes: "180x180", href: "/favicon/apple-touch-icon.png" },
                { rel: "manifest", href: "/favicon/site.webmanifest" }
            ],
            meta: [
            ]
        }
    }
})
