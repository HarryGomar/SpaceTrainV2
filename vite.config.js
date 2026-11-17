import react from '@vitejs/plugin-react'
import { loadEnv, transformWithEsbuild } from 'vite'
import restart from 'vite-plugin-restart'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

function accountConfig(mode)
{
    const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), 'ART_ATLAS_SUPABASE_')
    const url = env.ART_ATLAS_SUPABASE_URL
    const publishableKey = env.ART_ATLAS_SUPABASE_PUBLISHABLE_KEY
    if (!url && !publishableKey) return null
    if (!url || !publishableKey) throw new Error('Set both Art Atlas Supabase settings to enable account saves.')

    const endpoint = new URL(url)
    const local = ['localhost', '127.0.0.1'].includes(endpoint.hostname)
    if (endpoint.pathname !== '/' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash ||
        endpoint.protocol !== 'https:' && !(local && endpoint.protocol === 'http:'))
        throw new Error('Art Atlas needs a Supabase project URL.')

    let localAnon = false
    if (local && publishableKey.split('.').length === 3)
    {
        try { localAnon = JSON.parse(Buffer.from(publishableKey.split('.')[1], 'base64url')).role === 'anon' }
        catch { /* malformed keys are rejected below */ }
    }
    if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey) && !localAnon)
        throw new Error('Art Atlas needs the project’s public publishable key.')
    return {url:endpoint.origin, publishableKey}
}

export default ({mode}) => ({
    root: 'src/',
    publicDir: '../public/',
    define:
    {
        __ART_ATLAS_PUBLIC_CONFIG__: JSON.stringify(accountConfig(mode))
    },
    plugins:
    [
        restart({ restart: [ '../public/**', ] }),

        // React support
        react(),

        // .js file support as if it was JSX
        {
            name: 'load+transform-js-files-as-jsx',
            async transform(code, id)
            {
                if (!id.match(/src\/.*\.js$/))
                    return null

                return transformWithEsbuild(code, id, {
                    loader: 'jsx',
                    jsx: 'automatic',
                });
            },
        },

        tailwindcss(),
    ],
    server:
    {
        host: true, // Open to local network and display URL
        open: !('SANDBOX_URL' in process.env || 'CODESANDBOX_HOST' in process.env) // Open if it's not a CodeSandbox
    },
    build:
    {
        outDir: '../dist', // Output in the dist/ folder
        emptyOutDir: true, // Empty the folder first
        sourcemap: true, // Add sourcemap
        rollupOptions:
        {
            input: {
                portfolio: fileURLToPath(new URL('./src/index.html', import.meta.url)),
                artAtlasAccount: fileURLToPath(new URL('./src/art-atlas/account.html', import.meta.url))
            }
        }
    },
    test:
    {
        environment: 'jsdom',
    },
})
