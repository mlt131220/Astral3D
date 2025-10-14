/**
 * @author ErSan
 * @email  mlt131220@163.com
 * @date   2025/7/30 18:49
 * @description 资源预览类
 */
import * as THREE from 'three';
import CameraControls from 'camera-controls';
import { Timer } from 'three/examples/jsm/misc/Timer.js';
import { CSS3DRenderer } from "three/examples/jsm/renderers/CSS3DRenderer.js";
import { PreviewOptions } from "#/core/preview/PreviewOptions.ts";
import Loader from "#/core/loader/Loader.ts";
import { createDivContainer, deepAssign, parseMaterialZip } from "#/utils";
import { getDefaultBillboardOptions } from "#/core/objects";
import { POSITION } from "#/constant";
import { Emitter } from '#/core/libs/three-nebula';
import ParticleEmitter from "#/core/objects/ParticleEmitter.ts"
import Billboard from "#/core/objects/Billboard.ts";
import Tiles from "../objects/Tile.ts";
import { focusObject } from "#/utils/scene/controls.ts";
import { ParticleSystem, TilesManage } from "#/core/viewer/modules";

export interface PreviewerEventMap {
    // 场景当前动画帧循环完成之后渲染之前触发，每一次渲染执行一次
    beforeRender: {};

    // 场景当前帧渲染完成之后触发，每一次渲染执行一次
    afterRender: {};
}

export interface PreviewerModules {
    controls: CameraControls,
    particleSystem: ParticleSystem,
    tilesManage: TilesManage,
}

CameraControls.install({
    THREE: {
        Vector2: THREE.Vector2,
        Vector3: THREE.Vector3,
        Vector4: THREE.Vector4,
        Quaternion: THREE.Quaternion,
        Matrix4: THREE.Matrix4,
        Spherical: THREE.Spherical,
        Box3: THREE.Box3,
        Sphere: THREE.Sphere,
        Raycaster: THREE.Raycaster,
    }
});

export default class Preview extends THREE.EventDispatcher<PreviewerEventMap> {
    public _container: HTMLElement;
    public options: IPreviewSetting;
    public renderer: THREE.WebGLRenderer;
    public camera: THREE.PerspectiveCamera;
    public scene: THREE.Scene;
    public modules: PreviewerModules;
    public css3DRenderer: CSS3DRenderer;

    public timer = new Timer();
    private resizeObserver: ResizeObserver | null = null;
    private resize: () => void;

    constructor(options: IPreviewSetting) {
        super();

        this._container = options.container || createDivContainer();

        this.options = PreviewOptions();
        deepAssign(this.options, options);

        const { camera, scene, renderer, css3DRenderer } = this.basicCreation();
        this.camera = camera;
        this.scene = scene;
        this.renderer = renderer;
        this.css3DRenderer = css3DRenderer;
        this._container.appendChild(renderer.domElement);
        this._container.appendChild(css3DRenderer.domElement);

        this.modules = this.initModules();

        this.loadEnv({ setBg: true });

        this.renderer.setAnimationLoop(this.animate.bind(this));

        this.resize = this.onResize();
        this.resize();
    }

    get container(): HTMLElement {
        return this._container;
    }

    set container(container: HTMLElement) {
        this._container.removeChild(this.renderer.domElement);

        if (this.resizeObserver) {
            this.resizeObserver.unobserve(this._container);
            this.resizeObserver.disconnect();
        }

        this._container = container;

        this._container.appendChild(this.renderer.domElement);

        this.resize = this.onResize();
    }

    basicCreation() {
        const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100 * 1000);
        camera.name = "Camera";
        camera.position.set(0, 5, 10);
        camera.lookAt(new THREE.Vector3());

        const scene = new THREE.Scene();
        scene.name = "Scene";

        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: false,
            powerPreference: "high-performance",
        });
        renderer.autoClear = false;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.autoUpdate = false;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.xr.enabled = false;
        renderer.setClearColor(0x272727, 1);
        renderer.setPixelRatio(Math.max(Math.ceil(window.devicePixelRatio), 1));
        renderer.setSize(this._container.offsetWidth, this._container.offsetHeight);

        const css3DRenderer = new CSS3DRenderer();
        css3DRenderer.setSize(this._container.offsetWidth, this._container.offsetHeight);
        css3DRenderer.domElement.setAttribute("id", "astral-3d-preview-css3DRenderer");
        css3DRenderer.domElement.style.position = 'absolute';
        css3DRenderer.domElement.style.top = '0px';
        css3DRenderer.domElement.style.pointerEvents = 'none';

        return { camera, scene, renderer, css3DRenderer };
    }

    /**
     * 初始化功能模块
     */
    initModules(): PreviewerModules {
        const controls = new CameraControls(this.camera, this.renderer.domElement);
        controls.addEventListener("update", () => { });

        return {
            controls,
            // 粒子系统
            particleSystem: new ParticleSystem(this),
            // 3d tiles管理器
            tilesManage: new TilesManage(this.scene, this.camera, this.renderer),
        }
    }

    /**
     * 加载默认环境和背景
     */
    loadEnv(
        options?: {
            setBg?: boolean,
            extension?: string,
            onLoad?: (texture: THREE.Texture) => void,
            onError?: (error: Error) => void
        }
    ) {
        if (!this.options.hdr) return;

        const params = Object.assign({
            setBg: true,
            extension: this.options.hdr.split(".").pop()?.toLowerCase() || 'hdr'
        }, options)

        Loader.loadUrlTexture(params.extension, this.options.hdr, (texture: THREE.Texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            this.scene.environment = texture;
            params.setBg && (this.scene.background = texture);

            this.render();

            params.onLoad && params.onLoad(texture)
        }, (err) => params.onError && params.onError(err));
    }

    /**
     * 加载预览项
     */
    load(fileOrUrl: string | File, type: string = "Model") {
        return new Promise(async (resolve, reject) => {
            this.clear();

            let file = fileOrUrl;
            if (!(fileOrUrl instanceof File) && !["Texture", "Billboard", "HDR", "Tiles"].includes(type)) {
                const response = await fetch(fileOrUrl);
                if (!response.ok) {
                    reject('The network is responding abnormally');
                    return;
                }

                const filename = fileOrUrl.substring(fileOrUrl.lastIndexOf("/") + 1);

                const blob = await response.blob();
                file = new File([blob], filename, { type: blob.type });
            }

            switch (type) {
                case "Model":
                    Loader.loadFile(file, new THREE.LoadingManager(), null, false).then((model) => {
                        this.scene.add(model);
                        focusObject(model, this.modules.controls);

                        resolve(model);
                    }).catch(error => {
                        reject(error);
                    })
                    break;
                case "Material":
                    parseMaterialZip(file as File)
                        .then((material) => {
                            const geometry = new THREE.SphereGeometry(1, 32, 32, 0, Math.PI * 2, 0, Math.PI);
                            const mesh = new THREE.Mesh(geometry, material);
                            this.scene.add(mesh);

                            focusObject(mesh, this.modules.controls);

                            resolve(mesh);
                        })
                        .catch(error => {
                            reject(error);
                        })
                    break;
                case "Texture":
                    let mapPath = file;
                    if (file instanceof File) {
                        mapPath = URL.createObjectURL(file);
                    }

                    const geometry = new THREE.PlaneGeometry(1, 1);
                    const material = new THREE.MeshStandardMaterial({
                        side: THREE.DoubleSide,
                        map: new THREE.TextureLoader().load(mapPath as string, (texture) => {
                            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                            texture.repeat.set(1, 1);
                            if (file instanceof File) {
                                URL.revokeObjectURL(mapPath as string)
                            }

                            const panel = new THREE.Mesh(geometry, material);

                            this.scene.add(panel);
                            focusObject(panel, this.modules.controls);

                            resolve(panel);
                        }, undefined, (err) => reject(err))
                    });

                    break;
                case "Billboard":
                    const _ops = getDefaultBillboardOptions();
                    _ops.image.visible = true;
                    _ops.image.position = POSITION.LEFT;
                    if (file instanceof File) {
                        _ops.name = file.name;
                        _ops.image.url = URL.createObjectURL(file);
                    } else {
                        _ops.name = file.substring(file.lastIndexOf("/") + 1);
                        _ops.image.url = file;
                    }

                    const billboard = new Billboard(_ops);

                    const handleBillboardImgLoaded = () => {
                        if (file instanceof File) {
                            URL.revokeObjectURL(_ops.image.url);
                        }

                        billboard.removeEventListener("imgLoaded", handleBillboardImgLoaded);
                    }
                    billboard.addEventListener("imgLoaded", handleBillboardImgLoaded);

                    this.scene.add(billboard);
                    focusObject(billboard, this.modules.controls);

                    resolve(billboard);
                    break;
                case "HDR":
                    let hdrPath = file, extension = "hdr";
                    if (file instanceof File) {
                        hdrPath = URL.createObjectURL(file);
                        extension = file.name.split(".").pop()?.toLowerCase() || "hdr"
                    } else {
                        extension = file.split(".").pop()?.toLowerCase() || "hdr";
                    }

                    this.options.hdr = hdrPath as string;
                    this.loadEnv({
                        setBg: true,
                        extension: extension,
                        onLoad: (texture) => {
                            if (file instanceof File) {
                                URL.revokeObjectURL(hdrPath as string);
                            }

                            resolve(texture);
                        },
                        onError: (error) => {
                            if (file instanceof File) {
                                URL.revokeObjectURL(hdrPath as string);
                            }

                            reject(error)
                        }
                    })
                    break;
                case "Tiles":
                    if (fileOrUrl instanceof File) {
                        reject();
                        return;
                    }
                    if (!fileOrUrl.includes("tileset.json")) {
                        fileOrUrl = `${fileOrUrl}/tileset.json`;
                    }
                    const tiles = new Tiles({
                        url: fileOrUrl,
                        name: "AstralPreviewTiles",
                        reset2origin: true,
                    })
                    this.addTiles(tiles).then(() => {
                        this.modules.controls.fitToBox(tiles, true);
                    })

                    resolve(tiles);
                    break;
                default:
                    reject("A type for which previews are not yet supported");
                    break;
            }

            this.render();
        })
    }

    /**
     * 监听视窗变化（节流）
     */
    onResize() {
        const resize = () => {
            this.camera.aspect = this._container.offsetWidth / this._container.offsetHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(this._container.offsetWidth, this._container.offsetHeight);
        }

        let timer: NodeJS.Timeout | null = null;
        this.resizeObserver = new ResizeObserver(() => {
            if (timer) return;
            timer = setTimeout(() => {
                resize();

                timer = null;
            }, 16)
        });
        this.resizeObserver.observe(this._container);

        return resize;
    }

    /**
     * 清空场景
     */
    clear() {
        for (let i = this.scene.children.length - 1; i >= 0; i--) {
            const child = this.scene.children[i];
            if (!child.parent || child.ignore) continue;

            child.parent.remove(child);
        }

        this.render();
    }

    animate() {
        this.timer.update();

        const delta = this.timer.getDelta();

        // let needRender = this.modules.controls.update(delta);
        this.modules.controls.update(delta);

        this.modules.particleSystem.update(delta);
        // if (this.modules.particleSystem.needsUpdate) {
        //     needRender = true;
        // }

        // 3dTiles渲染
        this.modules.tilesManage.update()
        // if(this.modules.tilesManage.update()){
        //     needRender = true;
        // }

        // if (needRender) this.render();
        this.render();
    }

    render() {
        this.dispatchEvent({ type: 'beforeRender' });

        this.renderer.autoClear = false;

        this.renderer.render(this.scene, this.camera);

        this.css3DRenderer.render(this.scene, this.camera);

        this.renderer.autoClear = true;

        this.dispatchEvent({ type: 'afterRender' });
    }

    /**
     * 销毁
     */
    dispose() {
        this.resizeObserver?.unobserve(this._container);
        this.resizeObserver?.disconnect();

        Object.keys(this.modules).forEach(key => {
            if (this.modules[key].dispose) {
                this.modules[key].dispose();
            }
        })

        this.modules.controls.disconnect();

        this.clear();
        this.scene.background = null;
        this.scene.environment = null;

        this._container.removeChild(this.renderer.domElement);

        this.renderer.setAnimationLoop(null);
        this.renderer.dispose();
        // @ts-ignore
        this.renderer = null;

        // @ts-ignore 清空EventDispatcher监听
        if (this._listeners) {
            // @ts-ignore
            Object.keys(this._listeners).forEach(type => {
                // @ts-ignore
                this._listeners[type].forEach(listener => {
                    // @ts-ignore
                    this.removeEventListener(type, listener);
                })
            })
        }
    }

    /* -----------------暂时放在Preview下的工具方法-------------------- */

    /**
     * 添加粒子
     * @emitter 粒子发射器
     * @body 粒子主体
     */
    addParticle(emitter: Emitter, body: THREE.Sprite | THREE.Mesh, name: string = "Particles") {
        const particleEmitter = new ParticleEmitter(emitter);
        particleEmitter.name = name;

        ParticleSystem.Body3DMap.set(particleEmitter.uuid, body);

        this.modules.particleSystem.spriteSystem.addEmitter(emitter);

        this.scene.add(particleEmitter);

        return particleEmitter;
    }

    /**
     * 添加瓦片
     */
    addTiles(tiles: Tiles) {
        return new Promise(resolve => {
            tiles.setCameraAndRenderer(this.camera, this.renderer);

            this.modules.tilesManage.addTiles(tiles).then(tiles => {
                resolve(tiles);
            })

            this.scene.add(tiles);
        })
    }

    /**
     * 移除瓦片
     */
    removeTiles(tiles: Tiles) {
        this.scene.remove(tiles);

        this.modules.tilesManage.removeTiles(tiles);
    }

    /**
     * 获取画布的截屏图片
     * @returns Promise<HTMLImageElement> 截屏的图片对象
     */
    getViewportImage() {
        return new Promise<HTMLImageElement>((resolve, rejcet) => {
            // @ts-ignore
            const _preserveDrawingBuffer = this.renderer.getContext().preserveDrawingBuffer;
            // @ts-ignore
            this.renderer.getContext().preserveDrawingBuffer = true;
            this.render();

            this.renderer.domElement.toBlob((blob) => {
                if (blob === null) {
                    rejcet('Screenshots fail');
                    return;
                }

                const image = new Image();
                image.src = URL.createObjectURL(blob);

                // @ts-ignore
                this.renderer.getContext().preserveDrawingBuffer = _preserveDrawingBuffer;
                this.render();

                resolve(image);
            });
        });
    }
}