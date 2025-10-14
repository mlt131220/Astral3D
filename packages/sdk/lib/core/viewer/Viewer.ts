import * as THREE from 'three';
import CameraControls from 'camera-controls';
import { Timer } from 'three/examples/jsm/misc/Timer.js';
import { CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer";
import { CSS3DRenderer } from "three/examples/jsm/renderers/CSS3DRenderer.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import App from "../app/App";
import { ViewerOptions } from "./ViewerOptions";
import { PluginManager } from "#/core/plugin/plugin";
import {
    Helper,
    CameraManage,
    Effect,
    Weather,
    Signals,
    ParticleSystem,
    Drag,
    TilesManage,
} from "./modules";
import { ShaderMaterialManager } from "#/core/shaderMaterial/ShaderMaterialManager";
import { deepAssign, getMousePosition, isEmptyObject, isNil, createDivContainer } from "#/utils";
import { useDispatchSignal } from "#/hooks";
import {
    AddObjectCommand,
    RemoveObjectCommand,
    SetPositionCommand,
    SetRotationCommand,
    SetScaleCommand
} from "#/core/commands/Commands";
import { Emitter } from '#/core/libs/three-nebula';
import ParticleEmitter from "#/core/objects/ParticleEmitter.ts";
import { ViewerPathTracer } from "#/core/viewer/ViewerPathTracer.ts";
import { Helper as ScriptHelper } from "../script";
import Tiles from "../objects/Tile.ts";

export interface ViewerEventMap {
    // 场景加载完成时执行，仅执行一次
    loaded: {};

    // 场景当前动画帧循环开始之前触发，每一帧执行一次
    beforeAnimation: { delta: number };

    // 场景当前动画帧循环完成之后立即触发，每一帧执行一次
    afterAnimation: { delta: number, toBeRender: (_need: boolean) => void };

    // 场景当前动画帧循环完成之后渲染之前触发，每一次渲染执行一次
    beforeRender: { delta: number };

    // 场景当前帧渲染完成之后触发，每一次渲染执行一次
    afterRender: { delta: number };

    // 场景销毁前调用，仅执行一次
    beforeDestroy: {};

    // 场景销毁后调用，仅执行一次
    afterDestroy: {};

    // 模型单击事件
    onPick: { intersect: THREE.Intersection, object: THREE.Object3D };

    // 模型双击事件
    onDoubleClick: { intersect: THREE.Intersection, object: THREE.Object3D };

    // 键盘按下事件(全局)
    onKeyDown: { event: KeyboardEvent };

    // 键盘抬起事件(全局)
    onKeyUp: { event: KeyboardEvent };

    //指针按下事件(全局)
    onPointerDown: { event: PointerEvent };

    //指针抬起事件(全局)
    onPointerUp: { event: PointerEvent };

    //指针移动事件(全局)
    onPointerMove: { event: PointerEvent };

    //触屏按下事件(全局)
    onTouchStart: { event: TouchEvent };

    //触屏释放事件(全局)
    onTouchEnd: { event: TouchEvent };

    // 场景背景变更
    onSceneBackgroundChange: {
        backgroundType: '' | 'Color' | 'Texture' | 'Equirectangular',
        background: null | THREE.Color | THREE.Texture
    }

    // 场景环境变更
    onSceneEnvironmentChange: {
        environmentType: '' | 'Background' | 'Equirectangular' | 'ModelViewer',
        environment: null | THREE.Texture
    }
}

export interface ViewerModules {
    plugin: PluginManager,
    viewHelper: Helper,
    cameraManage: CameraManage,
    controls: CameraControls,
    transformControls?: TransformControls,
    effect: Effect,
    weather: Weather,
    registerSignal: Signals,
    shaderMaterialManager: ShaderMaterialManager,
    particleSystem: ParticleSystem,
    dragControl: Drag,
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

const onDownPosition = new THREE.Vector2();
const onUpPosition = new THREE.Vector2();
const onDoubleClickPosition = new THREE.Vector2();

// 表示animate()函数被多次调用累积时间,用于限制FPS
let timeStamp = 0;

// 事件绑定
const Fn: any = {
    pointerdown: null,
    pointerup: null,
    pointermove: null,
    keydown: null,
    keyup: null,
    touchstart: null,
    dblclick: null,
}

// 脚本管理数据结构
type EventHandlers = {
    [eventName: string]: {
        [uuid: string]: Function[];
    };
};
// 脚本中可写的所有事件
let events: EventHandlers = {
    loaded: {},
    beforeAnimation: {},
    afterAnimation: {},
    beforeRender: {},
    afterRender: {},
    beforeDestroy: {},
    afterDestroy: {},
    onPick: {},
    onDoubleClick: {},
    onKeyDown: {},
    onKeyUp: {},
    onPointerDown: {},
    onPointerUp: {},
    onPointerMove: {},
    onTouchStart: {},
    onTouchEnd: {},
};
// UUID 到事件的映射
const uuidEventMap: Map<string, Map<string, { name: string, fn: Function }[]>> = new Map();

export default class Viewer extends THREE.EventDispatcher<ViewerEventMap> {
    public container: HTMLElement;
    public options: IViewerSetting;
    public renderer: THREE.WebGLRenderer;
    public camera: THREE.PerspectiveCamera;
    public scene: THREE.Scene;
    public sceneHelpers: THREE.Scene;
    public grid: THREE.Group | undefined;
    public box: THREE.Box3 = new THREE.Box3();
    public selectionBox: THREE.Box3Helper;
    public raycaster: THREE.Raycaster;
    public pmremGenerator: THREE.PMREMGenerator | null = null;
    public pathtracer: ViewerPathTracer | undefined;
    public modules: ViewerModules;
    public showSceneHelpers: boolean = true;

    public css2DRenderer: CSS2DRenderer = new CSS2DRenderer();
    public css3DRenderer: CSS3DRenderer = new CSS3DRenderer();
    public timer = new Timer();
    //整个主场景的box3
    public sceneBox3 = new THREE.Box3();

    constructor(options: IViewerSetting) {
        super();

        App.viewer = this;

        this.container = options.container || createDivContainer();

        this.options = ViewerOptions();
        deepAssign(this.options, options);

        this.camera = App.camera;
        this.scene = App.scene;
        this.sceneHelpers = App.sceneHelpers;

        this.renderer = this.createEngine();

        this.modules = this.initModules();

        /** helpers **/
        if (this.options.grid.enabled) {
            this.grid = new THREE.Group();
            this.grid.ignore = true;
            this.initGrid();
            this.scene.add(this.grid);
        }

        //选中时的包围框
        this.selectionBox = new THREE.Box3Helper(this.box);
        (this.selectionBox.material as THREE.Material).depthTest = false;
        (this.selectionBox.material as THREE.Material).transparent = true;
        this.selectionBox.visible = false;
        this.sceneHelpers.add(this.selectionBox as THREE.Object3D);

        // 拾取对象
        this.raycaster = new THREE.Raycaster();
        //Raycaster 将只从它遇到的第一个对象中获取信息
        this.raycaster.firstHitOnly = true;

        this.engineCreated(this.renderer)

        this.loadEnv(true);

        this.initEvent();

        //监听视窗变化（节流）
        let timer: NodeJS.Timeout | null = null;
        const resizeObserver = new ResizeObserver(() => {
            if (timer) return;
            timer = setTimeout(() => {
                useDispatchSignal("sceneResize", this.container.offsetWidth, this.container.offsetHeight);
                timer = null;
            }, 16)
        });
        resizeObserver.observe(this.container);

        useDispatchSignal("viewerInitCompleted", this);
    }

    /**
     * 获取是否启用编辑态
     */
    get enableEdit(): boolean {
        return this.options.enableEdit || false;
    }

    /**
     * 设置编辑态是否启用
     * @param enable
     */
    set enableEdit(enable: boolean) {
        if (enable === this.enableEdit) return;

        if (enable) {
            let objectPositionOnDown = new THREE.Vector3();
            let objectRotationOnDown = new THREE.Euler();
            let objectScaleOnDown = new THREE.Vector3();
            const transformControls = new TransformControls(this.camera, this.container);
            transformControls.addEventListener("change", () => {
                const object = transformControls.object;

                if (object !== undefined) {
                    this.box.setFromObject(object, true);

                    useDispatchSignal("objectChanged", object);
                }

                this.render();
            })
            transformControls.addEventListener("mouseDown", () => {
                const object = transformControls.object as THREE.Object3D;

                objectPositionOnDown = object.position.clone();
                objectRotationOnDown = object.rotation.clone();
                objectScaleOnDown = object.scale.clone();

                this.modules.controls.enabled = false;
            })
            transformControls.addEventListener("mouseUp", () => {
                const object = transformControls.object as THREE.Object3D;

                if (object !== undefined) {
                    switch (transformControls.getMode()) {
                        case 'translate':
                            if (!objectPositionOnDown.equals(object.position)) {
                                App.execute(new SetPositionCommand(object, object.position, objectPositionOnDown));
                            }
                            break;
                        case 'rotate':
                            if (!objectRotationOnDown.equals(object.rotation)) {
                                App.execute(new SetRotationCommand(object, object.rotation, objectRotationOnDown));
                            }
                            break;
                        case 'scale':
                            if (!objectScaleOnDown.equals(object.scale)) {
                                App.execute(new SetScaleCommand(object, object.scale, objectScaleOnDown));
                            }
                            break;
                    }
                }
                this.modules.controls.enabled = true;
            })
            const gizmo = transformControls.getHelper();
            this.sceneHelpers.add(gizmo);

            this.modules.transformControls = transformControls;
        } else {
            if (!this.modules.transformControls) return;

            const gizmo = this.modules.transformControls.getHelper();
            this.sceneHelpers.remove(gizmo);

            this.modules.transformControls.dispose();

            this.modules.transformControls = undefined;
        }
    }

    /**
     * 获取是否启用脚本运行
     */
    get enableScript() {
        return this.options.enableScript || false;
    }

    /**
     * 设置是否启用脚本运行
     */
    set enableScript(enable: boolean) {
        if (enable === this.enableScript) return;

        if (enable) {
            this.installScripts();
        } else {
            this.unInstallScripts();
        }
    }

    /**
     * 创建默认渲染引擎
     */
    createEngine() {
        const renderConfig = App.project.getKey("renderer");
        const renderer = new THREE.WebGLRenderer({
            antialias: renderConfig.antialias,
            alpha: true,
            preserveDrawingBuffer: false,
            powerPreference: "high-performance",
        });

        renderer.autoClear = false;
        renderer.setClearColor(0x272727, 1);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = renderConfig.toneMapping;
        renderer.toneMappingExposure = renderConfig.toneMappingExposure;
        renderer.shadowMap.enabled = renderConfig.shadow.enabled;
        renderer.shadowMap.type = renderConfig.shadow.type;
        renderer.xr.enabled = App.project.getKey("xr");

        this.modules && this.engineCreated(renderer);

        return renderer;
    }

    /**
     * 创建渲染引擎后
     * @param newRenderer
     */
    engineCreated(newRenderer: THREE.WebGLRenderer) {
        if (this.renderer && this.renderer !== newRenderer) {
            this.renderer.setAnimationLoop(null);
            this.renderer.dispose();

            this.pmremGenerator?.dispose();
            this.pmremGenerator = null;

            this.modules.controls.disconnect();
            this.container.removeChild(this.renderer.domElement);

            this.modules.viewHelper.dispose();
        }

        this.renderer = newRenderer;

        this.renderer.setAnimationLoop(this.animate.bind(this));
        this.renderer.setPixelRatio(Math.max(Math.ceil(window.devicePixelRatio), 1));
        this.renderer.setSize(this.container.offsetWidth, this.container.offsetHeight);

        if (this.scene.environment && this.scene.environment.isRenderTargetTexture) {
            useDispatchSignal("sceneEnvironmentChanged", 'ModelViewer');
            useDispatchSignal("sceneGraphChanged");
        }

        this.pathtracer = new ViewerPathTracer(newRenderer);

        // 在container中最前面插入渲染器的dom元素
        this.container.insertBefore(newRenderer.domElement, this.container.firstChild);

        // 控制器绑定
        this.modules.controls.connect(newRenderer.domElement);

        // 初始化后处理
        this.modules.effect.createComposer();

        this.modules.viewHelper.init();

        // 防止重复添加
        if (this.css2DRenderer.domElement.parentNode !== this.container) {
            this.css2DRenderer.setSize(this.container.offsetWidth, this.container.offsetHeight);
            this.css2DRenderer.domElement.setAttribute("id", "astral-3d-css2DRenderer");
            this.css2DRenderer.domElement.style.position = 'absolute';
            this.css2DRenderer.domElement.style.top = '0px';
            this.css2DRenderer.domElement.style.pointerEvents = 'none';

            this.container.appendChild(this.css2DRenderer.domElement);
        }
        if (this.css3DRenderer.domElement.parentNode !== this.container) {
            this.css3DRenderer.setSize(this.container.offsetWidth, this.container.offsetHeight);
            this.css3DRenderer.domElement.setAttribute("id", "astral-3d-css3DRenderer");
            this.css3DRenderer.domElement.style.position = 'absolute';
            this.css3DRenderer.domElement.style.top = '0px';
            this.css3DRenderer.domElement.style.pointerEvents = 'none';

            this.container.appendChild(this.css3DRenderer.domElement);
        }

        useDispatchSignal("rendererUpdated");
    }

    /**
     * 初始化网格
     * @protected
     */
    initGrid() {
        if (!this.grid) {
            this.grid = new THREE.Group();
            this.grid.ignore = true;
            this.scene.add(this.grid);
        }

        if (this.grid.children.length > 0) {
            this.grid.children.forEach((child: THREE.Object3D) => {
                child.dispose();
            });
            this.grid.children = [];
        }

        const grid = new THREE.GridHelper(this.options.grid.row, this.options.grid.column, parseInt(App.config.getKey('mainColor').slice(1), 16), this.options.grid.color);
        this.grid.add(grid);

        this.render();
    }

    /**
     * 初始化功能模块
     */
    initModules() {
        const controls = new CameraControls(this.camera);
        controls.addEventListener("update", () => {
            useDispatchSignal("cameraChanged", this.camera, controls);
        });

        const modules: ViewerModules = {
            // 插件系统
            plugin: new PluginManager(),
            viewHelper: new Helper(this, controls),
            cameraManage: new CameraManage(this, controls),
            controls,
            effect: new Effect(this),
            weather: new Weather(this),
            // 注册signal
            registerSignal: new Signals(this),
            shaderMaterialManager: new ShaderMaterialManager(),
            // 粒子系统
            particleSystem: new ParticleSystem(this),
            // 拖拽
            dragControl: new Drag(this),
            // 3d tiles管理器
            tilesManage: new TilesManage(this.scene, this.camera, this.renderer),
        }

        if (this.enableEdit) {
            let objectPositionOnDown = new THREE.Vector3();
            let objectRotationOnDown = new THREE.Euler();
            let objectScaleOnDown = new THREE.Vector3();
            const transformControls = new TransformControls(this.camera, this.container);
            transformControls.addEventListener("change", () => {
                const object = transformControls.object;

                if (object !== undefined) {
                    this.box.setFromObject(object, true);

                    useDispatchSignal("objectChanged", object);
                }

                this.render();
            })
            transformControls.addEventListener("mouseDown", () => {
                const object = transformControls.object as THREE.Object3D;

                objectPositionOnDown = object.position.clone();
                objectRotationOnDown = object.rotation.clone();
                objectScaleOnDown = object.scale.clone();

                this.modules.controls.enabled = false;
            })
            transformControls.addEventListener("mouseUp", () => {
                const object = transformControls.object as THREE.Object3D;

                if (object !== undefined) {
                    switch (transformControls.getMode()) {
                        case 'translate':
                            if (!objectPositionOnDown.equals(object.position)) {
                                App.execute(new SetPositionCommand(object, object.position, objectPositionOnDown));
                            }
                            break;
                        case 'rotate':
                            if (!objectRotationOnDown.equals(object.rotation)) {
                                App.execute(new SetRotationCommand(object, object.rotation, objectRotationOnDown));
                            }
                            break;
                        case 'scale':
                            if (!objectScaleOnDown.equals(object.scale)) {
                                App.execute(new SetScaleCommand(object, object.scale, objectScaleOnDown));
                            }
                            break;
                    }
                }
                this.modules.controls.enabled = true;
            })
            const gizmo = transformControls.getHelper();
            this.sceneHelpers.add(gizmo);

            modules.transformControls = transformControls;
        }

        return modules;
    }

    /**
     * 加载默认环境和背景
     */
    loadEnv(setBg: boolean = true, onLoad?: (texture: THREE.Texture) => void, onError?: (error: Error) => void) {
        if (!this.options.hdr) return;

        App.resource.loadURLTexture(this.options.hdr, (texture: THREE.Texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            this.scene.environment = texture;
            setBg && (this.scene.background = texture);

            useDispatchSignal("sceneGraphChanged");

            onLoad && onLoad(texture)
        }, (err) => onError && onError(err))
    }

    /**
     * 初始化事件监听
     */
    initEvent() {
        Fn.pointerdown = this.onPointerDown.bind(this);
        this.container.addEventListener('pointerdown', Fn.pointerdown);
        Fn.pointermove = this.onPointerMove.bind(this);
        this.container.addEventListener('pointermove', Fn.pointermove);
        Fn.touchstart = this.onTouchStart.bind(this);
        this.container.addEventListener('touchstart', Fn.touchstart);
        Fn.dblclick = this.onDoubleClick.bind(this)
        this.container.addEventListener('dblclick', Fn.dblclick);
    }

    /**
     * 组装脚本（支持热更新）
     * @param uuids 传入此参数则仅组装此数组下Object.uuid的脚本
     * @param filterName 传入此参数则仅组装此数组下Object.uuid的脚本中name匹配的脚本
     */
    installScripts(uuids?: string | string[], filterName: string = "") {
        if (!this.enableScript) return;

        // 注册 Helper
        const helper = new ScriptHelper(this.scene);

        // 定义注入的参数名
        let scriptWrapParams = 'THREE,helper,renderer,scene,camera,controls,timer,render';
        // 定义返回的结构
        const scriptWrapResultObj = {};
        // 注入的函数绑定this
        const fns = {
            render: this.render.bind(this)
        }

        // 拼接下方闭包函数返回的结构，即返回脚本中写的支持的事件函数
        const validEvents = Object.keys(events);

        // 准备返回结构
        validEvents.forEach(eventName => {
            scriptWrapParams += ',' + eventName;
            scriptWrapResultObj[eventName] = eventName;
        });

        // scriptWrapResultObj是json，会包含双引号，但是后面拼接闭包函数的返回结果里面不能有双引号，因为这些值都会解析为变量
        const scriptWrapResult = JSON.stringify(scriptWrapResultObj).replace(/"/g, '');

        // 处理特定 UUID（热更新）
        const processUuid = (uuid: string) => {
            // 先卸载旧脚本
            this.uninstallScriptsByUuid(uuid, filterName);

            const object = this.scene.getObjectByProperty('uuid', uuid);
            if (!object) {
                App.log.warn(`[Script] 不存在uuid为${uuid}的对象`);
                return;
            }

            // 一个模型允许存在多个脚本
            const scripts = App.scripts[uuid] || [];
            const uuidEvents = uuidEventMap.get(uuid) || new Map<string, { name: string, fn: Function }[]>();

            scripts.forEach(script => {
                // 如果存在需要按照name过滤
                if (filterName && filterName !== script.name) return;

                const functions = new Function(
                    scriptWrapParams,
                    `${script.source}\nreturn ${scriptWrapResult};`
                ).bind(object)(
                    THREE, helper, this.renderer, this.scene,
                    this.camera, this.modules.controls, this.timer, fns.render
                );

                Object.entries(functions).forEach(([name, fn]) => {
                    if (!fn || !validEvents.includes(name)) {
                        if (fn && !validEvents.includes(name)) {
                            App.log.warn(`[Script] 不支持的事件类型：${name}`);
                        }
                        return;
                    }

                    const boundFn = (e: any) => {
                        const { type, target, ...params } = e;

                        // 点击事件只分发给对应模型
                        if (["onPick", "onDoubleClick"].includes(name)) {
                            const { intersect, object: _object } = params;

                            if (_object.uuid !== object.uuid) return;

                            (fn as Function).bind(object)(intersect as THREE.Intersection);
                        } else {
                            if (isEmptyObject(params)) {
                                (fn as Function).bind(object)();
                            } else {
                                (fn as Function).bind(object)(...Object.values(params));
                            }
                        }
                    }

                    // 添加到全局事件集合
                    if (!events[name][uuid]) events[name][uuid] = [];
                    events[name][uuid].push(boundFn);

                    // 添加到 UUID 事件映射
                    if (!uuidEvents.has(name)) uuidEvents.set(name, []);
                    uuidEvents.get(name)!.push({
                        name: script.name,
                        fn: boundFn
                    });

                    // 添加事件监听
                    this.addEventListener(name as keyof ViewerEventMap, boundFn);
                });
            });

            // 更新 UUID 映射
            uuidEventMap.set(uuid, uuidEvents);
        };

        // 处理指定 UUID 或全部
        if (uuids) {
            (Array.isArray(uuids) ? uuids : [uuids]).forEach(processUuid);
        } else {
            Object.keys(App.scripts).forEach(processUuid);
        }

        if (!Fn.keydown) {
            Fn.keydown = (event: KeyboardEvent) => {
                this.dispatchEvent({ type: "onKeyDown", event })
            }
            window.addEventListener('keydown', Fn.keydown);
            Fn.keyup = (event: KeyboardEvent) => {
                this.dispatchEvent({ type: "onKeyUp", event })
            }
            window.addEventListener('keyup', Fn.keyup);
        }
    }

    /**
     * 按 object UUID 卸载脚本（热更新用）
     * @param uuid 传入此参数则仅卸载此Object.uuid的脚本
     * @param filterName 传入此参数则仅卸载此Object.uuid的脚本中name匹配的脚本
     */
    uninstallScriptsByUuid(uuid: string, filterName: string = "") {
        if (!uuidEventMap.has(uuid)) return;

        const uuidEvents = uuidEventMap.get(uuid)!;

        const uuidEventsArray = Array.from(uuidEvents);
        for (let i = uuidEventsArray.length - 1; i >= 0; i--) {
            const [eventName, scripts] = uuidEventsArray[i];

            // 移除事件监听
            for (let i = scripts.length - 1; i >= 0; i--) {
                const sc = scripts[i];

                if (filterName && filterName !== sc.name) continue;

                // @ts-ignore
                this.removeEventListener(eventName as keyof ViewerEventMap, sc.fn);

                // 从uuidEventMap 移除
                scripts.splice(i, 1);
                if (scripts.length === 0) {
                    uuidEvents.delete(eventName);
                }

                // 全局事件集合
                const es = events[eventName][uuid];
                // 移除相应函数
                const ei = es.findIndex(f => f === sc.fn);
                if (ei !== -1) {
                    es.splice(ei, 1);
                }

                if (es.length === 0) {
                    delete events[eventName][uuid];
                }
            }
        }

        // 清理 UUID 映射
        if (Array.from(uuidEvents.keys()).length === 0) {
            uuidEventMap.delete(uuid);
        }
    }

    /**
     * 卸载所有脚本
     */
    unInstallScripts() {
        if (this.enableScript) return;

        // 直接遍历 UUID 映射，复杂度 O(n)
        uuidEventMap.forEach((_, uuid) => {
            this.uninstallScriptsByUuid(uuid);
        });

        // 重置数据结构
        uuidEventMap.clear();
        Object.keys(events).forEach(event => {
            events[event] = {};
        });

        if (Fn.keydown) {
            window.removeEventListener('keydown', Fn.keydown);
            Fn.keydown = null;

            window.removeEventListener('keyup', Fn.keyup);
            Fn.keyup = null;
        }
    }

    /**
     * 加载离线场景包
     */
    loadOfflineScene() {
        // const requestConfig = App.config.getKey('request');
        // const packageUrl = `${requestConfig.baseUrl}/${requestConfig.sceneId}`;
    }

    /**
     * 计算整个场景的Box3
     */
    computedSceneBox3() {
        this.sceneBox3.setFromObject(this.scene);
    }

    /**
     * 更新相机宽高比
     */
    updateAspectRatio() {
        for (const uuid in App.cameras) {
            const camera = App.cameras[uuid];

            const aspect = this.container.offsetWidth / this.container.offsetHeight;

            if (camera.isPerspectiveCamera) {
                (<THREE.PerspectiveCamera>camera).aspect = aspect;
            }

            camera.updateProjectionMatrix();

            const cameraHelper = App.helpers[camera.id];
            if (cameraHelper) cameraHelper.update();
        }
    }

    /**
     * 获取射线选中
     * @param point
     */
    getIntersects(point: THREE.Vector2) {
        const mouse = new THREE.Vector2();
        mouse.set((point.x * 2) - 1, -(point.y * 2) + 1);
        this.raycaster.setFromCamera(mouse, this.camera);

        const objects: THREE.Object3D[] = [];
        (App.locked ? App.locked : this.scene).traverseByCondition((child) => {
            this.camera.layers.test(child.layers) && objects.push(child);
        }, (child) => !child.ignore && child.visible);

        this.sceneHelpers.traverseVisible((child) => {
            if (child.name === 'picker') {
                this.camera.layers.test(child.layers) && objects.push(child);
            }
        });

        // 粒子
        this.modules.particleSystem.particlesGroup.traverse((child) => {
            if (!this.camera.layers.test(child.layers)) return;

            if (child.children.length === 0) {
                if (App.locked) {
                    child.proxy?.isAncestor(App.locked) && objects.push(child);
                } else {
                    objects.push(child);
                }
            }
        });

        return this.raycaster.intersectObjects(objects, false);
    }

    /**
     * 处理点击
     */
    handleClick() {
        if (onDownPosition.distanceTo(onUpPosition) === 0) {
            const intersects = this.getIntersects(onUpPosition);
            useDispatchSignal("intersectionsDetected", intersects);

            if (intersects.length > 0) {
                let object = intersects[0].object;

                if (object.proxy) {
                    object = object.proxy;
                }

                this.dispatchEvent({ type: "onPick", intersect: intersects[0], object });
            }

            this.render();
        }
    }

    /**
     * 处理鼠标按下
     * @param event
     */
    onPointerDown(event: PointerEvent) {
        this.dispatchEvent({ type: "onPointerDown", event });

        event.preventDefault();
        const array = getMousePosition(this.container, event.clientX, event.clientY);
        onDownPosition.fromArray(array);
        Fn.pointerup = this.onPointerUp.bind(this);
        document.addEventListener('pointerup', Fn.pointerup);
    }

    /**
     * 处理鼠标抬起
     * @param event
     */
    onPointerUp(event: PointerEvent) {
        this.dispatchEvent({ type: "onPointerUp", event });

        const array = getMousePosition(this.container, event.clientX, event.clientY);
        onUpPosition.fromArray(array);
        this.handleClick();
        document.removeEventListener('pointerup', Fn.pointerup);
        Fn.pointerup = null;
    }

    /**
     * 处理鼠标移动
     * @param event
     */
    onPointerMove(event: PointerEvent) {
        this.dispatchEvent({ type: "onPointerMove", event });
    }

    /**
     * 处理触屏按下
     * @param event
     */
    onTouchStart(event: TouchEvent) {
        this.dispatchEvent({ type: "onTouchStart", event });

        const touch = event.changedTouches[0];
        const array = getMousePosition(this.container, touch.clientX, touch.clientY);
        onDownPosition.fromArray(array);
        Fn.pointerup = this.onTouchEnd.bind(this);
        document.addEventListener('touchend', Fn.pointerup);
    }

    /**
     * 处理触屏释放
     * @param event
     */
    onTouchEnd(event: TouchEvent) {
        this.dispatchEvent({ type: "onTouchEnd", event });

        const touch = event.changedTouches[0];
        const array = getMousePosition(this.container, touch.clientX, touch.clientY);
        onUpPosition.fromArray(array);
        this.handleClick();
        document.removeEventListener('touchend', Fn.pointerup);
        Fn.pointerup = null;
    }

    /**
     * 处理双击
     * @param event
     */
    onDoubleClick(event: PointerEvent) {
        const array = getMousePosition(this.container, event.clientX, event.clientY);
        onDoubleClickPosition.fromArray(array);
        const intersects = this.getIntersects(onDoubleClickPosition);
        if (intersects.length > 0) {
            let object = intersects[0].object;
            useDispatchSignal("objectFocused", object);

            if (object.proxy) {
                object = object.proxy;
            }

            this.dispatchEvent({ type: "onDoubleClick", intersect: intersects[0], object });
        }
    }

    /**
     * 循环动画
     */
    animate() {
        this.timer.update();

        const delta = this.timer.getDelta();

        timeStamp += delta;

        if (timeStamp < App.singleFrameTime) return;

        this.dispatchEvent({ type: 'beforeAnimation', delta: timeStamp });

        let needRender = App.animationManager.update(timeStamp);
        if (needRender) {
            if (App.selected !== null && App.selected.animations.length > 0) {
                // 避免某些蒙皮网格的帧延迟效应(e.g. Michelle.glb)
                App.selected.updateWorldMatrix(false, true);

                if (!this.modules.effect.enabled) {
                    //  选择框应反映当前动画状态
                    this.selectionBox.box.setFromObject(App.selected, true);
                }
            }
        }

        if (this.modules.controls.enabled && !this.modules.viewHelper.animating) {
            needRender = this.modules.controls.update(timeStamp) || needRender;
        }

        if (this.modules.weather.update(timeStamp)) {
            needRender = true;
        }

        this.modules.shaderMaterialManager.update();
        if (this.modules.shaderMaterialManager.needRender) {
            needRender = true;
        }

        this.modules.particleSystem.update(timeStamp);
        if (this.modules.particleSystem.needsUpdate) {
            needRender = true;
        }

        if (this.modules.dragControl.isDragging) {
            needRender = true;
        }

        if (this.renderer?.xr.isPresenting) {
            needRender = true;
        }

        // 3dTiles渲染
        if (this.modules.tilesManage.update()) {
            needRender = true;
        }

        this.dispatchEvent({
            type: 'afterAnimation', delta: timeStamp, toBeRender: (_needRender: boolean = false) => {
                needRender = _needRender;
            }
        });

        if (needRender) this.render(timeStamp);

        this.updatePT();

        // console.log(`调用.animate时间间隔${timeStamp*1000}毫秒,delta:${delta}`);
        // 剩余的时间合并进入下次的判断计算
        timeStamp = App.singleFrameTime ? (timeStamp % App.singleFrameTime) : 0;
    }

    /**
     * 初始化光线路径追踪模拟
     */
    initPT() {
        if (App.viewportShading === 'realistic') {
            this.pathtracer?.init(this.scene, this.camera);
        }
    }

    updatePTBackground() {
        if (App.viewportShading === 'realistic') {
            this.pathtracer?.setBackground();
        }
    }

    updatePTEnvironment() {
        if (App.viewportShading === 'realistic') {
            this.pathtracer?.setEnvironment();
        }
    }

    updatePTMaterials() {
        if (App.viewportShading === 'realistic') {
            this.pathtracer?.updateMaterials();
        }
    }

    updatePT() {
        if (App.viewportShading === 'realistic') {
            this.pathtracer?.update();
            useDispatchSignal("pathTracerUpdated", this.pathtracer?.getSamples())
        }
    }

    /**
     * 渲染场景帧
     */
    render(delta?: number) {
        if (!this.renderer) return;

        if (isNil(delta)) {
            delta = this.timer.getDelta();
        }

        const startTime = performance.now();

        this.dispatchEvent({ type: 'beforeRender', delta: <number>delta });

        this.renderer.clearDepth();

        App.csm.update();

        if (this.modules.effect.enabled) {
            this.modules.effect.render(<number>delta);
        } else {
            this.renderer.render(this.scene, App.viewportCamera);
        }

        // 非默认相机不渲染辅助
        if (this.camera === App.viewportCamera) {
            if (this.showSceneHelpers) this.renderer.render(this.sceneHelpers, this.camera);
        }

        // css2d 在sceneHelpers内
        this.css2DRenderer.render(this.sceneHelpers, App.viewportCamera);

        this.css3DRenderer.render(this.scene, App.viewportCamera);

        this.modules.viewHelper.render();

        this.dispatchEvent({ type: 'afterRender', delta: <number>delta });

        const endTime = performance.now();
        // 计算帧时
        const fs = endTime - startTime;
        useDispatchSignal("sceneRendered", fs);
    }

    /**
     * 销毁
     */
    dispose() {
        this.dispatchEvent({ type: "beforeDestroy" });

        this.container.removeEventListener('mousedown', Fn.mousedown);
        Fn.mousedown = null;
        this.container.removeEventListener('pointermove', Fn.pointermove);
        Fn.pointermove = null;
        this.container.removeEventListener('touchstart', Fn.touchstart);
        Fn.touchstart = null;
        this.container.removeEventListener('dblclick', Fn.dblclick);
        Fn.dblclick = null;

        Object.keys(this.modules).forEach(key => {
            if (this.modules[key].dispose) {
                this.modules[key].dispose();
            }
        })

        this.dispatchEvent({ type: "afterDestroy" });

        this.unInstallScripts();
    }

    /* -----------------暂时放在Viewer下的工具方法-------------------- */

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

        App.execute(new AddObjectCommand(particleEmitter));
    }

    /**
     * 添加瓦片
     * @param tiles 瓦片对象
     * @param addMode 添加进场景的方式：none-不添加；command-使用记录命令添加；normal-直接添加，不会记录历史
     */
    addTiles(tiles: Tiles, addMode: "none" | "command" | "normal" = "command") {
        tiles.setCameraAndRenderer(this.camera, this.renderer);

        this.modules.tilesManage.addTiles(tiles);

        switch (addMode) {
            case "command":
                App.execute(new AddObjectCommand(tiles), `Add 3DTiles: ${tiles.group.name}`);
                break;
            case "normal":
                App.addObject(tiles);
                App.select(tiles);
                break;
        }
    }

    /**
     * 移除瓦片
     */
    removeTiles(tiles: Tiles) {
        this.modules.tilesManage.removeTiles(tiles);

        App.execute(new RemoveObjectCommand(tiles));
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
            this.modules.viewHelper.hidden = false;
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
                this.modules.viewHelper.hidden = true;
                this.render();

                resolve(image);
            });
        });
    }
}