import { defineConfig, loadEnv } from 'vite';
import path from 'path';
import dotenv from "dotenv";
import vue from '@vitejs/plugin-vue';
import Unocss from 'unocss/vite';
// import cesium from 'vite-plugin-cesium';
import mkcert from 'vite-plugin-mkcert';
import { viteStaticCopy } from 'vite-plugin-static-copy'
// 用于生成渐进式 Web 应用
// import { VitePWA } from 'vite-plugin-pwa';
// 自动按需引入Naive UI组件
import Components from 'unplugin-vue-components/vite'
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers'
import { wrapperEnv, createPlugins } from "@astral3d/build-vite-plugins";

export default defineConfig(async ({ mode, command }) => {
    const root = process.cwd();
    const env = loadEnv(mode, root);
    //LoadEnv读取的布尔类型是一个字符串。此函数可以转换为布尔类型
    const viteEnv = wrapperEnv(env);
    const {
        VITE_PORT,
        VITE_PUBLIC_PATH,
        VITE_BUILD_COMPRESS,
        VITE_BUILD_COMPRESS_DELETE_ORIGIN_FILE,
        VITE_ENABLE_ANALYZE,
        VITE_ENABLE_CONFIG_GENERATE,
        VITE_USE_SDK_SOURCE
    } = viteEnv;

    const isBuild = command === 'build';
    const plugins = await createPlugins({
        isBuild,
        root,
        compress: {
            compress: VITE_BUILD_COMPRESS,
            deleteOriginFile: VITE_BUILD_COMPRESS_DELETE_ORIGIN_FILE,
        },
        enableAnalyze: VITE_ENABLE_ANALYZE,
        enableConfig: VITE_ENABLE_CONFIG_GENERATE
    });

    // 为@monaco-editor定义define
    const define: any = {
        "process.env": process.env
    };
    if (mode === "development") {
        dotenv.config({ path: ".env.development" });
        define.global = {};
    } else if (mode === "production") {
        dotenv.config({ path: ".env.production" });
    }

    const alias: Record<string, string> = {
        '~': path.resolve(__dirname, './types'),
        '@': path.resolve(__dirname, './src'),
    }
    const optimizeDepsExclude = ['keyframe-resample', 'draco3dgltf']
    if (VITE_USE_SDK_SOURCE) {
        alias['@astral3d/engine'] = path.resolve(__dirname, '../sdk/lib/index.ts')
        alias['#'] = path.resolve(__dirname, '../sdk/lib')
        optimizeDepsExclude.push('@astral3d/engine')
    }

    return {
        define: define,
        base: VITE_PUBLIC_PATH,
        build: {
            outDir: "dist",
            terserOptions: {
                compress: {
                    // 生产环境移除console
                    drop_console: false,
                },
            },
            sourcemap: false,
            // 启用 CSS 代码拆分
            cssCodeSplit: true,
            // 禁用 gzip 压缩大小报告。压缩大型输出文件可能会很慢，因此禁用该功能可能会提高大型项目的构建性能。
            reportCompressedSize: false,
            // 规定触发警告的 chunk 大小。（以 kbs 为单位）
            chunkSizeWarningLimit: 1024 * 6,
            // 自定义底层的 Rollup 打包配置
            rollupOptions: {
                output: {
                    manualChunks: {
                        vue: ['vue', 'vue-router', 'pinia'],
                        i18n: ['vue-i18n'],
                        ui: ['naive-ui'],
                        pinia: ['@astral3d/engine']
                    },
                }
            }
        },
        root,
        plugins: [
            vue(),
            Unocss(),
            // cesium(),
            Components({
                resolvers: [NaiveUiResolver()]
            }),
            // 本地开发https证书
            mkcert(),
            // VitePWA({
            //     registerType: 'autoUpdate',
            //     // dev环境下是否开启
            //     devOptions: {
            //         enabled: false,
            //     },
            //     // 注册ws方式
            //     injectRegister: 'auto',
            //     workbox: {
            //         // sw 预缓存的资源类型
            //         globPatterns: ['**/*.{js}'],
            //         // Error:  Configure "workbox.maximumFileSizeToCacheInBytes" to change the limit: the default value is 2 MiB.
            //         // 添加此项配置，增加需要缓存的最大文件大小,默认2MB
            //         maximumFileSizeToCacheInBytes: 20 * 1024 * 1024
            //     },
            //     manifest: {
            //         name: 'Astral 3D Editor',
            //         short_name: 'Astral 3D',
            //         description: '一款基于THREE.JS开发的专业的三维可视化编辑器',
            //         theme_color: '#63E2B7',
            //         icons: [
            //             {
            //                 src: '/static/images/logo/pwa/pwa-48x48.png',
            //                 sizes: '48x48',
            //                 type: 'image/png',
            //             },
            //             {
            //                 src: '/static/images/logo/pwa/pwa-64x64.png',
            //                 sizes: '64x64',
            //                 type: 'image/png',
            //             },
            //             {
            //                 src: '/static/images/logo/pwa/pwa-96x96.png',
            //                 sizes: '96x96',
            //                 type: 'image/png',
            //             },
            //             {
            //                 src: '/static/images/logo/pwa/pwa-192x192.png',
            //                 sizes: '192x192',
            //                 type: 'image/png',
            //             },
            //             {
            //                 src: '/static/images/logo/pwa/pwa-256x256.png',
            //                 sizes: '256x256',
            //                 type: 'image/png',
            //             },
            //             {
            //                 src: '/static/images/logo/pwa/pwa-512x512.png',
            //                 sizes: '512x512',
            //                 type: 'image/png',
            //             },
            //             {
            //                 src: '/static/images/logo/pwa/pwa-512x512.png',
            //                 sizes: '512x512',
            //                 type: 'image/png',
            //                 purpose: 'any',
            //             },
            //             {
            //                 src: '/static/images/logo/pwa/pwa-512x512.png',
            //                 sizes: '512x512',
            //                 type: 'image/png',
            //                 purpose: 'maskable',
            //             },
            //         ],
            //     },
            // }),
            viteStaticCopy({
                targets: [
                    { src: 'node_modules/@astral3d/engine/dist/libs/*', dest: 'assets/libs' }
                ],
            }),
            ...plugins
        ],
        resolve: {
            alias,
            extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue']
        },
        optimizeDeps: {
            exclude: optimizeDepsExclude,
        },
        server: {
            host: true,
            port: VITE_PORT,
            //设置 server.hmr.overlay 为 false 可以禁用开发服务器错误的屏蔽
            // hmr: { overlay: false },
            headers: {
                'Cross-Origin-Embedder-Policy': 'require-corp',
                'Cross-Origin-Opener-Policy': 'same-origin',
            },
            cors: {
                origin: "*",
                credentials: true
            },
            proxy: {
                '^/api': {
                    target: env.VITE_PROXY_URL,
                    changeOrigin: true,
                    rewrite: (path) => path.replace(new RegExp(`^/api`), '/api')
                },
                "^/file/static": {
                    target: env.VITE_PROXY_URL,
                    changeOrigin: true,
                    rewrite: (path) => path.replace(new RegExp(`^/file/static`), '/api/common/static')
                },
            }
        }
    }
})
