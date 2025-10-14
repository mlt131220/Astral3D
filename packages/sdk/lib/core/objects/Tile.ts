import { TilesRenderer } from "3d-tiles-renderer";
import { GLTFExtensionsPlugin, GLTFMeshFeaturesExtension, GLTFStructuralMetadataExtension, TilesFadePlugin, DebugTilesPlugin, UnloadTilesPlugin } from "3d-tiles-renderer/plugins";
import Loader from "#/core/loader/Loader.ts";
import { PerspectiveCamera, WebGLRenderer, Group, JSONMeta } from "three";
import { deepAssign } from "#/utils";
import { TILES_DEBUG_COLOR_MODE } from "#/constant";
import { useDispatchSignal } from "#/hooks";

export const getDefault3DTilesOptions = (): ITiles.options => ({
    url: "",
    reset2origin: true,
    debug: {
        enabled: false,
        colorMode: TILES_DEBUG_COLOR_MODE["Screen error"],
        displayBoxBounds: true,
        displaySphereBounds: false,
    },
    name: "Tiles",
    errorTarget: 6,
    LRUCache: {
        maxSize: 4000,
        minSize: 3000,
        maxBytesSize: 0.4 * 2 ** 30,
        minBytesSize: 0.3 * 2 ** 30,
    }
})

export default class Tiles extends Group {
    type = "TilesGroup";
    isTilesGroup = true;

    // 默认配置
    options: ITiles.options = getDefault3DTilesOptions();

    renderer: TilesRenderer;

    constructor(options: ITiles.options) {
        super();

        if (!options.url) {
            throw new Error('[Astral 3D]: No url provided.');
        }

        deepAssign(this.options, options);

        this.name = this.options.name as string;

        this.renderer = this.initRenderer();

        // 设置debug插件
        this.setDebug(this.options.debug, false);
        // 瓦片渐显隐
        this.renderer.registerPlugin(new TilesFadePlugin());
        // 从gpu卸载不可见瓦片数据，cpu上仍然存在
        this.renderer.registerPlugin(new UnloadTilesPlugin());

        this.add(this.renderer.group);
    }

    get group() {
        return this.renderer.group;
    }

    /**
     * 初始化Tiles渲染器
     */
    initRenderer(): TilesRenderer {
        const tilesRenderer = new TilesRenderer(this.options.url);
        tilesRenderer.fetchOptions.mode = 'cors';
        tilesRenderer.errorTarget = this.options.errorTarget || 6;
        // LRUCache
        if (this.options.LRUCache) {
            tilesRenderer.lruCache.maxSize = this.options.LRUCache.maxSize || 800;
            tilesRenderer.lruCache.minSize = this.options.LRUCache.minSize || 600;
            tilesRenderer.lruCache.maxBytesSize = this.options.LRUCache.maxBytesSize || 0.4 * 2 ** 30;
            tilesRenderer.lruCache.minBytesSize = this.options.LRUCache.minBytesSize || 0.3 * 2 ** 30;
        }

        // isTilesGroup是只读的，此处绕过 readonly，防止编译报错
        (tilesRenderer.group as { isTilesGroup: boolean }).isTilesGroup = false;
        (tilesRenderer.group as { type: string }).type = "Tiles";
        tilesRenderer.group.isTiles = true;
        tilesRenderer.group.proxy = this;

        tilesRenderer.registerPlugin(new GLTFExtensionsPlugin({
            dracoLoader: Loader.dracoLoader,
            ktxLoader: Loader.ktx2Loader,
            plugins: [() => new GLTFMeshFeaturesExtension(), () => new GLTFStructuralMetadataExtension()]
        }));
        // Loader.createGLTFLoader(tilesRenderer.manager).then(loader => {
        //     loader.register(() => new GLTFMeshFeaturesExtension());
        //     loader.register(() => new GLTFStructuralMetadataExtension());
        //     tilesRenderer.manager.addHandler( /\.(gltf|glb)$/g, loader );
        // })

        // 子级瓦片加载
        tilesRenderer.addEventListener('load-model', (e) => {
            e.scene.traverse(c => {
                c.isTiles = true;
                // 子级瓦片不允许选中，添加proxy属性让点击此瓦片时选中此组
                c.proxy = this;

                if (c.type === "Group") {
                    (c as { type: string }).type = "Tiles";
                } else {
                    (c as { type: string }).type = "Tile";
                }
            })
        });

        tilesRenderer.addEventListener("load-error", (e) => {
            console.error(`${tilesRenderer.group.name} load error:`, e);
        });

        return tilesRenderer;
    }

    /**
     * 设置相机和渲染器
     */
    setCameraAndRenderer(camera: PerspectiveCamera, renderer: WebGLRenderer) {
        this.renderer.setCamera(camera);
        this.renderer.setResolutionFromRenderer(camera, renderer);
    }

    /**
     * 设置debug插件
     */
    setDebug(debugOptions: ITiles.options["debug"], needCreate: boolean = true) {
        deepAssign(this.options.debug, debugOptions);

        if (!this.options.debug) return;

        // 获取调试插件
        let debugTilesPlugin: DebugTilesPlugin | null = this.renderer.getPluginByName('DEBUG_TILES_PLUGIN') as DebugTilesPlugin | null;

        if (!debugTilesPlugin) {
            if (!needCreate) return;

            // 注册调试插件
            this.renderer.registerPlugin(new DebugTilesPlugin());

            // 获取debug插件
            debugTilesPlugin = this.renderer.getPluginByName('DEBUG_TILES_PLUGIN') as DebugTilesPlugin;
        }

        debugTilesPlugin.enabled = this.options.debug.enabled;
        debugTilesPlugin.colorMode = this.options.debug.colorMode;
        debugTilesPlugin.displayBoxBounds = this.options.debug.displayBoxBounds;
        debugTilesPlugin.displaySphereBounds = this.options.debug.displaySphereBounds;

        if (!needCreate) return;

        // 发起渲染
        this.update();
        useDispatchSignal("sceneGraphChanged");
    }

    /**
     * 重写clone方法，因为要接收参数
     */
    clone(recursive: boolean = true) {
        // 断言为可构造类型
        const Ctor = this.constructor as new (opts: ITiles.options) => this;
        return new Ctor(this.options).copy(this, recursive);
    }

    /**
     * 重写toJSON
     */
    toJSON(meta?: JSONMeta) {
        const json = super.toJSON(meta);
        json.object.type = "TilesGroup";
        json.object.options = this.options;

        return json;
    }

    static fromJSON(data: { options: ITiles.options, [s: string]: any }, copyAttr = true) {
        const tiles = new Tiles(data.options);

        if (copyAttr) {
            data.children = undefined;
            Loader.objectLoader.copyAttrByData(tiles, data);
        }

        return tiles;
    }

    /**
     * 更新/渲染Tiles
     */
    update() {
        this.renderer.update();
    }

    /**
     * 自我销毁
     */
    dispose() {
        this.renderer.dispose();
    }
}